CREATE FUNCTION public.apply_experience_media_locator_cas(
  p_experience_id bigint,
  p_before_photos text[],
  p_before_image_url text,
  p_before_itinerary jsonb,
  p_before_itinerary_i18n jsonb,
  p_after_photos text[],
  p_after_image_url text,
  p_after_itinerary jsonb,
  p_after_itinerary_i18n jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_photos text[];
  current_image_url text;
  current_itinerary jsonb;
  current_itinerary_i18n jsonb;
BEGIN
  SELECT
    experience.photos,
    experience.image_url,
    experience.itinerary,
    experience.itinerary_i18n
  INTO
    current_photos,
    current_image_url,
    current_itinerary,
    current_itinerary_i18n
  FROM public.experiences AS experience
  WHERE experience.id = p_experience_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF current_photos IS NOT DISTINCT FROM p_after_photos
    AND current_image_url IS NOT DISTINCT FROM p_after_image_url
    AND current_itinerary IS NOT DISTINCT FROM p_after_itinerary
    AND current_itinerary_i18n IS NOT DISTINCT FROM p_after_itinerary_i18n
  THEN
    RETURN 'already_exact';
  END IF;

  IF NOT (
    current_photos IS NOT DISTINCT FROM p_before_photos
    AND current_image_url IS NOT DISTINCT FROM p_before_image_url
    AND current_itinerary IS NOT DISTINCT FROM p_before_itinerary
    AND current_itinerary_i18n IS NOT DISTINCT FROM p_before_itinerary_i18n
  ) THEN
    RETURN 'conflict';
  END IF;

  UPDATE public.experiences
  SET
    photos = p_after_photos,
    image_url = p_after_image_url,
    itinerary = p_after_itinerary,
    itinerary_i18n = p_after_itinerary_i18n
  WHERE id = p_experience_id;

  RETURN 'updated';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_experience_media_locator_cas(
  bigint, text[], text, jsonb, jsonb, text[], text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_experience_media_locator_cas(
  bigint, text[], text, jsonb, jsonb, text[], text, jsonb, jsonb
) TO service_role;
