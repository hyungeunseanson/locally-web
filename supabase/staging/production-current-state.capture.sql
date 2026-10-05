-- Schema/catalog metadata only. No application rows or Storage objects.
-- Captured read-only from Production on 2026-10-05T12:52:08.492578+00:00.
BEGIN TRANSACTION READ ONLY;
WITH relations AS (
 SELECT c.*,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')
)
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),'postgres',current_setting('server_version'),
 'ledger',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementsMd5',md5(array_to_string(statements,E'\n')),'statementsSha256',encode(sha256(convert_to(array_to_string(statements,E'\n'),'UTF8')),'hex')) ORDER BY version) FROM supabase_migrations.schema_migrations),
 'relations',(SELECT jsonb_agg(jsonb_build_object('schema',nspname,'name',relname,'kind',relkind,'rls',relrowsecurity,'force',relforcerowsecurity) ORDER BY nspname,relname) FROM relations WHERE relkind IN ('r','p','v','m')),
 'columns',(SELECT jsonb_object_agg(key,count) FROM (SELECT table_schema||'.'||table_name key,count(*) FROM information_schema.columns WHERE table_schema IN ('public','private') GROUP BY table_schema,table_name) c),
 'functions',(SELECT jsonb_agg(jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'result',pg_get_function_result(p.oid),'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private')),
 'triggers',(SELECT jsonb_agg(format('%I.%I.%I',n.nspname,c.relname,t.tgname) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth')),
 'indexes',(SELECT jsonb_object_agg(schemaname,cnt) FROM (SELECT schemaname,count(*) cnt FROM pg_indexes WHERE schemaname IN ('public','private') GROUP BY schemaname) i),
 'constraints',(SELECT jsonb_object_agg(nspname,counts) FROM (SELECT r.nspname,jsonb_build_object('total',count(*),'primaryKey',count(*) FILTER(WHERE contype='p'),'foreignKey',count(*) FILTER(WHERE contype='f'),'unique',count(*) FILTER(WHERE contype='u'),'check',count(*) FILTER(WHERE contype='c')) counts FROM pg_constraint c JOIN relations r ON r.oid=c.conrelid GROUP BY r.nspname) c),
 'policies',(SELECT jsonb_object_agg(schemaname,cnt) FROM (SELECT schemaname,count(*) cnt FROM pg_policies WHERE schemaname IN ('public','private') GROUP BY schemaname) p),
 'realtimeTables',(SELECT jsonb_agg(tablename ORDER BY tablename) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public'),
 'storageBuckets',(SELECT jsonb_agg(jsonb_build_object('name',id,'public',public,'fileSizeLimit',file_size_limit) ORDER BY id) FROM storage.buckets),
 'storageObjectPolicies',(SELECT jsonb_agg(policyname ORDER BY policyname) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'),
 'p0OperationTablePresent',to_regclass('public.booking_solo_refund_operations') IS NOT NULL
) AS evidence;
ROLLBACK;
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object('publicRlsPolicies',(SELECT md5(string_agg(
           policy_def.schemaname || '|' || policy_def.tablename || '|' ||
           policy_def.policyname || '|' || policy_def.permissive || '|' ||
           policy_def.cmd || '|' || array_to_string(policy_def.roles, ',') || '|' ||
           coalesce(policy_def.qual, '') || '|' || coalesce(policy_def.with_check, ''),
           E'\n' ORDER BY policy_def.schemaname, policy_def.tablename, policy_def.policyname
         ))
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'public'),'publicRelationGrants',(SELECT md5(string_agg(
           namespace_def.nspname || '|' || class_def.relname || '|' ||
           class_def.relkind::text || '|' ||
           CASE WHEN acl_entry.grantee = 0
             THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee)
           END || '|' || acl_entry.privilege_type || '|' || acl_entry.is_grantable::text,
           E'\n' ORDER BY namespace_def.nspname, class_def.relname,
             class_def.relkind::text,
             CASE WHEN acl_entry.grantee = 0
               THEN 'PUBLIC' ELSE pg_get_userbyid(acl_entry.grantee)
             END,
             acl_entry.privilege_type, acl_entry.is_grantable
         ))
    FROM pg_class AS class_def
    JOIN pg_namespace AS namespace_def ON namespace_def.oid = class_def.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(
      class_def.relacl,
      acldefault('r', class_def.relowner)
    )) AS acl_entry
   WHERE namespace_def.nspname = 'public'
     AND class_def.relkind IN ('r', 'p', 'v', 'm', 'f')),'storageBuckets',(SELECT md5(string_agg(
           bucket_def.id || '|' || bucket_def.name || '|' || bucket_def.public::text || '|' ||
           coalesce(bucket_def.file_size_limit::text, '') || '|' ||
           coalesce(array_to_string(bucket_def.allowed_mime_types, ','), ''),
           E'\n' ORDER BY bucket_def.id
         ))
    FROM storage.buckets AS bucket_def),'storagePolicies',(SELECT md5(string_agg(
           policy_def.schemaname || '|' || policy_def.tablename || '|' ||
           policy_def.policyname || '|' || policy_def.permissive || '|' ||
           policy_def.cmd || '|' || array_to_string(policy_def.roles, ',') || '|' ||
           coalesce(policy_def.qual, '') || '|' || coalesce(policy_def.with_check, ''),
           E'\n' ORDER BY policy_def.schemaname, policy_def.tablename, policy_def.policyname
         ))
    FROM pg_policies AS policy_def
   WHERE policy_def.schemaname = 'storage' AND policy_def.tablename = 'objects'),'privateAttentionRelationGrants',(SELECT md5(string_agg(n.nspname || '|' || c.relname || '|' || c.relkind::text || '|' ||
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || '|' || a.privilege_type || '|' || a.is_grantable::text,
    E'\n' ORDER BY n.nspname,c.relname,c.relkind::text,CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname = 'private' AND c.relkind IN ('r','p','v','m','f') AND c.relname <> 'phone_followup_tasks'),'privateRelationGrants',(SELECT md5(string_agg(n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END||'|'||a.privilege_type||'|'||a.is_grantable::text,
    E'\n' ORDER BY n.nspname,c.relname,c.relkind::text,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='private' AND c.relkind IN ('r','p','v','m','f'))) AS fingerprints;
ROLLBACK;
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
 'indexes',(SELECT jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename IN ('media_assets','media_asset_references','media_deletion_journal')),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,true)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('media_assets','media_asset_references','media_deletion_journal')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname IN ('experience_media_revision','experience_media_finalize','experience_media_delete_plan','profile_avatar_finalize','profile_avatar_delete_plan'))
) AS media_catalog;
ROLLBACK;
