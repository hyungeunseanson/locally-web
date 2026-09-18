CREATE OR REPLACE FUNCTION public.finalize_proxy_card_intake_atomic(
  p_proxy_request_id uuid,
  p_verified_amount integer,
  p_verified_tid text,
  p_initial_message text
)
RETURNS TABLE (
  inquiry_id bigint,
  message_id bigint,
  message_created_at timestamp with time zone,
  activated_now boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_request public.proxy_requests%ROWTYPE;
  v_inquiry_id bigint;
  v_message_id bigint;
  v_message_created_at timestamp with time zone;
  v_linked_inquiry_id text;
  v_stored_tid text;
  v_stored_amount integer;
  v_message_content text;
BEGIN
  IF p_verified_amount IS NULL OR p_verified_amount <= 0 THEN
    RAISE EXCEPTION 'Verified proxy card amount is invalid.' USING ERRCODE = '22023';
  END IF;

  v_stored_tid := btrim(coalesce(p_verified_tid, ''));
  IF v_stored_tid = '' THEN
    RAISE EXCEPTION 'Verified proxy card TID is required.' USING ERRCODE = '22023';
  END IF;

  v_message_content := btrim(coalesce(p_initial_message, ''));
  IF v_message_content = '' THEN
    RAISE EXCEPTION 'Proxy card initial message is required.' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_request
    FROM public.proxy_requests
   WHERE id = p_proxy_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proxy request was not found.' USING ERRCODE = 'P0002';
  END IF;

  IF upper(coalesce(v_request.payment_channel, '')) <> 'LOCALLY'
     OR lower(coalesce(v_request.form_data ->> 'payment_method', '')) <> 'card'
     OR v_request.form_data ->> '__proxy_card_anchor' <> 'v1' THEN
    RAISE EXCEPTION 'Proxy request is not a card payment anchor.' USING ERRCODE = '22023';
  END IF;

  IF upper(coalesce(v_request.payment_status, '')) <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Proxy card payment is not completed.' USING ERRCODE = '22023';
  END IF;

  IF btrim(coalesce(v_request.tid, '')) <> v_stored_tid THEN
    RAISE EXCEPTION 'Proxy card TID does not match the stored payment.' USING ERRCODE = '22023';
  END IF;

  v_stored_amount := NULLIF(btrim(coalesce(v_request.form_data ->> 'service_fee_krw', '')), '')::integer;
  IF v_stored_amount IS NULL OR v_stored_amount <> p_verified_amount THEN
    RAISE EXCEPTION 'Proxy card amount does not match the stored request.' USING ERRCODE = '22023';
  END IF;

  v_linked_inquiry_id := NULLIF(btrim(coalesce(v_request.form_data ->> 'linked_inquiry_id', '')), '');
  IF v_linked_inquiry_id IS NOT NULL THEN
    BEGIN
      v_inquiry_id := v_linked_inquiry_id::bigint;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Proxy request inquiry link is invalid.' USING ERRCODE = '22023';
    END;

    PERFORM 1
      FROM public.inquiries
     WHERE id = v_inquiry_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked proxy inquiry was not found.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.proxy_requests
       SET form_data = coalesce(v_request.form_data, '{}'::jsonb) - '__proxy_card_anchor'
     WHERE id = p_proxy_request_id;

    RETURN QUERY SELECT v_inquiry_id, NULL::bigint, NULL::timestamp with time zone, false;
    RETURN;
  END IF;

  INSERT INTO public.inquiries (
    user_id,
    host_id,
    experience_id,
    content,
    type
  )
  VALUES (
    v_request.user_id,
    NULL,
    NULL,
    v_message_content,
    'admin_support'
  )
  RETURNING id INTO v_inquiry_id;

  INSERT INTO public.inquiry_messages (
    inquiry_id,
    sender_id,
    content,
    type,
    is_read
  )
  VALUES (
    v_inquiry_id,
    v_request.user_id,
    v_message_content,
    'text',
    false
  )
  RETURNING id, created_at INTO v_message_id, v_message_created_at;

  UPDATE public.proxy_requests
     SET form_data = (coalesce(v_request.form_data, '{}'::jsonb) - '__proxy_card_anchor')
       || jsonb_build_object('linked_inquiry_id', v_inquiry_id)
   WHERE id = p_proxy_request_id;

  RETURN QUERY SELECT v_inquiry_id, v_message_id, v_message_created_at, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_proxy_card_intake_atomic(uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_proxy_card_intake_atomic(uuid, integer, text, text)
  TO service_role;
