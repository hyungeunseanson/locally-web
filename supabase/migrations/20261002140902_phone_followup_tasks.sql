-- PREPARED ONLY. Apply separately after review; no remote application in this PR.
BEGIN;
-- Fail fast instead of deadlocking a payment activation (request -> new inquiry).
-- The cutover and capture installation must share one quiescent transaction.
LOCK TABLE public.proxy_requests, public.inquiry_messages, public.inquiries IN ACCESS EXCLUSIVE MODE NOWAIT;

CREATE TABLE private.phone_followup_tasks (
  proxy_request_id uuid NOT NULL REFERENCES public.proxy_requests(id) ON DELETE CASCADE,
  inquiry_id bigint NOT NULL,
  message_id bigint NOT NULL,
  handled_at timestamptz,
  handled_by uuid,
  PRIMARY KEY (proxy_request_id, message_id),
  UNIQUE (inquiry_id, message_id),
  CHECK ((handled_at IS NULL) = (handled_by IS NULL))
);
ALTER TABLE private.phone_followup_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.phone_followup_tasks FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX phone_followup_pending_idx ON private.phone_followup_tasks(proxy_request_id, message_id) WHERE handled_at IS NULL;
-- Native PG17 EXPLAIN fixture verifies selective capture avoids scanning all requests.
CREATE INDEX proxy_requests_phone_link_idx ON public.proxy_requests ((btrim(form_data->>'linked_inquiry_id')))
WHERE form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1';

