-- Preserve the reviewed public projection while protecting its approved-row filter.
-- The advisor's security_definer_view finding remains expected: this view must
-- continue to use the owner's privileges for public host discovery.

BEGIN;

DO $precondition$
DECLARE
  view_oid oid := to_regclass('public.public_host_applications');
  view_kind "char";
  view_owner text;
  view_options text[];
  view_columns text[];
  view_grants text[];
  view_definition text;
  expected_definition text := $viewdef$
 WITH latest_per_user AS (
         SELECT DISTINCT ON (host_applications.user_id) host_applications.id,
            host_applications.user_id,
            host_applications.status,
            host_applications.name,
            host_applications.profile_photo,
            host_applications.languages,
            host_applications.self_intro,
            host_applications.created_at,
            host_applications.is_superhost
           FROM host_applications
          ORDER BY host_applications.user_id, host_applications.created_at DESC, host_applications.id DESC
        )
 SELECT id,
    user_id,
    status,
    name,
    profile_photo,
    languages,
    self_intro,
    created_at,
    is_superhost
   FROM latest_per_user
  WHERE status = 'approved'::text;
$viewdef$;
BEGIN
  IF view_oid IS NULL THEN
    RAISE EXCEPTION 'public.public_host_applications is missing';
  END IF;

  SELECT relation.relkind,
         pg_get_userbyid(relation.relowner),
         relation.reloptions,
         pg_get_viewdef(relation.oid, true)
    INTO view_kind, view_owner, view_options, view_definition
    FROM pg_class AS relation
   WHERE relation.oid = view_oid;

  IF view_kind <> 'v' OR view_owner <> 'postgres' OR NOT (
    view_options IS NOT DISTINCT FROM ARRAY['security_invoker=off']::text[]
    OR view_options IS NOT DISTINCT FROM ARRAY['security_invoker=false']::text[]
  ) THEN
    RAISE EXCEPTION 'public.public_host_applications relation contract drifted';
  END IF;

  IF btrim(regexp_replace(view_definition, '\s+', ' ', 'g'))
     IS DISTINCT FROM btrim(regexp_replace(expected_definition, '\s+', ' ', 'g')) THEN
    RAISE EXCEPTION 'public.public_host_applications approved/latest-row definition drifted';
  END IF;

  SELECT array_agg(attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
                   ORDER BY attribute.attnum)
    INTO view_columns
    FROM pg_attribute AS attribute
   WHERE attribute.attrelid = view_oid
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped;

  IF view_columns IS DISTINCT FROM ARRAY[
    'id:uuid', 'user_id:uuid', 'status:text', 'name:text',
    'profile_photo:text', 'languages:text[]', 'self_intro:text',
    'created_at:timestamp with time zone', 'is_superhost:boolean'
  ]::text[] THEN
    RAISE EXCEPTION 'public.public_host_applications column contract drifted';
  END IF;

  SELECT COALESCE(array_agg(grant_entry ORDER BY grant_entry), ARRAY[]::text[])
    INTO view_grants
    FROM (
      SELECT (CASE WHEN grant_item.grantee = 0 THEN 'PUBLIC'
                   ELSE pg_get_userbyid(grant_item.grantee) END)
             || ':' || grant_item.privilege_type AS grant_entry
        FROM pg_class AS relation
        CROSS JOIN LATERAL aclexplode(relation.relacl) AS grant_item
       WHERE relation.oid = view_oid
    ) AS grants;

  IF view_grants IS DISTINCT FROM ARRAY[
    'anon:SELECT', 'authenticated:SELECT',
    'postgres:DELETE', 'postgres:INSERT', 'postgres:MAINTAIN',
    'postgres:REFERENCES', 'postgres:SELECT', 'postgres:TRIGGER',
    'postgres:TRUNCATE', 'postgres:UPDATE', 'service_role:SELECT'
  ]::text[] OR EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = view_oid AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'public.public_host_applications grants drifted';
  END IF;
END
$precondition$;

ALTER VIEW public.public_host_applications
  SET (security_barrier = true);

DO $postcondition$
DECLARE
  view_oid oid := 'public.public_host_applications'::regclass;
  view_columns text[];
  view_grants text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_class AS relation
     WHERE relation.oid = 'public.public_host_applications'::regclass
       AND relation.relkind = 'v'
       AND pg_get_userbyid(relation.relowner) = 'postgres'
       AND cardinality(relation.reloptions) = 2
       AND (
         relation.reloptions @> ARRAY['security_invoker=off', 'security_barrier=true']::text[]
         OR relation.reloptions @> ARRAY['security_invoker=false', 'security_barrier=true']::text[]
       )
  ) THEN
    RAISE EXCEPTION 'public.public_host_applications security options did not converge';
  END IF;

  -- This digest is the whitespace-normalized definition checked above.
  IF md5(regexp_replace(btrim(pg_get_viewdef(view_oid, true)), '\s+', ' ', 'g'))
     IS DISTINCT FROM '74d18d667ce8055cecc9495c4cf8b2d3' THEN
    RAISE EXCEPTION 'public.public_host_applications definition changed';
  END IF;

  SELECT array_agg(attribute.attname || ':' || format_type(attribute.atttypid, attribute.atttypmod)
                   ORDER BY attribute.attnum)
    INTO view_columns
    FROM pg_attribute AS attribute
   WHERE attribute.attrelid = view_oid
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped;

  IF view_columns IS DISTINCT FROM ARRAY[
    'id:uuid', 'user_id:uuid', 'status:text', 'name:text',
    'profile_photo:text', 'languages:text[]', 'self_intro:text',
    'created_at:timestamp with time zone', 'is_superhost:boolean'
  ]::text[] THEN
    RAISE EXCEPTION 'public.public_host_applications columns changed';
  END IF;

  SELECT COALESCE(array_agg(grant_entry ORDER BY grant_entry), ARRAY[]::text[])
    INTO view_grants
    FROM (
      SELECT (CASE WHEN grant_item.grantee = 0 THEN 'PUBLIC'
                   ELSE pg_get_userbyid(grant_item.grantee) END)
             || ':' || grant_item.privilege_type AS grant_entry
        FROM pg_class AS relation
        CROSS JOIN LATERAL aclexplode(relation.relacl) AS grant_item
       WHERE relation.oid = view_oid
    ) AS grants;

  IF view_grants IS DISTINCT FROM ARRAY[
    'anon:SELECT', 'authenticated:SELECT',
    'postgres:DELETE', 'postgres:INSERT', 'postgres:MAINTAIN',
    'postgres:REFERENCES', 'postgres:SELECT', 'postgres:TRIGGER',
    'postgres:TRUNCATE', 'postgres:UPDATE', 'service_role:SELECT'
  ]::text[] OR EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = view_oid AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'public.public_host_applications grants changed';
  END IF;
END
$postcondition$;

COMMIT;
