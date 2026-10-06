-- Schema/catalog metadata only. No application rows or Storage objects.
-- Captured read-only from Production on 2026-10-06T15:16:07.294874+00:00.
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

BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND (c.relname IN ('booking_solo_refund_operations','booking_solo_refund_attempts') OR (c.relname='bookings' AND a.attname LIKE 'cancellation_%') OR (c.relname='notifications' AND a.attname LIKE 'solo_refund_%'))),
'indexes',(SELECT jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND (tablename IN ('booking_solo_refund_operations','booking_solo_refund_attempts') OR indexname='notifications_solo_refund_once')),
'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,true)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (c.relname IN ('booking_solo_refund_operations','booking_solo_refund_attempts') OR k.conname='bookings_solo_guarantee_refund_status_check')),
'functions',(SELECT jsonb_agg(jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'result',pg_get_function_result(p.oid),'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname IN ('journal_solo_refund_attempt','lock_booking_money','solo_refund_due','assert_booking_payout_safe','guard_booking_money_transition','guard_unresolved_booking_delete','claim_solo_refund_atomic','begin_solo_refund_request_atomic','record_solo_refund_outcome_atomic','apply_solo_refund_settlement_atomic','complete_manual_solo_refund_atomic','reconcile_solo_refund_accepted_atomic','recover_solo_refunds_atomic','reconcile_solo_refund_rejected_atomic','deliver_solo_refund_notification_atomic','mark_solo_refund_delivery_failed_atomic','retry_solo_refund_delivery_atomic','solo_refund_diagnostics','claim_booking_cancellation_atomic','finalize_booking_cancellation_atomic','settle_experience_payouts_atomic','finalize_released_card_refund_atomic','retry_rejected_solo_refund_atomic','complete_admin_manual_experience_payout_atomic','complete_experience_booking_if_due_atomic')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname IN ('bookings_money_transition_authority','bookings_unresolved_money_delete','solo_refund_attempt_journal','bookings_payment_claim_columns_server_only'))
) AS financial_catalog;
ROLLBACK;

-- Host catalog only; never invoke inventory/CAS functions or inspect Auth rows.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'result',pg_get_function_result(p.oid),'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname LIKE '%host_profile%'),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,true)) ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='private' AND c.relname LIKE 'host_profile%') OR k.conname='host_profile_media_identity'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND p.proname LIKE '%host_profile%'),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',c.relacl::text) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relname LIKE 'host_profile%' AND c.relkind='r'),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='private' AND c.relname LIKE 'host_profile%' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'name',indexname,'definition',indexdef) ORDER BY schemaname,indexname) FROM pg_indexes WHERE schemaname='private' AND tablename LIKE 'host_profile%'),
 'authority',(SELECT jsonb_agg(jsonb_build_object('singleton',singleton,'r2_enabled',r2_enabled)) FROM private.host_profile_source_authority)
) AS host_catalog;
ROLLBACK;

-- Read-only Recency catalog/ledger. No customer rows or RPC calls.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=public,extensions;
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'result',pg_get_function_result(p.oid),'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc)) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('list_admin_phone_recency','list_admin_support_recency')),
 'index',(SELECT jsonb_build_object('schema','public','table','inquiry_messages','name',c.relname,'definition',pg_get_indexdef(c.oid),'predicate',pg_get_expr(i.indpred,i.indrelid),'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready) FROM pg_class c JOIN pg_index i ON i.indexrelid=c.oid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='admin_chat_visible_message_recency'),
 'ledgerEvidence',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementsMd5',md5(statements[1]),'statementsSha256',encode(sha256(convert_to(statements[1],'UTF8')),'hex'))) FROM supabase_migrations.schema_migrations WHERE version='20261006133015')
) AS recency_catalog;
ROLLBACK;

-- Read-only Community catalog/control metadata; no customer/object rows.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=public,extensions;
SELECT jsonb_build_object('observedAt',now(),'ledger',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name,'statementCount',cardinality(statements),'statementsMd5',md5(statements[1]),'statementsSha256',encode(sha256(convert_to(statements[1],'UTF8')),'hex')) ORDER BY version) FROM supabase_migrations.schema_migrations),
'functions',(SELECT jsonb_agg(jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'result',pg_get_function_result(p.oid),'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.proname LIKE '%community%'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,true)) ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='private' AND c.relname LIKE 'community_media%') OR k.conname='community_media_identity'),
'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND p.proname LIKE '%community%'),
'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',c.relacl::text) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relname LIKE 'community_media%' AND c.relkind='r'),
'columns',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',coalesce(pg_get_expr(d.adbin,d.adrelid),'')) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE ((n.nspname='private' AND c.relname LIKE 'community_media%') OR (n.nspname='public' AND c.relname='community_posts' AND a.attname='media_revision')) AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
'indexes',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'name',indexname,'definition',indexdef) ORDER BY schemaname,indexname) FROM pg_indexes WHERE schemaname='private' AND tablename LIKE 'community_media%'),
'authority',(SELECT jsonb_agg(jsonb_build_object('singleton',singleton,'legacy_writes_frozen',legacy_writes_frozen)) FROM private.community_media_authority),
'publicFunctionOverloads',(SELECT jsonb_agg(format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
'privateFunctionOverloads',(SELECT jsonb_agg(format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.prokind='f'),
'counts',jsonb_build_object('publicColumns',(SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),'privateColumns',(SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),'publicConstraints',(SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='public'),'privateConstraints',(SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='private'),'publicIndexes',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'),'privateIndexes',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='i')),
'privateGrantsFingerprint',(SELECT md5(string_agg(n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END||'|'||a.privilege_type||'|'||a.is_grantable::text,E'\n' ORDER BY n.nspname,c.relname,c.relkind::text,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='private' AND c.relkind IN ('r','p','v','m','f'))) AS community_catalog;
ROLLBACK;