-- Historical baseline only: preserve the old latest-visible-sender semantics.
-- Future operational handling never uses a time or ID boundary.
CREATE FUNCTION private.seed_phone_followup(p_request uuid, p_inquiry bigint, p_customer uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO private.phone_followup_tasks(proxy_request_id, inquiry_id, message_id)
  SELECT p_request, p_inquiry, m.id FROM public.inquiry_messages m
  WHERE m.inquiry_id = p_inquiry AND m.sender_id = p_customer
    AND coalesce(m.type, 'text') IN ('text', 'image')
    AND NOT private.is_inquiry_admin_sender(m.sender_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.inquiry_messages reply WHERE reply.inquiry_id = p_inquiry
        AND coalesce(reply.type, 'text') IN ('text', 'image') AND reply.sender_id IS DISTINCT FROM p_customer
        AND (reply.created_at, reply.id) > (m.created_at, m.id)
    ) ON CONFLICT DO NOTHING;
$$;
REVOKE ALL ON FUNCTION private.seed_phone_followup(uuid,bigint,uuid) FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE r record; old_ids uuid[]; new_ids uuid[];
BEGIN
  CREATE TEMP TABLE phone_cutover_links ON COMMIT DROP AS
    SELECT p.id, p.user_id, p.status, i.id AS inquiry_id
    FROM public.proxy_requests p JOIN public.inquiries i ON btrim(p.form_data->>'linked_inquiry_id') = i.id::text
    WHERE p.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1'
      AND i.type IN ('admin','admin_support') AND i.user_id = p.user_id
      AND (SELECT count(*) FROM public.proxy_requests other
        WHERE btrim(other.form_data->>'linked_inquiry_id') = i.id::text
          AND other.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1') = 1;
  SELECT coalesce(array_agg(l.id ORDER BY l.id), '{}'::uuid[]) INTO old_ids
    FROM phone_cutover_links l WHERE l.status = 'COMPLETED' AND l.user_id = (
      SELECT m.sender_id FROM public.inquiry_messages m WHERE m.inquiry_id = l.inquiry_id
        AND coalesce(m.type,'text') IN ('text','image') ORDER BY m.created_at DESC, m.id DESC LIMIT 1);
  FOR r IN SELECT * FROM phone_cutover_links LOOP
    PERFORM private.seed_phone_followup(r.id, r.inquiry_id, r.user_id);
  END LOOP;
  SELECT coalesce(array_agg(l.id ORDER BY l.id), '{}'::uuid[]) INTO new_ids
    FROM phone_cutover_links l WHERE l.status = 'COMPLETED'
      AND EXISTS (SELECT 1 FROM private.phone_followup_tasks t WHERE t.proxy_request_id = l.id AND t.handled_at IS NULL);
  IF old_ids IS DISTINCT FROM new_ids THEN RAISE EXCEPTION 'Phone followup baseline mismatch'; END IF;
END $$;
DROP FUNCTION private.seed_phone_followup(uuid,bigint,uuid);

-- Existing formal links are immutable. An unpublished new row / inactive card
-- anchor can acquire its inquiry lock while adopting a link: message capture
-- cannot reference that row until adoption commits, avoiding a reverse-lock cycle.
CREATE FUNCTION private.adopt_phone_followup_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link text := btrim(NEW.form_data->>'linked_inquiry_id'); i public.inquiries%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1'
      AND nullif(btrim(OLD.form_data->>'linked_inquiry_id'),'') IS NOT NULL THEN
      IF btrim(OLD.form_data->>'linked_inquiry_id') IS DISTINCT FROM link
        OR NEW.form_data->>'__proxy_card_anchor' = 'v1' OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Formal phone link is immutable' USING ERRCODE = '22023';
      END IF;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.form_data->>'__proxy_card_anchor' = 'v1' OR nullif(link,'') IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO i FROM public.inquiries WHERE id::text = link FOR UPDATE;
  IF i.id IS NULL OR i.user_id IS DISTINCT FROM NEW.user_id OR coalesce(i.type,'') NOT IN ('admin','admin_support')
    OR (SELECT count(*) FROM public.proxy_requests p WHERE btrim(p.form_data->>'linked_inquiry_id') = link
      AND p.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1') <> 1 THEN
    RAISE EXCEPTION 'Invalid or duplicate phone link' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.phone_followup_tasks(proxy_request_id,inquiry_id,message_id)
    SELECT NEW.id, i.id, m.id FROM public.inquiry_messages m WHERE m.inquiry_id = i.id
      AND m.sender_id = i.user_id AND coalesce(m.type,'text') IN ('text','image')
      AND NOT private.is_inquiry_admin_sender(m.sender_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.adopt_phone_followup_link() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER phone_followup_link AFTER INSERT OR UPDATE OF form_data, user_id ON public.proxy_requests
FOR EACH ROW EXECUTE FUNCTION private.adopt_phone_followup_link();

CREATE FUNCTION private.capture_phone_followup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.inquiries%ROWTYPE; requests uuid[];
BEGIN
  -- prepare_support_message has already locked the inquiry BEFORE INSERT.
  SELECT * INTO i FROM public.inquiries WHERE id = NEW.inquiry_id;
  IF coalesce(i.type,'') NOT IN ('admin','admin_support') OR NEW.sender_id IS DISTINCT FROM i.user_id
    OR coalesce(NEW.type,'text') NOT IN ('text','image') OR private.is_inquiry_admin_sender(NEW.sender_id) THEN RETURN NEW; END IF;
  SELECT array_agg(p.id) INTO requests FROM public.proxy_requests p
    WHERE btrim(p.form_data->>'linked_inquiry_id') = i.id::text AND p.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1';
  IF requests IS NULL THEN RETURN NEW; END IF;
  IF cardinality(requests) <> 1 OR NOT EXISTS (SELECT 1 FROM public.proxy_requests p WHERE p.id = requests[1] AND p.user_id = i.user_id) THEN
    RAISE EXCEPTION 'Invalid or duplicate phone link' USING ERRCODE = '22023';
  END IF;
  INSERT INTO private.phone_followup_tasks(proxy_request_id,inquiry_id,message_id) VALUES(requests[1],i.id,NEW.id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.capture_phone_followup() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER phone_followup_capture AFTER INSERT ON public.inquiry_messages FOR EACH ROW EXECUTE FUNCTION private.capture_phone_followup();

CREATE FUNCTION private.delete_pending_phone_followup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR coalesce(NEW.type,'text') NOT IN ('text','image') THEN
    DELETE FROM private.phone_followup_tasks WHERE inquiry_id = OLD.inquiry_id AND message_id = OLD.id AND handled_at IS NULL;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.delete_pending_phone_followup() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER phone_followup_delete AFTER DELETE OR UPDATE OF type ON public.inquiry_messages
FOR EACH ROW EXECUTE FUNCTION private.delete_pending_phone_followup();

CREATE FUNCTION private.handle_phone_followup(p_request uuid,p_inquiry bigint,p_ids bigint[],p_admin uuid,p_complete boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.inquiries%ROWTYPE; r public.proxy_requests%ROWTYPE; handled jsonb; pending boolean;
BEGIN
  IF NOT private.is_inquiry_admin_sender(p_admin) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF coalesce(cardinality(p_ids),0) NOT BETWEEN 1 AND 200 OR EXISTS (SELECT 1 FROM unnest(p_ids) id WHERE id IS NULL OR id <= 0)
    OR (SELECT count(DISTINCT id) FROM unnest(p_ids) id) <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'Invalid rendered snapshot' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO i FROM public.inquiries WHERE id = p_inquiry FOR UPDATE;
  SELECT * INTO r FROM public.proxy_requests WHERE id = p_request FOR UPDATE;
  IF i.id IS NULL OR r.id IS NULL OR coalesce(i.type,'') NOT IN ('admin','admin_support') OR i.user_id IS DISTINCT FROM r.user_id
    OR btrim(r.form_data->>'linked_inquiry_id') IS DISTINCT FROM i.id::text OR r.form_data->>'__proxy_card_anchor' = 'v1'
    OR (SELECT count(*) FROM public.proxy_requests p WHERE btrim(p.form_data->>'linked_inquiry_id') = i.id::text
      AND p.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1') <> 1 THEN
    RAISE EXCEPTION 'Invalid or duplicate phone link' USING ERRCODE = '22023';
  END IF;
  -- Message -> task order matches deletion. Parent lock prevents concurrent INSERT.
  PERFORM 1 FROM public.inquiry_messages m WHERE m.inquiry_id = i.id AND m.id = ANY(p_ids) ORDER BY m.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM unnest(p_ids) AS snapshot(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.inquiry_messages m WHERE m.id = snapshot.id AND m.inquiry_id = i.id AND m.sender_id = r.user_id
        AND NOT private.is_inquiry_admin_sender(m.sender_id) AND coalesce(m.type,'text') IN ('text','image','deleted')
    ) AND NOT EXISTS (SELECT 1 FROM private.phone_followup_tasks t WHERE t.proxy_request_id = r.id
        AND t.inquiry_id = i.id AND t.message_id = snapshot.id AND t.handled_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid customer snapshot' USING ERRCODE = '22023';
  END IF;
  IF p_complete THEN
    IF r.status IN ('PENDING','IN_PROGRESS') AND r.payment_status = 'COMPLETED' THEN
      UPDATE public.proxy_requests SET status = 'COMPLETED' WHERE id = r.id;
      r.status := 'COMPLETED';
    ELSIF r.status IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'Request cannot be completed' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  WITH changed AS (
    UPDATE private.phone_followup_tasks SET handled_at = clock_timestamp(), handled_by = p_admin
    WHERE proxy_request_id = r.id AND inquiry_id = i.id AND message_id = ANY(p_ids) AND handled_at IS NULL RETURNING message_id
  ) SELECT coalesce(jsonb_agg(message_id::text ORDER BY message_id),'[]'::jsonb) INTO handled FROM changed;
  SELECT EXISTS(SELECT 1 FROM private.phone_followup_tasks WHERE proxy_request_id = r.id AND handled_at IS NULL) INTO pending;
  RETURN jsonb_build_object('status',r.status,'handledMessageIds',handled,'needsReply',r.status = 'COMPLETED' AND pending,'hasMoreUnhandled',pending);
END $$;
REVOKE ALL ON FUNCTION private.handle_phone_followup(uuid,bigint,bigint[],uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.complete_phone_request(p_request_id uuid,p_inquiry_id bigint,p_message_ids bigint[],p_admin_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.handle_phone_followup(p_request_id,p_inquiry_id,p_message_ids,p_admin_id,true);
$$;
REVOKE ALL ON FUNCTION public.complete_phone_request(uuid,bigint,bigint[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_phone_request(uuid,bigint,bigint[],uuid) TO service_role;

CREATE FUNCTION public.reply_phone_request(p_request_id uuid,p_inquiry_id bigint,p_message_ids bigint[],p_admin_id uuid,p_content text,p_type text,p_image_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; inserted public.inquiry_messages%ROWTYPE;
BEGIN
  IF p_type NOT IN ('text','image') OR (nullif(btrim(p_content),'') IS NULL AND p_image_url IS NULL) THEN
    RAISE EXCEPTION 'Invalid reply' USING ERRCODE = '22023';
  END IF;
  result := private.handle_phone_followup(p_request_id,p_inquiry_id,p_message_ids,p_admin_id,false);
  INSERT INTO public.inquiry_messages(inquiry_id,sender_id,content,type,image_url,is_read)
    VALUES(p_inquiry_id,p_admin_id,p_content,p_type,p_image_url,false) RETURNING * INTO inserted;
  RETURN result || jsonb_build_object('id',inserted.id::text,'created_at',inserted.created_at);
END $$;
REVOKE ALL ON FUNCTION public.reply_phone_request(uuid,bigint,bigint[],uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_phone_request(uuid,bigint,bigint[],uuid,text,text,text) TO service_role;

-- Replaces, rather than adds to, the phone page's existing activity RPC.
CREATE FUNCTION public.get_admin_phone_activity(p_inquiry_ids bigint[])
RETURNS TABLE(inquiry_id bigint,status text,updated_at timestamptz,last_message_at timestamptz,last_sender_role text,
  last_message_content text,needs_reply boolean,reply_waiting_since timestamptz,support_reopened_at timestamptz,
  admin_unread_count bigint,phone_needs_reply boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.*, coalesce(pending.found,false) FROM public.get_admin_inquiry_activity(p_inquiry_ids) a
  LEFT JOIN LATERAL (SELECT true AS found FROM private.phone_followup_tasks t
    JOIN public.proxy_requests p ON p.id = t.proxy_request_id
    WHERE btrim(p.form_data->>'linked_inquiry_id') = a.inquiry_id::text
      AND p.form_data->>'__proxy_card_anchor' IS DISTINCT FROM 'v1'
      AND t.handled_at IS NULL LIMIT 1) pending ON true;
$$;
REVOKE ALL ON FUNCTION public.get_admin_phone_activity(bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_phone_activity(bigint[]) TO service_role;
COMMIT;
