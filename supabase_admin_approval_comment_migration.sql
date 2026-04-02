ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS admin_comment text;

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS admin_comment text;

DO $$
DECLARE
  status_data_type text;
  status_udt_schema text;
  status_udt_name text;
  legacy_check_name text;
  legacy_check_definition text;
BEGIN
  SELECT
    c.data_type,
    c.udt_schema,
    c.udt_name
  INTO
    status_data_type,
    status_udt_schema,
    status_udt_name
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'experiences'
    AND c.column_name = 'status';

  IF status_data_type IS NULL THEN
    RAISE NOTICE 'public.experiences.status column not found. Skipping revision status reconciliation.';
    RETURN;
  END IF;

  IF status_data_type = 'USER-DEFINED' THEN
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      status_udt_schema,
      status_udt_name,
      'revision'
    );
    RETURN;
  END IF;

  IF status_data_type NOT IN ('text', 'character varying') THEN
    RAISE NOTICE 'public.experiences.status uses unsupported type %. Skipping revision status reconciliation.', status_data_type;
    RETURN;
  END IF;

  SELECT
    con.conname,
    pg_get_constraintdef(con.oid)
  INTO
    legacy_check_name,
    legacy_check_definition
  FROM pg_constraint AS con
  JOIN pg_class AS rel ON rel.oid = con.conrelid
  JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'experiences'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  ORDER BY con.conname
  LIMIT 1;

  IF legacy_check_name IS NULL THEN
    RETURN;
  END IF;

  IF legacy_check_definition ILIKE '%revision%' THEN
    RETURN;
  END IF;

  IF legacy_check_definition ILIKE '%pending%'
    AND legacy_check_definition ILIKE '%active%'
    AND legacy_check_definition ILIKE '%rejected%' THEN
    EXECUTE format('ALTER TABLE public.experiences DROP CONSTRAINT %I', legacy_check_name);
    EXECUTE format(
      'ALTER TABLE public.experiences ADD CONSTRAINT %I CHECK (status IN (%L, %L, %L, %L))',
      legacy_check_name,
      'pending',
      'active',
      'rejected',
      'revision'
    );
    RETURN;
  END IF;

  RAISE NOTICE 'Found status constraint % with unsupported shape: %', legacy_check_name, legacy_check_definition;
END;
$$;
