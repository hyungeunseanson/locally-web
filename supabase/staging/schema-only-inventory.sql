\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

BEGIN READ ONLY;

SELECT jsonb_build_object(
  'tables_and_views', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', relation.relname,
      'kind', relation.relkind,
      'rls', relation.relrowsecurity,
      'definition', CASE
        WHEN relation.relkind = 'v' THEN pg_get_viewdef(relation.oid, true)
        WHEN relation.relkind = 'm' THEN pg_get_viewdef(relation.oid, true)
        ELSE NULL
      END
    ) ORDER BY namespace.nspname, relation.relname)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'v', 'm')
  ), '[]'::jsonb),
  'columns', COALESCE((
    SELECT jsonb_agg(to_jsonb(columns) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public'
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', relation.relname,
      'name', constraint.conname,
      'type', constraint.contype,
      'definition', pg_get_constraintdef(constraint.oid, true)
    ) ORDER BY relation.relname, constraint.conname)
    FROM pg_constraint constraint
    JOIN pg_class relation ON relation.oid = constraint.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
  ), '[]'::jsonb),
  'indexes', COALESCE((
    SELECT jsonb_agg(to_jsonb(indexes) ORDER BY tablename, indexname)
    FROM pg_indexes indexes
    WHERE schemaname = 'public'
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'identity', format('%I.%I(%s)', namespace.nspname, procedure.proname,
        pg_get_function_identity_arguments(procedure.oid)),
      'definition', pg_get_functiondef(procedure.oid)
    ) ORDER BY procedure.proname, pg_get_function_identity_arguments(procedure.oid))
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
  ), '[]'::jsonb),
  'triggers', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'table', relation.relname,
      'name', trigger.tgname,
      'definition', pg_get_triggerdef(trigger.oid, true)
    ) ORDER BY namespace.nspname, relation.relname, trigger.tgname)
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE NOT trigger.tgisinternal
      AND namespace.nspname IN ('public', 'auth', 'storage')
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT jsonb_agg(to_jsonb(policies) ORDER BY schemaname, tablename, policyname)
    FROM pg_policies policies
    WHERE schemaname IN ('public', 'storage')
  ), '[]'::jsonb),
  'grants', COALESCE((
    SELECT jsonb_agg(to_jsonb(grants) ORDER BY table_schema, table_name, grantee, privilege_type)
    FROM information_schema.role_table_grants grants
    WHERE table_schema IN ('public', 'storage')
  ), '[]'::jsonb),
  'realtime_tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename)
      ORDER BY schemaname, tablename)
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
  ), '[]'::jsonb),
  'replica_identity', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', relation.relname,
      'identity', relation.relreplident
    ) ORDER BY relation.relname)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
  ), '[]'::jsonb),
  'storage_buckets', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types
    ) ORDER BY id)
    FROM storage.buckets
  ), '[]'::jsonb),
  'extensions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', extension.extname,
      'schema', namespace.nspname,
      'version', extension.extversion
    ) ORDER BY extension.extname)
    FROM pg_extension extension
    JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
  ), '[]'::jsonb),
  'types', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', type.typname,
      'kind', type.typtype
    ) ORDER BY type.typname)
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typtype IN ('d', 'e')
  ), '[]'::jsonb)
) AS locally_schema_only_inventory;

ROLLBACK;
