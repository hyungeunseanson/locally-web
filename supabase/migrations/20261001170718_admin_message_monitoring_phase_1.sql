-- Prepared for review/local validation only. Apply through the normal migration rollout.
BEGIN;

-- RLS is not a column boundary: revoke table AND column grants. All chat writes
-- already use authenticated, participant/administrator-checked server routes.
DO $block$
DECLARE t text; c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inquiries', 'inquiry_messages'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM PUBLIC, anon, authenticated', t);
    SELECT string_agg(quote_ident(column_name), ', ') INTO c
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t;
    EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC, anon, authenticated', c, c, c, t);
  END LOOP;
END $block$;
DROP POLICY IF EXISTS "Users can update own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update messages in their inquiries" ON public.inquiry_messages;
-- Participant and admin SELECT policies are preserved; service_role retains writes.

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS support_reopened_at timestamptz;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS admin_read_at timestamptz;
CREATE INDEX IF NOT EXISTS inquiry_messages_admin_activity_idx ON public.inquiry_messages (inquiry_id, id DESC);
COMMENT ON COLUMN public.inquiry_messages.admin_read_at IS 'Administrative acknowledgement only; never a customer/host read receipt.';
-- Existing admin acknowledgements become the initial watermark, without modifying
-- the customer-facing is_read/read_at values.
UPDATE public.inquiry_messages m SET admin_read_at = m.read_at
FROM public.inquiries i WHERE i.id = m.inquiry_id AND i.type IN ('admin', 'admin_support')
AND m.read_at IS NOT NULL AND m.admin_read_at IS NULL;

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.is_inquiry_admin_sender(p_sender uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_sender AND u.role = 'admin')
  OR EXISTS (SELECT 1 FROM auth.users u JOIN public.admin_whitelist w ON w.email = u.email WHERE u.id = p_sender AND u.email <> '');
$$;
REVOKE ALL ON FUNCTION private.is_inquiry_admin_sender(uuid) FROM PUBLIC, anon, authenticated;

-- Lock the parent before INSERT, so a simultaneous status CAS either happens
-- first (then this customer message reopens it), or sees a changed version.
CREATE OR REPLACE FUNCTION private.prepare_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.inquiries%ROWTYPE;
BEGIN
  SELECT * INTO i FROM public.inquiries WHERE id = NEW.inquiry_id FOR UPDATE;
  IF i.type IN ('admin', 'admin_support') THEN
    UPDATE public.inquiries SET
      status = CASE WHEN status = 'resolved'
        AND NEW.sender_id IN (user_id, host_id)
        AND NOT private.is_inquiry_admin_sender(NEW.sender_id) THEN 'open' ELSE status END,
      support_reopened_at = CASE WHEN status = 'resolved'
        AND NEW.sender_id IN (user_id, host_id)
        AND NOT private.is_inquiry_admin_sender(NEW.sender_id) THEN clock_timestamp() ELSE support_reopened_at END,
      updated_at = clock_timestamp()
    WHERE id = i.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.prepare_support_message() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.advance_support_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.type IN ('admin', 'admin_support') THEN
    NEW.updated_at := greatest(NEW.updated_at, clock_timestamp(), OLD.updated_at + interval '1 millisecond');
    IF NEW.status = 'resolved' THEN NEW.support_reopened_at := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.advance_support_version() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS inquiry_support_version ON public.inquiries;
CREATE TRIGGER inquiry_support_version BEFORE UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION private.advance_support_version();
DROP TRIGGER IF EXISTS inquiry_support_message ON public.inquiry_messages;
CREATE TRIGGER inquiry_support_message BEFORE INSERT ON public.inquiry_messages
FOR EACH ROW EXECUTE FUNCTION private.prepare_support_message();

-- One batched metadata query per admin page. No message bodies need to be loaded
-- merely to find the first unanswered customer message.
CREATE OR REPLACE FUNCTION public.get_admin_inquiry_activity(p_inquiry_ids bigint[])
RETURNS TABLE(inquiry_id bigint, status text, updated_at timestamptz, last_message_at timestamptz, last_sender_role text,
  last_message_content text, needs_reply boolean, reply_waiting_since timestamptz,
  support_reopened_at timestamptz, admin_unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH messages AS (
    SELECT m.*, i.type AS inquiry_type,
      CASE WHEN private.is_inquiry_admin_sender(m.sender_id) THEN 'admin'
        WHEN i.type IN ('admin', 'admin_support') THEN 'customer'
        WHEN m.sender_id = i.host_id THEN 'host' ELSE 'customer' END AS sender_role
    FROM public.inquiry_messages m JOIN public.inquiries i ON i.id = m.inquiry_id
    WHERE i.id = ANY(p_inquiry_ids) AND m.type IS DISTINCT FROM 'deleted'
  )
  SELECT i.id, i.status, i.updated_at, latest.created_at, latest.sender_role,
    CASE WHEN latest.type = 'image' THEN '📷 사진을 보냈습니다.' ELSE latest.content END,
    coalesce(i.type IN ('admin', 'admin_support') AND i.status IS DISTINCT FROM 'resolved' AND latest.sender_role = 'customer', false),
    CASE WHEN i.status IS DISTINCT FROM 'resolved' AND latest.sender_role = 'customer' THEN waiting.since END,
    i.support_reopened_at, coalesce(unread.cnt, 0)
  FROM public.inquiries i
  LEFT JOIN LATERAL (SELECT * FROM messages m WHERE m.inquiry_id = i.id ORDER BY m.id DESC LIMIT 1) latest ON true
  LEFT JOIN LATERAL (
    SELECT m.created_at AS since FROM messages m WHERE m.inquiry_id = i.id AND m.sender_role = 'customer'
      AND m.id > coalesce((SELECT max(a.id) FROM messages a WHERE a.inquiry_id = i.id AND a.sender_role = 'admin'), 0)
    ORDER BY m.id ASC LIMIT 1
  ) waiting ON true
  LEFT JOIN LATERAL (SELECT count(*) AS cnt FROM messages m WHERE m.inquiry_id = i.id AND m.sender_role = 'customer' AND m.admin_read_at IS NULL) unread ON true
  WHERE i.id = ANY(p_inquiry_ids);
$$;
REVOKE ALL ON FUNCTION public.get_admin_inquiry_activity(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_inquiry_activity(bigint[]) TO service_role;

CREATE OR REPLACE FUNCTION public.ack_admin_inquiry_messages(p_inquiry_id bigint, p_through_message_id bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inquiries i JOIN public.inquiry_messages m ON m.inquiry_id = i.id
    WHERE i.id = p_inquiry_id AND i.type IN ('admin', 'admin_support') AND m.id = p_through_message_id) THEN
    RAISE EXCEPTION 'Invalid support acknowledgement';
  END IF;
  UPDATE public.inquiry_messages m SET admin_read_at = clock_timestamp()
  WHERE m.inquiry_id = p_inquiry_id AND m.id <= p_through_message_id AND m.admin_read_at IS NULL
    AND NOT private.is_inquiry_admin_sender(m.sender_id);
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.ack_admin_inquiry_messages(bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_admin_inquiry_messages(bigint, bigint) TO service_role;

-- Publication is a rollout proposal in this unapplied migration. Admin catch-up
-- still works when the publication is unavailable.
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inquiries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;
  END IF;
END $publication$;
COMMIT;
