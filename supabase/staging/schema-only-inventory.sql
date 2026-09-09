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
      'owner', pg_get_userbyid(relation.relowner),
      'persistence', relation.relpersistence,
      'rls_enabled', relation.relrowsecurity,
      'rls_forced', relation.relforcerowsecurity,
      'replica_identity', relation.relreplident,
      'options', relation.reloptions,
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
  'views', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', views.table_schema,
      'name', views.table_name,
      'owner', pg_get_userbyid(relation.relowner),
      'definition', views.view_definition,
      'check_option', views.check_option,
      'is_updatable', views.is_updatable,
      'is_insertable_into', views.is_insertable_into,
      'is_trigger_updatable', views.is_trigger_updatable,
      'is_trigger_deletable', views.is_trigger_deletable,
      'is_trigger_insertable_into', views.is_trigger_insertable_into,
      'security_invoker', COALESCE('security_invoker=true' = ANY (relation.reloptions), false),
      'security_barrier', COALESCE('security_barrier=true' = ANY (relation.reloptions), false),
      'options', relation.reloptions
    ) ORDER BY views.table_schema, views.table_name)
    FROM information_schema.views views
    JOIN pg_namespace namespace ON namespace.nspname = views.table_schema
    JOIN pg_class relation
      ON relation.relnamespace = namespace.oid
      AND relation.relname = views.table_name
    WHERE views.table_schema = 'public'
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
  'sequences', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', sequence.relname,
      'owner', pg_get_userbyid(sequence.relowner),
      'data_type', format_type(sequence_parameters.seqtypid, NULL),
      'start', sequence_parameters.seqstart,
      'increment', sequence_parameters.seqincrement,
      'minimum', sequence_parameters.seqmin,
      'maximum', sequence_parameters.seqmax,
      'cache', sequence_parameters.seqcache,
      'cycle', sequence_parameters.seqcycle,
      'owned_by', CASE
        WHEN dependency.refobjid IS NULL THEN NULL
        ELSE format('%I.%I.%I', owned_namespace.nspname, owned_relation.relname, owned_column.attname)
      END,
      'ownership_dependency', dependency.deptype
    ) ORDER BY namespace.nspname, sequence.relname)
    FROM pg_class sequence
    JOIN pg_namespace namespace ON namespace.oid = sequence.relnamespace
    JOIN pg_sequence sequence_parameters ON sequence_parameters.seqrelid = sequence.oid
    LEFT JOIN pg_depend dependency
      ON dependency.classid = 'pg_class'::regclass
      AND dependency.objid = sequence.oid
      AND dependency.refclassid = 'pg_class'::regclass
      AND dependency.deptype IN ('a', 'i')
    LEFT JOIN pg_class owned_relation ON owned_relation.oid = dependency.refobjid
    LEFT JOIN pg_namespace owned_namespace ON owned_namespace.oid = owned_relation.relnamespace
    LEFT JOIN pg_attribute owned_column
      ON owned_column.attrelid = dependency.refobjid
      AND owned_column.attnum = dependency.refobjsubid
    WHERE namespace.nspname = 'public'
      AND sequence.relkind = 'S'
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'identity', format('%I.%I(%s)', namespace.nspname, procedure.proname,
        pg_get_function_identity_arguments(procedure.oid)),
      'owner', pg_get_userbyid(procedure.proowner),
      'kind', procedure.prokind,
      'language', language.lanname,
      'arguments', pg_get_function_arguments(procedure.oid),
      'identity_arguments', pg_get_function_identity_arguments(procedure.oid),
      'result', pg_get_function_result(procedure.oid),
      'security_definer', procedure.prosecdef,
      'volatility', procedure.provolatile,
      'parallel', procedure.proparallel,
      'strict', procedure.proisstrict,
      'returns_set', procedure.proretset,
      'configuration', procedure.proconfig,
      'definition', CASE
        WHEN procedure.prokind = 'a' THEN NULL
        ELSE pg_get_functiondef(procedure.oid)
      END
    ) ORDER BY procedure.proname, pg_get_function_identity_arguments(procedure.oid))
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    JOIN pg_language language ON language.oid = procedure.prolang
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
  'table_and_view_grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', relation.relname,
      'kind', relation.relkind,
      'grantor', pg_get_userbyid(acl.grantor),
      'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
      'privilege', acl.privilege_type,
      'grantable', acl.is_grantable
    ) ORDER BY namespace.nspname, relation.relname, acl.grantee, acl.privilege_type)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) acl
    WHERE namespace.nspname IN ('public', 'storage')
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
  ), '[]'::jsonb),
  'function_execute_grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'identity', format('%I.%I(%s)', namespace.nspname, procedure.proname,
        pg_get_function_identity_arguments(procedure.oid)),
      'grantor', pg_get_userbyid(acl.grantor),
      'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
      'privilege', acl.privilege_type,
      'grantable', acl.is_grantable
    ) ORDER BY procedure.proname, pg_get_function_identity_arguments(procedure.oid), acl.grantee)
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(procedure.proacl, acldefault('f', procedure.proowner))) acl
    WHERE namespace.nspname = 'public'
  ), '[]'::jsonb),
  'sequence_grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', sequence.relname,
      'grantor', pg_get_userbyid(acl.grantor),
      'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
      'privilege', acl.privilege_type,
      'grantable', acl.is_grantable
    ) ORDER BY namespace.nspname, sequence.relname, acl.grantee, acl.privilege_type)
    FROM pg_class sequence
    JOIN pg_namespace namespace ON namespace.oid = sequence.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(sequence.relacl, acldefault('s', sequence.relowner))) acl
    WHERE namespace.nspname = 'public'
      AND sequence.relkind = 'S'
  ), '[]'::jsonb),
  'realtime_tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'publication', pubname,
      'schema', schemaname,
      'table', tablename,
      'columns', attnames,
      'row_filter', rowfilter
    )
      ORDER BY schemaname, tablename)
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
  ), '[]'::jsonb),
  'realtime_publication', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', publication.pubname,
      'owner', pg_get_userbyid(publication.pubowner),
      'all_tables', publication.puballtables,
      'publish_insert', publication.pubinsert,
      'publish_update', publication.pubupdate,
      'publish_delete', publication.pubdelete,
      'publish_truncate', publication.pubtruncate,
      'publish_via_partition_root', publication.pubviaroot
    ) ORDER BY publication.pubname)
    FROM pg_publication publication
    WHERE publication.pubname = 'supabase_realtime'
  ), '[]'::jsonb),
  'replica_identity', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'table', relation.relname,
      'identity_code', relation.relreplident,
      'identity', CASE relation.relreplident
        WHEN 'd' THEN 'DEFAULT'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL'
        WHEN 'i' THEN 'INDEX'
      END,
      'identity_index', pg_get_indexdef(identity_index.indexrelid)
    ) ORDER BY namespace.nspname, relation.relname)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    LEFT JOIN pg_index identity_index
      ON identity_index.indrelid = relation.oid
      AND identity_index.indisreplident
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
  ), '[]'::jsonb),
  'storage_buckets', COALESCE((
    SELECT jsonb_agg(to_jsonb(bucket) - 'owner' - 'owner_id' ORDER BY bucket.id)
    FROM storage.buckets bucket
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
  'custom_types', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'name', type.typname,
      'owner', pg_get_userbyid(type.typowner),
      'kind', type.typtype,
      'category', type.typcategory,
      'not_null', type.typnotnull,
      'default', type.typdefault,
      'base_type', CASE WHEN type.typbasetype = 0 THEN NULL ELSE format_type(type.typbasetype, type.typtypmod) END,
      'enum_labels', CASE WHEN type.typtype = 'e' THEN (
        SELECT jsonb_agg(enum.enumlabel ORDER BY enum.enumsortorder)
        FROM pg_enum enum
        WHERE enum.enumtypid = type.oid
      ) ELSE NULL END,
      'domain_constraints', CASE WHEN type.typtype = 'd' THEN (
        SELECT jsonb_agg(pg_get_constraintdef(constraint.oid, true) ORDER BY constraint.conname)
        FROM pg_constraint constraint
        WHERE constraint.contypid = type.oid
      ) ELSE NULL END,
      'range_subtype', CASE WHEN range.rngsubtype IS NULL THEN NULL ELSE format_type(range.rngsubtype, NULL) END
    ) ORDER BY type.typname)
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    LEFT JOIN pg_class composite_relation ON composite_relation.oid = type.typrelid
    LEFT JOIN pg_range range ON range.rngtypid = type.oid OR range.rngmultitypid = type.oid
    WHERE namespace.nspname = 'public'
      AND (
        type.typtype IN ('d', 'e', 'r', 'm')
        OR (type.typtype = 'c' AND composite_relation.relkind = 'c')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_type'::regclass
          AND dependency.objid = type.oid
          AND dependency.deptype = 'e'
      )
  ), '[]'::jsonb)
) AS locally_schema_only_inventory;

ROLLBACK;
