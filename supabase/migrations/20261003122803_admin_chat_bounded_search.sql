-- Schema only. Read-only locator search, no message/receipt/business writes.
BEGIN;
SET LOCAL lock_timeout = '2s';
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;

-- Match getProxyRequestTitle's allowlisted display fields; never search free-form notes.
CREATE FUNCTION private.admin_chat_phone_title(category text, form_data jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE category
    WHEN 'RESTAURANT' THEN coalesce(nullif(btrim(form_data->>'restaurant_name'), ''), '식당 예약 요청')
    WHEN 'HOTEL' THEN coalesce(nullif(btrim(form_data->>'property_name'), ''), '숙소 문의 요청')
    WHEN 'TRANSPORT' THEN CASE WHEN nullif(btrim(form_data->>'departure_location'), '') IS NOT NULL AND nullif(btrim(form_data->>'arrival_location'), '') IS NOT NULL
      THEN btrim(form_data->>'departure_location') || ' → ' || btrim(form_data->>'arrival_location') ELSE '교통 예약 요청' END
    WHEN 'GENERAL' THEN coalesce(nullif(btrim(form_data->>'business_name'), ''), '업체 문의 요청')
    WHEN 'LOST_AND_FOUND' THEN coalesce(nullif(concat_ws(' · ', nullif(btrim(form_data->>'location_name'), ''), nullif(btrim(form_data->>'item_type'), '')), ''), '분실물 문의 요청')
    ELSE '전화 예약 요청' END;
$$;
REVOKE ALL ON FUNCTION private.admin_chat_phone_title(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
-- Expression indexes evaluate this pure input-only helper under the table writer role.
-- Grant execution without adding private-schema access or any table privileges.
GRANT EXECUTE ON FUNCTION private.admin_chat_phone_title(text,jsonb) TO anon, authenticated, service_role;

CREATE INDEX admin_chat_profile_name_search ON public.profiles USING gin (full_name extensions.gin_trgm_ops);
CREATE INDEX admin_chat_profile_email_search ON public.profiles USING gin (email extensions.gin_trgm_ops);
CREATE INDEX admin_chat_experience_title_search ON public.experiences USING gin (title extensions.gin_trgm_ops);
CREATE INDEX admin_chat_inquiry_id_search ON public.inquiries USING gin ((id::text) extensions.gin_trgm_ops) WHERE type IN ('admin','admin_support');
CREATE INDEX admin_chat_inquiry_customer ON public.inquiries(user_id) WHERE type IN ('admin','admin_support');
CREATE INDEX admin_chat_inquiry_experience ON public.inquiries(experience_id) WHERE type IN ('admin','admin_support');
CREATE INDEX admin_chat_phone_id_search ON public.proxy_requests USING gin ((id::text) extensions.gin_trgm_ops);
CREATE INDEX admin_chat_phone_order_search ON public.proxy_requests USING gin (locally_order_id extensions.gin_trgm_ops);
CREATE INDEX admin_chat_phone_title_search ON public.proxy_requests USING gin ((private.admin_chat_phone_title(category,form_data)) extensions.gin_trgm_ops);
CREATE INDEX admin_chat_phone_contact_search ON public.proxy_requests USING gin ((form_data->>'contact_name') extensions.gin_trgm_ops);
CREATE INDEX admin_chat_phone_reservation_search ON public.proxy_requests USING gin ((form_data->>'reservation_name') extensions.gin_trgm_ops);
CREATE INDEX admin_chat_phone_link ON public.proxy_requests ((form_data->>'linked_inquiry_id'))
  WHERE (form_data->>'__proxy_card_anchor') IS DISTINCT FROM 'v1';

CREATE FUNCTION public.search_admin_chat(p_surface text, p_query text)
RETURNS TABLE(id text, customer_name text, customer_email text, title text)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  q text := btrim(p_query);
  pattern text;
  id_query text;
BEGIN
  IF p_surface IS NULL OR p_surface NOT IN ('support','phone') OR q IS NULL OR char_length(q) < 2 OR char_length(q) > 100 THEN
    RETURN;
  END IF;
  -- Escape LIKE metacharacters: user input is literal, parameterized text.
  pattern := '%' || replace(replace(replace(q, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  id_query := CASE WHEN q ~ '^#[1-9][0-9]*$' THEN substr(q,2) ELSE q END;
  IF p_surface = 'support' THEN
    RETURN QUERY
    WITH candidates AS (
      SELECT i.id FROM public.inquiries i WHERE i.type IN ('admin','admin_support')
        AND (i.id::text ILIKE pattern OR i.id::text = id_query)
      UNION
      SELECT i.id FROM public.profiles p JOIN public.inquiries i ON i.user_id = p.id
        WHERE i.type IN ('admin','admin_support') AND (p.full_name ILIKE pattern OR p.email ILIKE pattern)
      UNION
      SELECT i.id FROM public.experiences e JOIN public.inquiries i ON i.experience_id = e.id
        WHERE i.type IN ('admin','admin_support') AND e.title ILIKE pattern
    )
    SELECT i.id::text, p.full_name, p.email, e.title
    FROM candidates c JOIN public.inquiries i ON i.id = c.id
    LEFT JOIN public.profiles p ON p.id = i.user_id
    LEFT JOIN public.experiences e ON e.id = i.experience_id
    WHERE NOT EXISTS (
      -- Same canonical validLinkedRequest: exactly one formal link AND same customer.
      SELECT 1 FROM public.proxy_requests r
      WHERE r.form_data->>'linked_inquiry_id' = i.id::text
        AND (r.form_data->>'__proxy_card_anchor') IS DISTINCT FROM 'v1'
      GROUP BY r.form_data->>'linked_inquiry_id'
      HAVING count(*) = 1 AND bool_and(r.user_id = i.user_id)
    )
    ORDER BY (i.id::text = id_query OR coalesce(lower(p.full_name) = lower(q),false)
      OR coalesce(lower(p.email) = lower(q),false) OR coalesce(lower(e.title) = lower(q),false)) DESC, i.id DESC
    LIMIT 25;
  ELSE
    RETURN QUERY
    WITH candidates AS (
      SELECT r.id FROM public.proxy_requests r WHERE
        r.id::text ILIKE pattern OR r.locally_order_id ILIKE pattern
        OR private.admin_chat_phone_title(r.category,r.form_data) ILIKE pattern
        OR r.form_data->>'contact_name' ILIKE pattern OR r.form_data->>'reservation_name' ILIKE pattern
      UNION
      SELECT r.id FROM public.profiles p JOIN public.proxy_requests r ON r.user_id = p.id
        WHERE p.full_name ILIKE pattern OR p.email ILIKE pattern
    )
    SELECT r.id::text, coalesce(p.full_name, nullif(r.form_data->>'contact_name',''), nullif(r.form_data->>'reservation_name','')),
      p.email, private.admin_chat_phone_title(r.category,r.form_data)
    FROM candidates c JOIN public.proxy_requests r ON r.id = c.id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE (r.form_data->>'__proxy_card_anchor') IS DISTINCT FROM 'v1'
    ORDER BY (r.id::text = lower(q) OR coalesce(lower(r.locally_order_id) = lower(q),false)
      OR coalesce(lower(p.full_name) = lower(q),false) OR coalesce(lower(p.email) = lower(q),false)
      OR lower(private.admin_chat_phone_title(r.category,r.form_data)) = lower(q)
      OR coalesce(lower(r.form_data->>'contact_name') = lower(q),false)
      OR coalesce(lower(r.form_data->>'reservation_name') = lower(q),false)) DESC, r.id DESC
    LIMIT 25;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.search_admin_chat(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_admin_chat(text,text) TO service_role;
COMMIT;
