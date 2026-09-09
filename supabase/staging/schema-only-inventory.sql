\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

BEGIN READ ONLY;

SELECT jsonb_build_object(
  'tables_and_views', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', nsp.nspname,
      'name', cls.relname,
      'kind', cls.relkind,
      'owner', pg_get_userbyid(cls.relowner),
      'persistence', cls.relpersistence,
      'rls_enabled', cls.relrowsecurity,
      'rls_forced', cls.relforcerowsecurity,
      'replica_identity', cls.relreplident,
      'options', cls.reloptions,
      'definition', CASE
        WHEN cls.relkind = 'v' THEN pg_get_viewdef(cls.oid, true)
        WHEN cls.relkind = 'm' THEN pg_get_viewdef(cls.oid, true)
        ELSE NULL
      END
    ) ORDER BY nsp.nspname, cls.relname)
    FROM pg_class AS cls
    JOIN pg_namespace AS nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relkind IN ('r', 'p', 'v', 'm')
  ), '[]'::jsonb),
  'views', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', view_meta.table_schema,
      'name', view_meta.table_name,
      'owner', pg_get_userbyid(view_cls.relowner),
      'definition', view_meta.view_definition,
      'check_option', view_meta.check_option,
      'is_updatable', view_meta.is_updatable,
      'is_insertable_into', view_meta.is_insertable_into,
      'is_trigger_updatable', view_meta.is_trigger_updatable,
      'is_trigger_deletable', view_meta.is_trigger_deletable,
      'is_trigger_insertable_into', view_meta.is_trigger_insertable_into,
      'security_invoker', COALESCE('security_invoker=true' = ANY (view_cls.reloptions), false),
      'security_barrier', COALESCE('security_barrier=true' = ANY (view_cls.reloptions), false),
      'options', view_cls.reloptions
    ) ORDER BY view_meta.table_schema, view_meta.table_name)
    FROM information_schema.views AS view_meta
    JOIN pg_namespace AS view_nsp ON view_nsp.nspname = view_meta.table_schema
    JOIN pg_class AS view_cls
      ON view_cls.relnamespace = view_nsp.oid
      AND view_cls.relname = view_meta.table_name
    WHERE view_meta.table_schema = 'public'
  ), '[]'::jsonb),
  'columns', COALESCE((
    SELECT jsonb_agg(to_jsonb(column_meta) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns AS column_meta
    WHERE table_schema = 'public'
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', constrained_cls.relname,
      'name', con_def.conname,
      'type', con_def.contype,
      'definition', pg_get_constraintdef(con_def.oid, true)
    ) ORDER BY constrained_cls.relname, con_def.conname)
    FROM pg_constraint AS con_def
    JOIN pg_class AS constrained_cls ON constrained_cls.oid = con_def.conrelid
    JOIN pg_namespace AS constrained_nsp ON constrained_nsp.oid = constrained_cls.relnamespace
    WHERE constrained_nsp.nspname = 'public'
  ), '[]'::jsonb),
  'indexes', COALESCE((
    SELECT jsonb_agg(to_jsonb(index_meta) ORDER BY tablename, indexname)
    FROM pg_indexes AS index_meta
    WHERE schemaname = 'public'
  ), '[]'::jsonb),
  'sequences', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', seq_nsp.nspname,
      'name', seq_cls.relname,
      'owner', pg_get_userbyid(seq_cls.relowner),
      'data_type', format_type(seq_meta.seqtypid, NULL),
      'start', seq_meta.seqstart,
      'increment', seq_meta.seqincrement,
      'minimum', seq_meta.seqmin,
      'maximum', seq_meta.seqmax,
      'cache', seq_meta.seqcache,
      'cycle', seq_meta.seqcycle,
      'owned_by', CASE
        WHEN seq_dependency.refobjid IS NULL THEN NULL
        ELSE format('%I.%I.%I', owned_nsp.nspname, owned_cls.relname, owned_attr.attname)
      END,
      'ownership_dependency', seq_dependency.deptype
    ) ORDER BY seq_nsp.nspname, seq_cls.relname)
    FROM pg_class AS seq_cls
    JOIN pg_namespace AS seq_nsp ON seq_nsp.oid = seq_cls.relnamespace
    JOIN pg_sequence AS seq_meta ON seq_meta.seqrelid = seq_cls.oid
    LEFT JOIN pg_depend AS seq_dependency
      ON seq_dependency.classid = 'pg_class'::regclass
      AND seq_dependency.objid = seq_cls.oid
      AND seq_dependency.refclassid = 'pg_class'::regclass
      AND seq_dependency.deptype IN ('a', 'i')
    LEFT JOIN pg_class AS owned_cls ON owned_cls.oid = seq_dependency.refobjid
    LEFT JOIN pg_namespace AS owned_nsp ON owned_nsp.oid = owned_cls.relnamespace
    LEFT JOIN pg_attribute AS owned_attr
      ON owned_attr.attrelid = seq_dependency.refobjid
      AND owned_attr.attnum = seq_dependency.refobjsubid
    WHERE seq_nsp.nspname = 'public'
      AND seq_cls.relkind = 'S'
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'identity', format('%I.%I(%s)', proc_nsp.nspname, proc_def.proname,
        pg_get_function_identity_arguments(proc_def.oid)),
      'owner', pg_get_userbyid(proc_def.proowner),
      'kind', proc_def.prokind,
      'language', proc_language.lanname,
      'arguments', pg_get_function_arguments(proc_def.oid),
      'identity_arguments', pg_get_function_identity_arguments(proc_def.oid),
      'result', pg_get_function_result(proc_def.oid),
      'security_definer', proc_def.prosecdef,
      'volatility', proc_def.provolatile,
      'parallel', proc_def.proparallel,
      'strict', proc_def.proisstrict,
      'returns_set', proc_def.proretset,
      'configuration', proc_def.proconfig,
      'definition', CASE
        WHEN proc_def.prokind = 'a' THEN NULL
        ELSE pg_get_functiondef(proc_def.oid)
      END
    ) ORDER BY proc_def.proname, pg_get_function_identity_arguments(proc_def.oid))
    FROM pg_proc AS proc_def
    JOIN pg_namespace AS proc_nsp ON proc_nsp.oid = proc_def.pronamespace
    JOIN pg_language AS proc_language ON proc_language.oid = proc_def.prolang
    WHERE proc_nsp.nspname = 'public'
  ), '[]'::jsonb),
  'triggers', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', trigger_nsp.nspname,
      'table', trigger_cls.relname,
      'name', trigger_def.tgname,
      'definition', pg_get_triggerdef(trigger_def.oid, true)
    ) ORDER BY trigger_nsp.nspname, trigger_cls.relname, trigger_def.tgname)
    FROM pg_trigger AS trigger_def
    JOIN pg_class AS trigger_cls ON trigger_cls.oid = trigger_def.tgrelid
    JOIN pg_namespace AS trigger_nsp ON trigger_nsp.oid = trigger_cls.relnamespace
    WHERE NOT trigger_def.tgisinternal
      AND trigger_nsp.nspname IN ('public', 'auth', 'storage')
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT jsonb_agg(to_jsonb(policy_meta) ORDER BY schemaname, tablename, policyname)
    FROM pg_policies AS policy_meta
    WHERE schemaname IN ('public', 'storage')
  ), '[]'::jsonb),
  'table_and_view_grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', grant_nsp.nspname,
      'name', grant_cls.relname,
      'kind', grant_cls.relkind,
      'grantor', pg_get_userbyid(acl_entry.grantor),
      'grantee', CASE WHEN acl_entry.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee) END,
      'privilege', acl_entry.privilege_type,
      'grantable', acl_entry.is_grantable
    ) ORDER BY grant_nsp.nspname, grant_cls.relname, acl_entry.grantee, acl_entry.privilege_type)
    FROM pg_class AS grant_cls
    JOIN pg_namespace AS grant_nsp ON grant_nsp.oid = grant_cls.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(grant_cls.relacl, acldefault('r', grant_cls.relowner))) AS acl_entry
    WHERE grant_nsp.nspname IN ('public', 'storage')
      AND grant_cls.relkind IN ('r', 'p', 'v', 'm', 'f')
  ), '[]'::jsonb),
  'function_execute_grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'identity', format('%I.%I(%s)', grant_proc_nsp.nspname, grant_proc.proname,
        pg_get_function_identity_arguments(grant_proc.oid)),
      'grantor', pg_get_userbyid(acl_entry.grantor),
      'grantee', CASE WHEN acl_entry.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee) END,
      'privilege', acl_entry.privilege_type,
      'grantable', acl_entry.is_grantable
    ) ORDER BY grant_proc.proname, pg_get_function_identity_arguments(grant_proc.oid), acl_entry.grantee)
    FROM pg_proc AS grant_proc
    JOIN pg_namespace AS grant_proc_nsp ON grant_proc_nsp.oid = grant_proc.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(grant_proc.proacl, acldefault('f', grant_proc.proowner))) AS acl_entry
    WHERE grant_proc_nsp.nspname = 'public'
  ), '[]'::jsonb),
  'sequence_grants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', grant_seq_nsp.nspname,
      'name', grant_seq.relname,
      'grantor', pg_get_userbyid(acl_entry.grantor),
      'grantee', CASE WHEN acl_entry.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee) END,
      'privilege', acl_entry.privilege_type,
      'grantable', acl_entry.is_grantable
    ) ORDER BY grant_seq_nsp.nspname, grant_seq.relname, acl_entry.grantee, acl_entry.privilege_type)
    FROM pg_class AS grant_seq
    JOIN pg_namespace AS grant_seq_nsp ON grant_seq_nsp.oid = grant_seq.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(grant_seq.relacl, acldefault('s', grant_seq.relowner))) AS acl_entry
    WHERE grant_seq_nsp.nspname = 'public'
      AND grant_seq.relkind = 'S'
  ), '[]'::jsonb),
  'realtime_tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'publication', publication_table.pubname,
      'schema', publication_table.schemaname,
      'table', publication_table.tablename,
      'columns', publication_table.attnames,
      'row_filter', publication_table.rowfilter
    )
      ORDER BY publication_table.schemaname, publication_table.tablename)
    FROM pg_publication_tables AS publication_table
    WHERE publication_table.pubname = 'supabase_realtime'
  ), '[]'::jsonb),
  'realtime_publication', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', publication_def.pubname,
      'owner', pg_get_userbyid(publication_def.pubowner),
      'all_tables', publication_def.puballtables,
      'publish_insert', publication_def.pubinsert,
      'publish_update', publication_def.pubupdate,
      'publish_delete', publication_def.pubdelete,
      'publish_truncate', publication_def.pubtruncate,
      'publish_via_partition_root', publication_def.pubviaroot
    ) ORDER BY publication_def.pubname)
    FROM pg_publication AS publication_def
    WHERE publication_def.pubname = 'supabase_realtime'
  ), '[]'::jsonb),
  'replica_identity', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', replica_nsp.nspname,
      'table', replica_cls.relname,
      'identity_code', replica_cls.relreplident,
      'identity', CASE replica_cls.relreplident
        WHEN 'd' THEN 'DEFAULT'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL'
        WHEN 'i' THEN 'INDEX'
      END,
      'identity_index', pg_get_indexdef(replica_index.indexrelid)
    ) ORDER BY replica_nsp.nspname, replica_cls.relname)
    FROM pg_class AS replica_cls
    JOIN pg_namespace AS replica_nsp ON replica_nsp.oid = replica_cls.relnamespace
    LEFT JOIN pg_index AS replica_index
      ON replica_index.indrelid = replica_cls.oid
      AND replica_index.indisreplident
    WHERE replica_nsp.nspname = 'public'
      AND replica_cls.relkind IN ('r', 'p')
  ), '[]'::jsonb),
  'storage_buckets', COALESCE((
    SELECT jsonb_agg(to_jsonb(bucket_meta) - 'owner' - 'owner_id' ORDER BY bucket_meta.id)
    FROM storage.buckets AS bucket_meta
  ), '[]'::jsonb),
  'extensions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', extension_def.extname,
      'schema', extension_nsp.nspname,
      'version', extension_def.extversion
    ) ORDER BY extension_def.extname)
    FROM pg_extension AS extension_def
    JOIN pg_namespace AS extension_nsp ON extension_nsp.oid = extension_def.extnamespace
  ), '[]'::jsonb),
  'custom_types', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', type_nsp.nspname,
      'name', type_def.typname,
      'owner', pg_get_userbyid(type_def.typowner),
      'kind', type_def.typtype,
      'category', type_def.typcategory,
      'not_null', type_def.typnotnull,
      'default', type_def.typdefault,
      'base_type', CASE WHEN type_def.typbasetype = 0 THEN NULL ELSE format_type(type_def.typbasetype, type_def.typtypmod) END,
      'enum_labels', CASE WHEN type_def.typtype = 'e' THEN (
        SELECT jsonb_agg(enum_value.enumlabel ORDER BY enum_value.enumsortorder)
        FROM pg_enum AS enum_value
        WHERE enum_value.enumtypid = type_def.oid
      ) ELSE NULL END,
      'domain_constraints', CASE WHEN type_def.typtype = 'd' THEN (
        SELECT jsonb_agg(pg_get_constraintdef(domain_constraint.oid, true) ORDER BY domain_constraint.conname)
        FROM pg_constraint AS domain_constraint
        WHERE domain_constraint.contypid = type_def.oid
      ) ELSE NULL END,
      'range_subtype', CASE WHEN range_meta.rngsubtype IS NULL THEN NULL ELSE format_type(range_meta.rngsubtype, NULL) END
    ) ORDER BY type_def.typname)
    FROM pg_type AS type_def
    JOIN pg_namespace AS type_nsp ON type_nsp.oid = type_def.typnamespace
    LEFT JOIN pg_class AS composite_cls ON composite_cls.oid = type_def.typrelid
    LEFT JOIN pg_range AS range_meta ON range_meta.rngtypid = type_def.oid OR range_meta.rngmultitypid = type_def.oid
    WHERE type_nsp.nspname = 'public'
      AND (
        type_def.typtype IN ('d', 'e', 'r', 'm')
        OR (type_def.typtype = 'c' AND composite_cls.relkind = 'c')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend AS type_dependency
        WHERE type_dependency.classid = 'pg_type'::regclass
          AND type_dependency.objid = type_def.oid
          AND type_dependency.deptype = 'e'
      )
  ), '[]'::jsonb)
) AS locally_schema_only_inventory;

ROLLBACK;
