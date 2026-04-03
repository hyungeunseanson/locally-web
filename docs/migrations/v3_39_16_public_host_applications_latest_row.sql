-- -----------------------------------------------------------------------------
-- Keep public_host_applications pinned to the latest host application per user.
-- Public experience visibility should follow the host's current review state.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_host_applications
WITH (security_invoker = off) AS
SELECT DISTINCT ON (user_id)
  id,
  user_id,
  status,
  name,
  profile_photo,
  languages,
  self_intro,
  created_at
FROM public.host_applications
ORDER BY user_id, created_at DESC, id DESC;

GRANT SELECT ON public.public_host_applications TO anon, authenticated;
