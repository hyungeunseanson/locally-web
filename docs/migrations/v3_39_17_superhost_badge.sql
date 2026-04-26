-- -----------------------------------------------------------------------------
-- Superhost badge: admin-controlled public host verification flag.
-- -----------------------------------------------------------------------------

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS is_superhost boolean NOT NULL DEFAULT false;

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
  created_at,
  is_superhost
FROM public.host_applications
ORDER BY user_id, created_at DESC, id DESC;

GRANT SELECT ON public.public_host_applications TO anon, authenticated;
