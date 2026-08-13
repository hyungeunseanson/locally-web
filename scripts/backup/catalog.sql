\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SELECT jsonb_build_object(
  'generated_at', now(),
  'server_version_num', current_setting('server_version_num'),
  'counts', jsonb_build_object(
    'auth.users', (SELECT count(*) FROM auth.users),
    'storage.buckets', (SELECT count(*) FROM storage.buckets),
    'storage.objects', (SELECT count(*) FROM storage.objects),
    'public.profiles', (SELECT count(*) FROM public.profiles),
    'public.users', (SELECT count(*) FROM public.users),
    'public.inquiries', (SELECT count(*) FROM public.inquiries),
    'public.inquiry_messages', (SELECT count(*) FROM public.inquiry_messages)
  ),
  'policies_definition_digest', md5(COALESCE((
    SELECT string_agg(
      concat_ws('|', schemaname, tablename, policyname, permissive, roles::text, cmd,
        COALESCE(qual, ''), COALESCE(with_check, '')),
      E'\n' ORDER BY schemaname, tablename, policyname
    )
    FROM pg_policies
    WHERE schemaname IN ('public', 'auth', 'storage')
  ), '')),
  'functions_definition_digest', md5(COALESCE((
    SELECT string_agg(pg_get_functiondef(proc.oid), E'\n' ORDER BY namespace.nspname, proc.proname, proc.oid)
    FROM pg_proc AS proc
    JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname IN ('public', 'auth', 'storage')
  ), '')),
  'triggers_definition_digest', md5(COALESCE((
    SELECT string_agg(pg_get_triggerdef(trigger.oid, true), E'\n' ORDER BY trigger.oid)
    FROM pg_trigger AS trigger
    JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE NOT trigger.tgisinternal AND namespace.nspname IN ('public', 'auth', 'storage')
  ), '')),
  'table_grants_digest', md5(COALESCE((
    SELECT string_agg(
      concat_ws('|', table_schema, table_name, grantee, privilege_type, is_grantable),
      E'\n' ORDER BY table_schema, table_name, grantee, privilege_type
    )
    FROM information_schema.role_table_grants
    WHERE table_schema IN ('public', 'auth', 'storage')
  ), '')),
  'realtime_tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename)
      ORDER BY schemaname, tablename)
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
  ), '[]'::jsonb),
  'storage_note', 'Storage metadata is included; Storage object bytes are not included.'
);
