// Local regression fixture. Binds native PostgreSQL exclusively to 127.0.0.1.
// Executes current application helpers and read-only-captured Production RPC definitions
// against disposable synthetic rows. Never accepts a remote database URL or real PG key.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import crypto from 'node:crypto';
import { LEDGER_BOOKING_FIELDS, prepareLedgerReconciliationProof } from '../../scripts/financial/solo-refund-ledger-proof.mjs';
const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../..');
if (!process.env.SOLO_PG17_MODULES) throw new Error('Set SOLO_PG17_MODULES to external embedded-postgres@17 / pg / esbuild node_modules');
const require = createRequire(join(process.env.SOLO_PG17_MODULES, '..', 'package.json'));
const EmbeddedPostgres = require('embedded-postgres').default;
const { build } = require('esbuild');
const { types } = require('pg');
types.setTypeParser(1082, value => value);
const fixture = JSON.parse(await readFile(join(here,'fixtures/solo-pre-p0-schema.json'),'utf8'));
const prod = { schema_columns: fixture.columns, production_catalog: { evidence: { constraints: fixture.constraints, triggers: [fixture.trigger] } }, definitions: { parsed: [{ definitions: fixture.definitions }] } };
const dir = await mkdtemp(join(tmpdir(),'locally-solo-native-'));
await build({
  stdin: { contents: [
    "export * from './app/utils/bookings/soloGuaranteeRefund.ts';",
    "export * from './app/utils/bookings/cancellationAuthority.ts';",
    "export { POST as cancelRoute } from './app/api/payment/cancel/route.ts';",
    "export { POST as forceCancelRoute } from './app/api/admin/bookings/force-cancel/route.ts';",
    "export { POST as rejectReviewRoute } from './app/api/admin/bookings/reject-host-unavailable/route.ts';",
    "export { POST as reconcileRoute } from './app/api/admin/bookings/solo-guarantee-refund/operations/route.ts';",
    "export { finalizeExperienceCardPayment } from './app/api/payment/experienceCardConfirmation.ts';",
    "export * from './app/utils/bookings/pendingBookingHolds.ts';",
    "export * from './app/utils/bookings/soloGuaranteeRefundPolicy.ts';",
    "export * from './app/utils/bookingFinance.ts';",
    "export * from './app/utils/adminPayouts.ts';",
    "export { finishSettlementSyncRunSuccess } from './app/utils/settlementSync/jobRuns.ts';",
    "export * from './app/utils/soloGuaranteeRefundStatus.ts';",
    "export * from './app/constants/soloGuarantee.ts';",
    "export * from './app/utils/payments/card/server.ts';",
    "export * from './app/utils/hostEarningsSummary.ts';",
    "export * from './app/admin/dashboard/components/masterLedgerPaymentBreakdown.ts';"
  ].join('\n'), resolveDir:root, loader:'ts'},
  outfile:join(dir,'helpers.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external',
  tsconfig:join(root,'tsconfig.json'),
  plugins:[{name:'audit-external-boundary',setup(b){
    b.onResolve({filter:/^next\/server$/},()=>({path:join(root,'node_modules/next/server.js'),external:true}));
    b.onResolve({filter:/^next\/cache$|server-only|adminEmailProvider|supabase\/(admin|server)|adminAccess|adminAlertCenter|emailNotificationJobs|notificationCopy|monitoring\/sentry/},args=>({path:args.path,namespace:'audit-stub'}));
    b.onLoad({filter:/.*/,namespace:'audit-stub'},()=>({contents:
      `export function createAdminClient(){return globalThis.__soloRouteDb;}
       export async function createClient(){return {auth:{getUser:async()=>({data:{user:globalThis.__soloRouteUser},error:null})}};}
       export async function resolveAdminAccess(_db,user){return {isAdmin:user.userId==='44444444-4444-4444-8444-444444444444'};}
       export function revalidatePath(){} export async function recordAuditLog(){} export async function insertAdminAlerts(){}
       export async function sendAdminPaymentConfirmedEmail(){throw new Error('External email forbidden in test');}
       export async function sendImmediateGenericEmail(){} export function captureServerException(){}
       export async function buildLocalizedNotificationInsert(x){return {user_id:x.userId,type:x.type,title:'Synthetic',message:'Synthetic',link:x.link,is_read:false};}
       export async function sendImmediateAdminEmail(){throw new Error('External email forbidden in test');}`,loader:'js'}));
  }}]
});
const m = require(join(dir,'helpers.cjs'));
const server = createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port; await new Promise(r=>server.close(r));
const pg = new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:'audit-local-only',port,persistent:false,
  postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}});
const clients=[]; const checks=[];
const record=(name,result)=>{checks.push({name,...result});console.log(name+' '+JSON.stringify(result));};
const G='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',H='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444';
const gate=()=>{let done;const promise=new Promise(r=>done=r);return {promise,open:done};};
class Query {
  constructor(client,table,hooks={}){this.client=client;this.table=table;this.hooks=hooks;this.filters=[];this.orders=[];this.mode='select';this.selected=false;}
  select(columns='*',options={}){this.selected=true;this.columns=columns;this.options=options;return this;}
  update(value){this.mode='update';this.value=value;return this;}
  insert(value){this.mode='insert';this.value=value;return this;}
  eq(c,v){this.filters.push([c,'=',v]);return this;}
  gt(c,v){this.filters.push([c,'>',v]);return this;}
  in(c,v){this.filters.push([c,'IN',v]);return this;}
  is(c,v){this.filters.push([c,'IS',v]);return this;}
  order(c,o={}){this.orders.push([c,o.ascending!==false,o.nullsFirst]);return this;}
  range(a,b){this.offset=a;this.limitValue=b-a+1;return this;}
  limit(n){this.limitValue=n;return this;}
  maybeSingle(){return this.execute(true);}
  single(){return this.execute(true);}
  then(a,b){return this.execute(false).then(a,b);}
  async execute(single){
    const meta={table:this.table,mode:this.mode,value:this.value,filters:this.filters};
    const override=await this.hooks.before?.(meta);
    if(override)return override;
    const params=[];
    const quote=s=>'"'+s.replaceAll('"','""')+'"';
    const bind=v=>{params.push(v);return '$'+params.length;};
    const where=this.filters.map(([c,op,v])=> {
      if(op==='IS')return quote(c)+(v===null?' IS NULL':' IS NOT DISTINCT FROM '+bind(v));
      if(op==='IN')return quote(c)+' = ANY('+bind(v)+')';
      return quote(c)+' '+op+' '+bind(v);
    }).join(' AND ');
    let sql;
    if(this.mode==='update'){
      sql='UPDATE public.'+quote(this.table)+' SET '+Object.entries(this.value).map(([k,v])=>quote(k)+'='+bind(v)).join(',')+(where?' WHERE '+where:'')+' RETURNING *';
    }else if(this.mode==='insert'){
      const values=Array.isArray(this.value)?this.value:[this.value],keys=Object.keys(values[0]);
      sql='INSERT INTO public.'+quote(this.table)+' ('+keys.map(quote).join(',')+') VALUES '+values.map(row=>'('+keys.map(k=>bind(row[k])).join(',')+')').join(',')+' RETURNING *';
    }else{
      sql='SELECT * FROM public.'+quote(this.table)+(where?' WHERE '+where:'');
      if(this.orders.length)sql+=' ORDER BY '+this.orders.map(([c,asc,nf])=>quote(c)+(asc?' ASC':' DESC')+(nf===false?' NULLS LAST':'')).join(',');
      if(this.limitValue!=null)sql+=' LIMIT '+Number(this.limitValue);
      if(this.offset!=null)sql+=' OFFSET '+Number(this.offset);
    }
    try{
      const r=await this.client.query(sql,params);
      let rows=r.rows;
      if(this.table==='bookings'&&this.columns?.includes('experiences(')){
        for(const row of rows){row.experiences=(await this.client.query('SELECT title,host_id,duration FROM experiences WHERE id=$1',[row.experience_id])).rows[0]||null;}
      }
      const result={data:this.options?.head?null:single?(rows[0]||null):rows,error:null,count:this.options?.count==='exact'?r.rowCount:null};
      return (await this.hooks.after?.(meta,result))||result;
    }catch(e){return {data:null,error:{message:e.message,code:e.code},count:null};}
  }
}
const adapter=(client,hooks={})=>({from:table=>new Query(client,table,hooks),
 auth:{admin:{getUserById:async()=>({data:{user:{user_metadata:{preferred_locale:'en'}}},error:null})}},
 async rpc(name,args={}) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid fixture RPC');
  const meta={name,args}; const override=await hooks.beforeRpc?.(meta); if(override)return override;
  try { const keys=Object.keys(args); const result=await client.query('SELECT * FROM public.'+name+'('+keys.map((k,i)=>k+' => $'+(i+1)).join(',')+')',keys.map(k=>k==='p_notifications'?JSON.stringify(args[k]):args[k]));
    const value={data:name==='solo_refund_diagnostics'?result.rows[0].solo_refund_diagnostics:name==='deliver_solo_refund_notification_atomic'?result.rows[0].deliver_solo_refund_notification_atomic:result.rows,error:null};
    return (await hooks.afterRpc?.(meta,value))||value;
  } catch(e){return {data:null,error:{message:e.message,code:e.code}};}
 }});
try{
  await pg.initialise();await pg.start();
  for(let i=0;i<4;i++){const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);}
  const [setup,c1,c2,c3]=clients;
  const version=(await setup.query("SELECT current_setting('server_version') AS version")).rows[0].version;
  assert.match(version,/^17\./);
  const type=c=>c.data_type==='ARRAY'?'text[]':c.data_type==='USER-DEFINED'?'text':c.data_type;
  const defaults={created_at:'now()',amount:'0',order_id:"''",status:"'PENDING'",payment_method:"'card'",refund_amount:'0',host_payout_amount:'0',platform_revenue:'0',payout_status:"'pending'",price_at_booking:'0',total_experience_price:'0',is_solo_guarantee:'false',solo_guarantee_price:'0',solo_guarantee_refund_status:"'not_applicable'",solo_guarantee_refund_amount:'0'};
  const cols=prod.schema_columns.filter(c=>c.table_name==='bookings').map(c=>'"'+c.column_name+'" '+type(c)+(c.column_name==='id'?' PRIMARY KEY':'')+(defaults[c.column_name]!=null?' DEFAULT '+defaults[c.column_name]:''));
  await setup.query([
    'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;',
    'CREATE SCHEMA auth;',
    "CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(current_setting('request.jwt.claim.role',true), 'service_role') $$;",
    "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    'CREATE TABLE public.bookings ('+cols.join(',')+');',
    "CREATE TABLE public.experiences (id bigint PRIMARY KEY,host_id uuid,title text,price numeric,private_price numeric DEFAULT 126000,max_guests integer DEFAULT 10,duration integer DEFAULT 3,solo_guarantee_price integer DEFAULT 38000 CHECK (solo_guarantee_price>=20000 AND solo_guarantee_price<=100000 AND solo_guarantee_price%1000=0),solo_guarantee_option_visible boolean DEFAULT true);",
    "CREATE TABLE public.notifications(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid,type text,title text,message text,link text,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now(),booking_id text);",
    "CREATE UNIQUE INDEX guest_review_request ON notifications(booking_id) WHERE type='review_request' AND booking_id IS NOT NULL;",
    "CREATE UNIQUE INDEX host_review_request ON notifications(booking_id) WHERE type='guest_review_request' AND booking_id IS NOT NULL;",
    'CREATE TABLE public.reviews(booking_id text); CREATE TABLE public.guest_reviews(booking_id text,host_id uuid);',
    'CREATE TABLE public.users(id uuid,email text); CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,full_name text); CREATE TABLE public.admin_whitelist(email text); CREATE TABLE service_bookings(host_id uuid,status text,payout_status text);',
    'CREATE TABLE public.host_applications(user_id uuid,created_at timestamptz DEFAULT now(),bank_name text,account_number text,account_holder text);',
    'CREATE TABLE public.admin_job_runs(id integer PRIMARY KEY,job_name text,status text,lease_token text,finished_at timestamptz,duration_ms integer,processed_count integer,skipped_count integer,error_message text,details jsonb,last_heartbeat_at timestamptz,lease_expires_at timestamptz);',
    "CREATE TABLE public.admin_manual_payouts(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,request_key uuid UNIQUE,host_id uuid,settlement_type text,booking_ids text[],booking_snapshot jsonb,current_booking_amount integer,legacy_amount integer,total_paid_amount integer,reason text,legacy_source_reference text,transfer_reference text,bank_name text,account_number text,account_holder text,paid_by_admin_id uuid,paid_by_admin_email text,paid_at timestamptz,created_at timestamptz DEFAULT now());"
  ].join('\n'));
  for(const c of prod.production_catalog.evidence.constraints.filter(c=>c.table==='bookings'))await setup.query('ALTER TABLE public.bookings ADD CONSTRAINT "'+c.name+'" '+c.definition);
  for(const f of prod.definitions.parsed[0].definitions)await setup.query(f.definition);
  const paymentGuard=prod.production_catalog.evidence.triggers.find(t=>t.name==='bookings_payment_claim_columns_server_only');
  await setup.query(paymentGuard.function_definition);await setup.query(paymentGuard.definition);
  await setup.query("INSERT INTO admin_whitelist VALUES('audit-admin@example.invalid'); INSERT INTO profiles VALUES('"+D+"','audit-admin@example.invalid'); INSERT INTO host_applications(user_id,bank_name,account_number,account_holder) VALUES('"+H+"','AUDIT','000','synthetic');");
  await setup.query(`CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
    ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON bookings TO anon,authenticated;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE POLICY booking_owner_update ON bookings FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY booking_host_update ON bookings FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM experiences e WHERE e.id=experience_id AND e.host_id=auth.uid()));
    CREATE POLICY booking_read ON bookings FOR SELECT TO authenticated USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM experiences e WHERE e.id=experience_id AND e.host_id=auth.uid()));
    GRANT SELECT ON experiences TO authenticated;
    GRANT SELECT,UPDATE(full_name) ON profiles TO authenticated;
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY self_profile ON profiles TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
  `);
  await setup.query('INSERT INTO profiles(id,full_name) VALUES($1,\'Before\')',[G]);
  let sequence=0;
  async function pair(method='card', S=38000, status='completed', refundStatus='not_applicable', provider=null) {
    const eid=++sequence;
    const id='A-'+eid,other='B-'+eid;
    await setup.query('INSERT INTO experiences(id,host_id,title,price,duration,solo_guarantee_price) VALUES($1,$2,\'Synthetic\',$3::int,1,$3::int)',[eid,H,S]);
    const slot=(await setup.query("SELECT (now() AT TIME ZONE 'Asia/Seoul'-interval '2 hours')::date::text d,to_char(now() AT TIME ZONE 'Asia/Seoul'-interval '2 hours','HH24:MI') t")).rows[0];
    await setup.query(`INSERT INTO bookings(id,order_id,user_id,experience_id,date,time,status,guests,type,amount,total_price,total_experience_price,price_at_booking,host_payout_amount,platform_revenue,payment_method,tid,is_solo_guarantee,solo_guarantee_price,solo_guarantee_refund_status,payment_provider)
      VALUES($1,$1,$2,$3,$4,$5,$6,1,'group',$7::int,$8::int,$8::int,$9::int,$10::int,$11::int,$12,$13,true,$9::int,$14,$15)`,[id,G,eid,slot.d,slot.t,status,Math.floor(2*S*1.05),2*S,S,Math.floor(2*S*.8),Math.floor(2*S*1.05)-Math.floor(2*S*.8),method,'TID-'+id,refundStatus,provider]);
    await setup.query(`INSERT INTO bookings(id,order_id,user_id,experience_id,date,time,status,guests,type,amount,total_price,total_experience_price,price_at_booking,host_payout_amount,platform_revenue,payment_method,tid)
      VALUES($1,$1,$2,$3,$4,$5,'confirmed',1,'group',$6::int,$7::int,$7::int,$7::int,$8::int,$9::int,'card',$10)`,[other,B,eid,slot.d,slot.t,Math.floor(S*1.1),S,Math.floor(S*.8),Math.floor(S*1.1)-Math.floor(S*.8),'TID-'+other]);
    return {id,other,eid,S};
  }
  const read=async(id,client=setup)=>(await client.query('SELECT *,date::text FROM bookings WHERE id=$1',[id])).rows[0];
  const legacy=[];
  for(const [method,status,refundStatus,provider] of [['card','completed','not_applicable','nicepay'],['bank','completed','pending_manual',null],['card','completed','processing',null],['card','completed','failed',null],['card','completed','refunded',null],['bank','cancelled','not_applicable',null],['card','confirmed','not_applicable',null]])legacy.push(await pair(method,38000,status,refundStatus,provider));
  // Real legacy manual reservation and already-refunded snapshots, not merely
  // status labels on an unreduced basis.
  for(const index of [1,4])await setup.query('UPDATE bookings SET solo_guarantee_refund_amount=38000,total_price=38000,total_experience_price=38000,host_payout_amount=30400,platform_revenue=11400,refund_amount=$2 WHERE id=$1',[legacy[index].id,index===4?38000:0]);
  await setup.query('UPDATE bookings SET tid=NULL WHERE id=$1',[legacy[1].id]);
  await setup.query('UPDATE bookings SET solo_guarantee_refund_amount=38000 WHERE id=$1',[legacy[3].id]);
  await setup.query("UPDATE bookings SET solo_guarantee_price=0,is_solo_guarantee=false WHERE id=$1",[legacy.at(-1).id]);
  const financialFields=['amount','total_price','total_experience_price','price_at_booking','refund_amount','host_payout_amount','platform_revenue','payout_status','payout_paid_at','tid','payment_method','payment_provider','payment_provider_reference','solo_guarantee_price','solo_guarantee_refund_status','solo_guarantee_refund_amount'];
  const financialBefore=(await setup.query('SELECT '+financialFields.join(',')+' FROM bookings ORDER BY id')).rows;
  await setup.query(await readFile(join(root,'supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql'),'utf8'));
  assert.deepEqual((await setup.query('SELECT '+financialFields.join(',')+' FROM bookings ORDER BY id')).rows,financialBefore);
  record('forward_safe_legacy_rows',{pass:true});
  const originalAuthorities = (await setup.query("SELECT proname,pg_get_functiondef(oid) definition FROM pg_proc WHERE proname IN ('reconcile_solo_refund_accepted_atomic','reconcile_solo_refund_rejected_atomic','apply_solo_refund_settlement_atomic') ORDER BY proname")).rows;
  const beforeLedgerMigration = (await setup.query('SELECT to_jsonb(b) row FROM bookings b ORDER BY id')).rows;
  await setup.query(`CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz);
    ALTER TABLE public.users ADD COLUMN role text;
    INSERT INTO auth.users VALUES('${D}','audit-admin@example.invalid',now(),NULL),('${G}','audit-guest@example.invalid',now(),NULL);`);
  await setup.query(await readFile(join(root,'supabase/migrations/20261007052144_solo_refund_provider_ledger_reconciliation.sql'),'utf8'));
  assert.deepEqual((await setup.query('SELECT to_jsonb(b) row FROM bookings b ORDER BY id')).rows,beforeLedgerMigration);
  assert.deepEqual((await setup.query("SELECT proname,pg_get_functiondef(oid) definition FROM pg_proc WHERE proname IN ('reconcile_solo_refund_accepted_atomic','reconcile_solo_refund_rejected_atomic','apply_solo_refund_settlement_atomic') ORDER BY proname")).rows,originalAuthorities);
  record('ledger_migration_additive_existing_signed_and_settlement_authorities_unchanged',{pass:true});
  for(const client of [c1,c2,c3])await client.query('SET ROLE service_role');
  async function rpc(client,name,args={}) {const r=await adapter(client).rpc(name,args);if(r.error)throw Object.assign(new Error(r.error.message),{code:r.error.code});return r.data;}
  const claim=(client,id)=>rpc(client,'claim_solo_refund_atomic',{p_booking_id:id});
  const begin=async(client,id)=>rpc(client,'begin_solo_refund_request_atomic',{p_operation_id:id,p_merchant_reference:'TESTMID',p_attempt_identity:(await setup.query('SELECT attempt_identity FROM booking_solo_refund_operations WHERE id=$1',[id])).rows[0].attempt_identity});
  const accepted=(client,op)=>rpc(client,'record_solo_refund_outcome_atomic',{p_operation_id:op.id,p_attempt_identity:op.attempt_identity,p_outcome:'accepted',p_result_code:'2001',p_refund_reference:'CANCEL-'+op.id,p_diagnostic_code:null});
  const apply=(client,id)=>rpc(client,'apply_solo_refund_settlement_atomic',{p_operation_id:id});
  const pay=async(client,id)=>rpc(client,'settle_experience_payouts_atomic',{p_booking_ids:[id],p_expected_amounts:{[id]:(await read(id)).host_payout_amount}});
  const x=await pair();const [op]=await claim(c1,x.id);assert.ok(op);assert.equal((await claim(c2,x.id)).length,0);
  assert.equal((await begin(c1,op.id)).length,1);assert.equal((await begin(c2,op.id)).length,0);
  await accepted(c1,op);await apply(c1,op.id);await apply(c2,op.id);
  assert.equal((await read(x.id)).refund_amount,x.S);
  record('claim_and_settlement_exactly_once',{pass:true});
  const late=await pair('card',38000,'confirmed');
  const completed=await rpc(c1,'complete_experience_booking_if_due_atomic',{p_booking_id:late.id});
  assert.equal(completed[0].completed,true);
  assert.equal((await read(late.id)).status,'completed');
  assert.equal((await rpc(c1,'complete_experience_booking_if_due_atomic',{p_booking_id:late.id}))[0].already_processed,true);
  assert.equal((await setup.query("SELECT count(*)::int n FROM notifications WHERE booking_id=$1 AND type='review_request'",[late.id])).rows[0].n,1);
  record('late_completion_42702',{pass:true});
  // The fixture exposes the original grants/RLS first, then attacks every column
  // with actual SQL under the owner's and host's authenticated role.
  for (const [role,user] of [['authenticated',G],['authenticated',H],['anon',G]]) {
    await setup.query('BEGIN'); await setup.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
    await setup.query("SELECT set_config('request.jwt.claim.role',$1,true)",[role]);
    await setup.query('SET LOCAL ROLE '+role);
    if(role==='authenticated')assert.equal((await setup.query('SELECT id FROM bookings WHERE id=$1',[x.id])).rows[0].id,x.id);
    for(const field of fixture.columns.map(c=>c.column_name)) {
      await setup.query('SAVEPOINT tamper');
      await assert.rejects(setup.query('UPDATE bookings SET "'+field+'"="'+field+'" WHERE id=$1',[x.id]),{code:'42501'});
      await setup.query('ROLLBACK TO SAVEPOINT tamper');
    }
    await setup.query('SAVEPOINT inject');
    await assert.rejects(setup.query("INSERT INTO bookings(id,order_id,amount) VALUES('EVIL','EVIL',1)"),{code:'42501'});
    await setup.query('ROLLBACK TO SAVEPOINT inject');
    for(const [sql,args,code] of [
      ["SELECT * FROM create_booking_atomic($1,$2,'2026-12-01','14:00',1,false,'Synthetic','000','card',true)",[G,String(x.eid)],'P0001'],
      ['SELECT * FROM confirm_experience_bank_payment_atomic($1)',[x.id],'42501'],
      ["SELECT * FROM confirm_experience_payment_atomic($1,'nicepay','REF','TX',79800)",[x.id],'42501']
    ]){await setup.query('SAVEPOINT legacy_rpc');await assert.rejects(setup.query(sql,args),{code});await setup.query('ROLLBACK TO SAVEPOINT legacy_rpc');}
    await setup.query('ROLLBACK');
    record('financial_authority_'+role+'_'+(user===H?'host':'owner'),{pass:true,columns:fixture.columns.length});
  }
  await setup.query('BEGIN');await setup.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[G]);await setup.query('SET LOCAL ROLE authenticated');
  await setup.query("UPDATE profiles SET full_name='After' WHERE id=$1",[G]);
  assert.equal((await setup.query('SELECT full_name FROM profiles WHERE id=$1',[G])).rows[0].full_name,'After');await setup.query('ROLLBACK');
  record('owner_profile_write_and_booking_reads_preserved',{pass:true});
  const acl=(await setup.query(`SELECT p.oid::regprocedure::text signature,has_function_privilege('authenticated',p.oid,'EXECUTE') auth,
    has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('service_role',p.oid,'EXECUTE') service
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE '%solo_refund%' OR p.proname LIKE '%cancellation_atomic' OR p.proname IN ('settle_experience_payouts_atomic','finalize_released_card_refund_atomic','complete_admin_manual_experience_payout_atomic','complete_experience_booking_if_due_atomic'))`)).rows;
  for(const f of acl){assert.equal(f.auth,false,f.signature);assert.equal(f.anon,false,f.signature);assert.equal(f.service,true,f.signature);}
  record('server_RPC_ACLs',{pass:true,functions:acl.length});
  await assert.rejects(c1.query("UPDATE bookings SET payout_status='paid' WHERE id=$1",[(await pair()).id]),/PAYOUT_RPC_REQUIRED/);
  record('old_server_payout_path_fails_closed',{pass:true});

  const cancelClaim=async(client,id)=>rpc(client,'claim_booking_cancellation_atomic',{p_booking_id:id,p_expected_snapshot:m.bookingCancellationSnapshot(await read(id))});
  const cancelFinal=(client,row,rate=100)=>{const f=m.calculateBookingCancellationSettlement(row,rate);return rpc(client,'finalize_booking_cancellation_atomic',{
    p_booking_id:row.id,p_claim_id:row.cancellation_claim_id,p_reason:'Synthetic cancellation',p_refund_amount:f.cumulativeRefundAmount,p_host_payout:f.hostPayout,p_platform_revenue:f.platformRevenue});};
  // Each race uses distinct service connections, and barriers at real DB commits
  // or the external provider boundary. No timing-dependent mock authorization.
  for (const name of ['cron_vs_cron','cron_vs_force_one']) {
    const p=await pair();const both=await Promise.all([claim(c1,p.id),claim(c2,p.id)]);
    assert.equal(both.flat().length,1);record(name,{pass:true});
  }
  const refundRace=await pair();const [raceOp]=await claim(c1,refundRace.id);await begin(c1,raceOp.id);
  await assert.rejects(pay(c2,refundRace.id),/BOOKING_MONEY_UNRESOLVED/);
  await accepted(c1,raceOp);await apply(c1,raceOp.id);await pay(c2,refundRace.id);
  assert.equal((await read(refundRace.id)).host_payout_amount,30400);record('R07_refund_vs_regular_payout',{pass:true});
  const payoutFirst=await pair();await assert.rejects(pay(c2,payoutFirst.id),/BOOKING_MONEY_UNRESOLVED/);
  assert.equal((await claim(c1,payoutFirst.id)).length,1);record('R08_payout_first_due_not_applicable',{pass:true});
  const blocked=await pair();const pid=(await c1.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  await c2.query('BEGIN');await c2.query('SELECT private.lock_booking_money($1)',[blocked.eid]);
  let resolved=false;const waiting=claim(c1,blocked.id).then(r=>{resolved=true;return r});
  let observed=false;for(let attempt=0;attempt<100;attempt++){
    const row=(await setup.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) blocked",[pid])).rows[0];
    if(row.blocked){observed=true;break;}await new Promise(r=>setTimeout(r,5));
  }
  assert.equal(observed,true);assert.equal(resolved,false);await c2.query('ROLLBACK');assert.equal((await waiting).length,1);
  record('R09_independent_transaction_lock_boundary',{pass:true});
  // Isolate this host's current liabilities for the exact live manual RPC.
  const manualFixture=await pair();const newHost=crypto.randomUUID();await setup.query('UPDATE experiences SET host_id=$1 WHERE id=$2',[newHost,manualFixture.eid]);
  await setup.query("INSERT INTO host_applications(user_id,bank_name,account_number,account_holder) VALUES($1,'TEST','000','Fixture')",[newHost]);
  const manualArgs={p_request_key:crypto.randomUUID(),p_host_id:newHost,p_settlement_type:'legacy_carryover',p_expected_current_booking_amount:60800,p_legacy_amount:1,p_reason:'Synthetic',p_legacy_source_reference:'TEST',p_transfer_reference:'TEST',p_paid_by_admin_id:D,p_paid_by_admin_email:'audit-admin@example.invalid'};
  await assert.rejects(rpc(c2,'complete_admin_manual_experience_payout_atomic',manualArgs),/환불 상태|BOOKING_MONEY_UNRESOLVED/);
  const [manualOp]=await claim(c1,manualFixture.id);await begin(c1,manualOp.id);await assert.rejects(rpc(c2,'complete_admin_manual_experience_payout_atomic',manualArgs),/환불 상태|BOOKING_MONEY_UNRESOLVED/);
  await accepted(c1,manualOp);await apply(c1,manualOp.id);
  manualArgs.p_expected_current_booking_amount=30400;
  assert.equal((await rpc(c2,'complete_admin_manual_experience_payout_atomic',manualArgs))[0].current_booking_amount,30400);
  record('R10_refund_vs_manual_payout',{pass:true});
  const bankRace=await pair('bank');await assert.rejects(pay(c2,bankRace.id),/BOOKING_MONEY_UNRESOLVED/);
  const [bankOp]=await claim(c1,bankRace.id);assert.equal(bankOp.outcome,'manual_pending');
  await assert.rejects(pay(c2,bankRace.id),/BOOKING_MONEY_UNRESOLVED/);assert.equal((await read(bankRace.id)).payout_status,'pending');
  record('R11_bank_manual_vs_paid',{pass:true});
  const bc=await pair();const [bCancel]=await cancelClaim(c2,bc.other);await cancelFinal(c2,bCancel);
  assert.equal((await claim(c1,bc.id)).length,0);record('R12_B_cancel_after_candidate_read',{pass:true});
  const ac=await pair();const [acOp]=await claim(c1,ac.id);assert.equal((await cancelClaim(c2,ac.id)).length,0);
  const [lateB]=await cancelClaim(c2,ac.other);await cancelFinal(c2,lateB);await begin(c1,acOp.id);await accepted(c1,acOp);await apply(c1,acOp.id);
  assert.equal((await read(ac.id)).refund_amount,38000);record('R13_A_cancel_after_refund_claim',{pass:true});
  const acFirst=await pair();assert.equal((await cancelClaim(c2,acFirst.id)).length,1);assert.equal((await claim(c1,acFirst.id)).length,0);
  record('A_cancellation_wins_first',{pass:true});
  const concurrentCancel=await pair();const cancelBoth=await Promise.all([cancelClaim(c1,concurrentCancel.id),cancelClaim(c2,concurrentCancel.id)]);assert.equal(cancelBoth.flat().length,1);
  record('concurrent_cancellation_claims',{pass:true});

  const manual=async(client,p,amount,proof='BANK-TRANSFER-'+p.id,capture=null)=>{
    const [op]=await rpc(client,'complete_manual_solo_refund_atomic',{
      p_booking_id:p.id,p_amount:amount,p_proof_reference:proof,p_transaction_reference:capture,p_admin_id:D});
    return apply(client,op.id);
  };
  await manual(c1,legacy[1],38000,'LEGACY-BANK-PROOF');
  assert.equal(Number((await read(legacy[1].id)).total_experience_price),38000);assert.equal((await read(legacy[1].id)).refund_amount,38000);
  record('legacy_pending_manual_reserved_basis_applied_once',{pass:true});
  assert.equal((await claim(c1,legacy[4].id)).length,0);assert.equal((await read(legacy[4].id)).refund_amount,38000);
  record('legacy_already_refunded_never_reclaimed',{pass:true});
  await assert.rejects(manual(c1,bankRace,20000),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
  await assert.rejects(manual(c1,bankRace,38000,''),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
  const manualBoth=await Promise.allSettled([manual(c1,bankRace,38000),manual(c2,bankRace,38000)]);
  assert.equal(manualBoth.filter(r=>r.status==='fulfilled').length,1);assert.equal(manualBoth.filter(r=>r.status==='rejected').length,1);
  await pay(c2,bankRace.id);record('manual_exact_S_proof_concurrent_admins',{pass:true});
  const paypal=await pair('paypal');await claim(c1,paypal.id);
  await assert.rejects(manual(c1,paypal,38000,'PP-REFUND'),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
  await manual(c1,paypal,38000,'PP-REFUND','TID-'+paypal.id);record('paypal_refund_and_capture_proof',{pass:true});
  const signed=(op,overrides={})=>{const fields={ResultCode:'2001',ResultMsg:'synthetic',MID:'TESTMID',TID:op.transaction_reference,Moid:op.order_reference,CancelAmt:String(op.requested_amount),CancelNum:'TESTCANCEL',...overrides};
    fields.Signature=crypto.createHash('sha256').update(fields.TID+fields.MID+fields.CancelAmt+'TESTKEY').digest('hex');return JSON.stringify(fields);};
  function provider(mode='accepted',hooks={}) {let calls=0;const fn=async params=>{calls++;await hooks.pause?.();
    return m.cancelCardPayment(params,{environment:{NICEPAY_MID:'TESTMID',NICEPAY_MERCHANT_KEY:'TESTKEY'},timeoutMs:20,
      fetch:async(_url,options)=>{const form=new URLSearchParams(options.body);const op={transaction_reference:form.get('TID'),order_reference:form.get('Moid'),requested_amount:Number(form.get('CancelAmt'))};
        if(mode==='timeout')return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Abort')),{once:true}));
        if(mode==='connection')throw new Error('synthetic transport');
        const raw=signed(op,mode==='rejected'?{ResultCode:'2011'}:mode==='wrong_amount'?{CancelAmt:'1'}:mode==='wrong_tid'?{TID:'OTHER'}:mode==='wrong_order'?{Moid:'OTHER'}:mode==='wrong_mid'?{MID:'OTHER'}:mode==='missing_ref'?{CancelNum:''}:mode==='2211'?{ResultCode:'2211'}:{});
        return new Response(mode==='wrong_signature'?JSON.stringify({...JSON.parse(raw),Signature:'0'.repeat(64)}):raw);}});};
    return {fn,get calls(){return calls}};
  }
  const runRefund=(client,p,pv,hooks={})=>m.processSoloGuaranteeRefundsForCompletedBookings({supabaseAdmin:adapter(client,hooks),completedBookingIds:[p.id],cancelCardPaymentFn:pv.fn,merchantReference:'TESTMID'});
  for (const source of ['cron_vs_cron','cron_vs_force_one']) {
    const p=await pair();const started=gate(),resume=gate();
    const pv=provider('accepted',{pause:async()=>{started.open();await resume.promise;}});
    const first=runRefund(c1,p,pv);await started.promise;
    await runRefund(c2,p,pv);assert.equal(pv.calls,1);
    await assert.rejects(pay(c3,p.id),/BOOKING_MONEY_UNRESOLVED/);
    resume.open();await first;assert.equal((await read(p.id)).refund_amount,38000);
    record('processor_'+source+'_dispatch_once',{pass:true,externalCalls:pv.calls});
  }
  for(const mode of ['accepted','2211','rejected','timeout','connection','wrong_amount','wrong_tid','wrong_order','wrong_mid','wrong_signature','missing_ref']) {
    const p=await pair();const pv=provider(mode);await runRefund(c1,p,pv);const row=await read(p.id);
    const outcome=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[p.id])).rows[0];
    assert.equal(row.solo_guarantee_refund_status,['accepted','2211'].includes(mode)?'refunded':mode==='rejected'?'rejected':'unknown');
    if(outcome.outcome==='unknown')await assert.rejects(manual(c2,p,38000),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
    await runRefund(c2,p,pv);assert.equal(pv.calls,1);
    if(outcome.outcome!=='accepted')await assert.rejects(pay(c2,p.id),/BOOKING_MONEY_UNRESOLVED/);
    record('provider_'+mode,{pass:true,externalCalls:pv.calls});
  }
  const noDispatch=await pair();const noDispatchProvider=provider();let lostDispatch=false;
  await runRefund(c1,noDispatch,noDispatchProvider,{afterRpc:async({name},result)=>{
    if(name==='begin_solo_refund_request_atomic'&&!lostDispatch){lostDispatch=true;return {data:null,error:{message:'synthetic dispatch reply lost'}};}return result;
  }});
  await runRefund(c2,noDispatch,noDispatchProvider);assert.equal(noDispatchProvider.calls,0);
  await setup.query("UPDATE booking_solo_refund_operations SET lease_expires_at=now()-interval '1 second' WHERE booking_id=$1",[noDispatch.id]);
  await rpc(c2,'recover_solo_refunds_atomic');await assert.rejects(pay(c3,noDispatch.id),/BOOKING_MONEY_UNRESOLVED/);
  record('dispatch_commit_reply_lost_never_calls_provider',{pass:true,externalCalls:0});
  for(const failure of ['outcome_definite_failure','outcome_commit_reply_lost','apply_definite_failure','apply_commit_reply_lost','notification_throw']) {
    const p=await pair();const pv=provider();let injected=0;
    const hooks={beforeRpc:async meta=>{
      if(failure==='outcome_definite_failure'&&meta.name==='record_solo_refund_outcome_atomic'){injected++;return {data:null,error:{message:'synthetic database failure'}};}
      if(failure==='apply_definite_failure'&&meta.name==='apply_solo_refund_settlement_atomic'){injected++;return {data:null,error:{message:'synthetic database failure'}};}
      if(failure==='notification_throw'&&meta.name==='deliver_solo_refund_notification_atomic'){injected++;throw new Error('synthetic notification throw');}
    },afterRpc:async(meta)=>{
      if((failure==='outcome_commit_reply_lost'&&meta.name==='record_solo_refund_outcome_atomic'||failure==='apply_commit_reply_lost'&&meta.name==='apply_solo_refund_settlement_atomic')&&injected++===0)return {data:null,error:{message:'synthetic reply lost'}};
    }};
    await runRefund(c1,p,pv,hooks);assert.equal(pv.calls,1);const row=await read(p.id);
    if(failure==='outcome_definite_failure') {
      assert.equal(row.solo_guarantee_refund_status,'processing');await setup.query("UPDATE booking_solo_refund_operations SET lease_expires_at=now()-interval '1 second' WHERE booking_id=$1",[p.id]);
      await rpc(c2,'recover_solo_refunds_atomic');assert.equal((await setup.query('SELECT outcome FROM booking_solo_refund_operations WHERE booking_id=$1',[p.id])).rows[0].outcome,'unknown');
    } else if(failure==='apply_definite_failure') {
      assert.equal(row.solo_guarantee_refund_status,'accepted');await assert.rejects(pay(c2,p.id),/BOOKING_MONEY_UNRESOLVED/);
      const ops=await rpc(c2,'recover_solo_refunds_atomic');const o=ops.find(o=>o.booking_id===p.id);assert.ok(o);await apply(c2,o.id);
    } else {assert.equal(row.solo_guarantee_refund_status,'refunded');assert.equal(row.refund_amount,38000);}
    await runRefund(c2,p,pv);assert.equal(pv.calls,1);await assert.rejects(manual(c2,p,38000),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
    record(failure,{pass:true,externalCalls:pv.calls});
  }
  // A correlated success can reconcile unknown and apply exactly once; a status
  // query or another amount/TID/order cannot substitute for that evidence.
  const unknown=await pair();const up=provider('timeout');await runRefund(c1,unknown,up);
  const uo=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[unknown.id])).rows[0];
  await assert.rejects(rpc(c1,'retry_rejected_solo_refund_atomic',{p_operation_id:uo.id,p_admin_id:D}),/SOLO_REFUND_RETRY_UNSAFE/);
  const verified=m.verifyCardRefundResponse(signed(uo),{providerTransactionId:uo.transaction_reference,orderId:uo.order_reference,cancelAmount:uo.requested_amount},{NICEPAY_MID:'TESTMID',NICEPAY_MERCHANT_KEY:'TESTKEY'});
  await rpc(c1,'reconcile_solo_refund_accepted_atomic',{p_operation_id:uo.id,p_result_code:verified.resultCode,p_refund_reference:verified.refundReference,p_amount:uo.requested_amount,p_transaction_reference:uo.transaction_reference,p_order_reference:uo.order_reference,p_admin_id:D});
  await apply(c2,uo.id);assert.equal((await read(unknown.id)).refund_amount,38000);record('unknown_reconciled_with_exact_success',{pass:true});
  const retry=await pair();await runRefund(c1,retry,provider('rejected'));
  const ro=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[retry.id])).rows[0];
  const [retryOp]=await rpc(c1,'retry_rejected_solo_refund_atomic',{p_operation_id:ro.id,p_admin_id:D});assert.notEqual(retryOp.attempt_identity,ro.attempt_identity);
  assert.equal((await begin(c1,retryOp.id)).length,1);await accepted(c1,retryOp);await apply(c1,retryOp.id);
  assert.equal((await setup.query('SELECT count(*)::int n FROM booking_solo_refund_attempts WHERE operation_id=$1',[ro.id])).rows[0].n,2);
  assert.equal((await setup.query('SELECT merchant_reference FROM booking_solo_refund_attempts WHERE attempt_identity=$1',[ro.attempt_identity])).rows[0].merchant_reference,'TESTMID');
  record('definite_rejection_only_safe_retry_journal',{pass:true});
  for(const S of [38000,42000])for(const rate of [100,50]) {
    const p=await pair('card',S);await setup.query('UPDATE experiences SET solo_guarantee_price=42000 WHERE id=$1',[p.eid]);
    await runRefund(c1,p,provider());const row=await read(p.id);assert.equal(row.refund_amount,S);
    const [c]=await cancelClaim(c2,p.id);const f=m.calculateBookingCancellationSettlement(c,rate);await cancelFinal(c2,c,rate);
    const after=await read(p.id);assert.equal(after.refund_amount,S+Math.floor((row.amount-S)*rate/100));
    assert.equal(after.refund_amount+after.host_payout_amount+after.platform_revenue,row.amount);
    record('snapshot_S_'+S+'_subsequent_cancel_'+rate,{pass:true,refund:f.refundAmount});
  }
  const early=await pair('card',38000,'confirmed');await setup.query("UPDATE bookings SET time=to_char(now() AT TIME ZONE 'Asia/Seoul'-interval '30 minutes','HH24:MI'),date=(now() AT TIME ZONE 'Asia/Seoul')::date WHERE experience_id=$1",[early.eid]);
  await rpc(c1,'complete_experience_booking_if_due_atomic',{p_booking_id:early.id});assert.equal((await claim(c1,early.id)).length,0);
  await assert.rejects(pay(c2,early.id),/BOOKING_TOUR_NOT_ENDED/);record('no_early_refund_or_solo_payout',{pass:true});
  const nullProvider=await pair('card',38000,'completed','not_applicable',null);await runRefund(c1,nullProvider,provider());assert.equal((await read(nullProvider.id)).refund_amount,38000);record('legacy_NULL_provider',{pass:true});
  // Actual existing creation/confirmation RPCs still own all monetary inputs.
  for(const method of ['card','bank']) {
    const eid=++sequence;await setup.query('INSERT INTO experiences(id,host_id,title,price,duration,solo_guarantee_price) VALUES($1,$2,\'Golden\',38000,1,38000)',[eid,H]);
    const created=(await c1.query("SELECT * FROM create_booking_atomic($1,$2,'2026-12-01','14:00',1,false,'Synthetic','000',$3,true)",[G,String(eid),method])).rows[0];
    const id=created.new_order_id;
    if(method==='bank')await rpc(c1,'confirm_experience_bank_payment_atomic',{p_booking_id:id});
    else {
      await c1.query("UPDATE bookings SET payment_provider='nicepay',payment_provider_reference=$2,payment_claim_state='processing' WHERE id=$1",[id,'TEST-'+id]);
      await c1.query('SELECT * FROM confirm_experience_payment_atomic($1,\'nicepay\',$2,$2,(SELECT amount FROM bookings WHERE id=$1))',[id,'TEST-'+id]);
    }
    const row=await read(id);assert.equal(row.amount,79800);assert.equal(row.host_payout_amount,60800);assert.equal(row.solo_guarantee_price,38000);
    record('service_'+method+'_create_and_confirm_RPC',{pass:true});
  }
  for(const method of ['card','bank']) {
    const p=await pair(method);await claim(c1,p.id);const row=await read(p.id);
    assert.equal(row.amount-Math.max(row.refund_amount,row.solo_guarantee_refund_amount)-row.host_payout_amount,row.platform_revenue);
    record('claim_phase_accounting_balanced_'+method,{pass:true});
    await assert.rejects(c1.query('UPDATE bookings SET solo_guarantee_price=42000 WHERE id=$1',[p.id]),/SOLO_REFUND_SNAPSHOT_IMMUTABLE/);
    if(method==='bank') {
      await assert.rejects(manual(c1,p,null),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
      const races=await Promise.allSettled([manual(c1,p,38000),rpc(c2,'settle_experience_payouts_atomic',{p_booking_ids:[p.id],p_expected_amounts:{[p.id]:60800}})]);
      assert.equal(races[0].status,'fulfilled');assert.equal(races[1].status,'rejected');assert.equal((await read(p.id)).payout_status,'pending');
      record('bank_manual_completion_vs_stale_payout',{pass:true});
    }
  }
  const paidNoOther=await pair('bank');const [cancelledOther]=await cancelClaim(c2,paidNoOther.other);await cancelFinal(c2,cancelledOther);
  await pay(c2,paidNoOther.id);assert.equal((await claim(c1,paidNoOther.id)).length,0);record('no_bank_obligation_after_paid',{pass:true});
  for(const time of [null,'','bad','25:00']) {
    const p=await pair();await setup.query('UPDATE bookings SET time=$1 WHERE experience_id=$2',[time,p.eid]);
    assert.equal((await claim(c1,p.id)).length,0);record('DB_invalid_time_'+String(time),{pass:true});
  }
  for(const code of ['2002','2013','2015','2056','2212','2219','2225']) {
    const fake={transaction_reference:'TX',order_reference:'OP',requested_amount:38000};
    assert.throws(()=>m.verifyCardRefundResponse(signed(fake,{ResultCode:code}),{providerTransactionId:'TX',orderId:'OP',cancelAmount:38000},{NICEPAY_MID:'TESTMID',NICEPAY_MERCHANT_KEY:'TESTKEY'}),error=>error.outcome==='unknown');
    record('provider_uncertain_code_'+code,{pass:true});
  }
  const delivery=await pair();await runRefund(c1,delivery,provider());const dop=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[delivery.id])).rows[0];
  assert.equal(dop.delivery_state,'delivered');assert.equal((await setup.query("SELECT count(*)::int n FROM notifications WHERE solo_refund_operation_id=$1",[dop.id])).rows[0].n,2);
  await m.deliverSoloRefundNotification(adapter(c2),dop);assert.equal((await setup.query("SELECT count(*)::int n FROM notifications WHERE solo_refund_operation_id=$1",[dop.id])).rows[0].n,2);
  record('notification_once_after_accepted',{pass:true});
  const deliveryFail=await pair();await setup.query(`CREATE FUNCTION public.reject_synthetic_refund_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.booking_id='${deliveryFail.id}' AND NEW.type='refund' THEN RAISE EXCEPTION 'fixture delivery failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_delivery_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_synthetic_refund_notification();`);
  await runRefund(c1,deliveryFail,provider());const df=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[deliveryFail.id])).rows[0];
  assert.equal(df.outcome,'accepted');assert.ok(df.settlement_applied_at);assert.equal(df.delivery_state,'failed');
  await setup.query('DROP TRIGGER fixture_delivery_failure ON notifications');
  const [reset]=await rpc(c2,'retry_solo_refund_delivery_atomic',{p_operation_id:df.id,p_admin_id:D});assert.equal(await m.deliverSoloRefundNotification(adapter(c2),reset),true);
  assert.equal((await read(deliveryFail.id)).refund_amount,38000);record('notification_DB_failure_safe_recovery',{pass:true});
  for(const failure of ['proof_commit_reply_lost','manual_apply_definite_failure','manual_apply_commit_reply_lost']) {
    const p=await pair('bank');await claim(c1,p.id);let injected=0;
    const db=adapter(c1,{
      beforeRpc:async meta=>failure==='manual_apply_definite_failure'&&meta.name==='apply_solo_refund_settlement_atomic'?{data:null,error:{message:'synthetic apply failure'}}:undefined,
      afterRpc:async(meta,result)=>{
        if((failure==='proof_commit_reply_lost'&&meta.name==='complete_manual_solo_refund_atomic'||failure==='manual_apply_commit_reply_lost'&&meta.name==='apply_solo_refund_settlement_atomic')&&injected++===0)return {data:null,error:{message:'synthetic reply lost'}};
        return result;
      }
    });
    const result=await m.markSoloGuaranteeManualRefundCompleted({supabaseAdmin:db,bookingId:p.id,refundAmount:38000,proofReference:'TRANSFER-'+p.id,adminId:D});
    const saved=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[p.id])).rows[0];
    assert.equal(saved.outcome,'accepted');assert.equal(saved.proof_reference,'TRANSFER-'+p.id);
    assert.equal(m.getSoloManualRefundCompletionGuard(await read(p.id)).ok,false);
    await assert.rejects(manual(c2,p,38000),/SOLO_MANUAL_PROOF_OR_STATE_INVALID/);
    if(!result.success) {await assert.rejects(pay(c2,p.id),/BOOKING_MONEY_UNRESOLVED/);await apply(c2,saved.id);}
    assert.equal((await read(p.id)).refund_amount,38000);
    record(failure,{pass:true,proofPreserved:true});
  }
  const unresolvedDelete=await pair();await claim(c1,unresolvedDelete.id);
  await assert.rejects(c1.query('DELETE FROM bookings WHERE id=$1',[unresolvedDelete.id]),/BOOKING_MONEY_UNRESOLVED/);
  await c1.query('DELETE FROM bookings WHERE id=$1',[delivery.id]);
  assert.equal((await setup.query('SELECT count(*)::int n FROM booking_solo_refund_operations WHERE booking_id=$1',[delivery.id])).rows[0].n,1);
  record('resolved_admin_delete_retains_evidence_unresolved_delete_blocked',{pass:true});
  globalThis.__soloRouteDb=adapter(c1);
  async function route(fn,user,body){globalThis.__soloRouteUser=user?{id:user,email:'synthetic@example.invalid'}:null;return fn(new Request('http://127.0.0.1/financial-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));}
  const routePair=await pair('bank');await setup.query('UPDATE bookings SET tid=NULL WHERE experience_id=$1',[routePair.eid]);
  assert.equal((await route(m.cancelRoute,null,{bookingId:routePair.other})).status,401);
  assert.equal((await route(m.cancelRoute,crypto.randomUUID(),{bookingId:routePair.other})).status,403);
  assert.equal((await route(m.cancelRoute,H,{bookingId:routePair.other,isHostCancel:true})).status,403);
  assert.equal((await route(m.cancelRoute,H,{bookingId:routePair.other})).status,403);
  assert.equal((await route(m.cancelRoute,G,{bookingId:routePair.id})).status,200);assert.equal((await read(routePair.id)).status,'cancelled');
  assert.equal((await route(m.cancelRoute,G,{bookingId:routePair.id})).status,400);
  record('actual_cancel_route_auth_owner_host_admin_boundary',{pass:true});
  const hostApproval=await pair('bank',38000,'cancellation_requested');await setup.query('UPDATE bookings SET tid=NULL WHERE id=$1',[hostApproval.id]);
  assert.equal((await route(m.cancelRoute,H,{bookingId:hostApproval.id})).status,200);record('actual_host_cancellation_approval',{pass:true});
  const review=await pair('bank',38000,'confirmed');await setup.query("UPDATE bookings SET tid=NULL,date=current_date+1 WHERE experience_id=$1",[review.eid]);
  assert.equal((await route(m.cancelRoute,G,{bookingId:review.id,reasonCode:'host_unavailable'})).status,200);
  assert.equal((await read(review.id)).status,'confirmed');
  assert.equal((await route(m.rejectReviewRoute,D,{bookingId:review.id})).status,200);
  assert.equal((await read(review.id)).cancel_reason,null);record('actual_guest_review_and_admin_rejection',{pass:true});
  const forced=await pair('bank');await setup.query('UPDATE bookings SET tid=NULL WHERE id=$1',[forced.id]);
  assert.equal((await route(m.forceCancelRoute,D,{bookingId:forced.id,reason:'Synthetic'})).status,200);
  assert.equal((await read(forced.id)).refund_amount,79800);record('actual_admin_force_cancel_route',{pass:true});
  const missingConfig=await pair('card',38000,'confirmed');await setup.query("UPDATE bookings SET date=current_date+8 WHERE id=$1",[missingConfig.id]);
  const oldMid=process.env.NICEPAY_MID,oldKey=process.env.NICEPAY_MERCHANT_KEY;delete process.env.NICEPAY_MID;delete process.env.NICEPAY_MERCHANT_KEY;
  const beforeConfig=await read(missingConfig.id);assert.equal((await route(m.cancelRoute,G,{bookingId:missingConfig.id})).status,500);
  assert.deepEqual(await read(missingConfig.id),beforeConfig);
  if(oldMid)process.env.NICEPAY_MID=oldMid;if(oldKey)process.env.NICEPAY_MERCHANT_KEY=oldKey;
  record('actual_preflight_failure_preserves_booking',{pass:true});
  const release=await pair('card',38000,'cancelled','not_applicable','nicepay');
  await setup.query('UPDATE bookings SET tid=NULL,payment_provider_reference=order_id,payment_claim_state=\'released\',cancel_reason=$2,host_payout_amount=0,platform_revenue=0 WHERE id=$1',[release.id,m.EXPLICIT_CARD_CHECKOUT_CANCEL_REASON]);
  const releasedRow=await read(release.id), originalFetch=globalThis.fetch;
  process.env.NICEPAY_MID='TESTMID';process.env.NICEPAY_MERCHANT_KEY='TESTKEY';let releaseCalls=0;
  globalThis.fetch=async(_url,options)=>{releaseCalls++;const form=new URLSearchParams(options.body);return new Response(signed({transaction_reference:form.get('TID'),order_reference:form.get('Moid'),requested_amount:Number(form.get('CancelAmt'))}));};
  try {
    const params={supabaseAdmin:adapter(c1),originalBooking:releasedRow,verificationResult:{provider:'nicepay',providerTransactionId:'APPROVED-'+release.id,approvedAmount:releasedRow.amount}};
    assert.equal((await m.finalizeExperienceCardPayment(params)).cancelledAndRefunded,true);
    assert.equal((await m.finalizeExperienceCardPayment(params)).alreadyProcessed,true);
    assert.equal(releaseCalls,1);assert.equal((await read(release.id)).refund_amount,releasedRow.amount);
    record('actual_verified_checkout_release_approval_race_preserved',{pass:true,externalCalls:releaseCalls});
  } finally {globalThis.fetch=originalFetch;delete process.env.NICEPAY_MID;delete process.env.NICEPAY_MERCHANT_KEY;if(oldMid)process.env.NICEPAY_MID=oldMid;if(oldKey)process.env.NICEPAY_MERCHANT_KEY=oldKey;}
  const lateRejected=await pair();const lateProvider=provider('timeout');await runRefund(c1,lateRejected,lateProvider);
  const lateOp=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE booking_id=$1',[lateRejected.id])).rows[0];
  process.env.NICEPAY_MID='TESTMID';process.env.NICEPAY_MERCHANT_KEY='TESTKEY';
  try {
    const body={operationId:lateOp.id,action:'reconcile_provider',signedResponse:signed(lateOp,{ResultCode:'2011'})};
    assert.equal((await route(m.reconcileRoute,G,body)).status,403);
    assert.equal((await route(m.reconcileRoute,D,{...body,signedResponse:signed(lateOp,{ResultCode:'2011',CancelAmt:'20000'})})).status,409);
    assert.equal((await route(m.reconcileRoute,D,body)).status,200);
    assert.equal((await read(lateRejected.id)).solo_guarantee_refund_status,'rejected');assert.equal(lateProvider.calls,1);
    const [reconciledRetry]=await rpc(c2,'retry_rejected_solo_refund_atomic',{p_operation_id:lateOp.id,p_admin_id:D});
    assert.notEqual(reconciledRetry.attempt_identity,lateOp.attempt_identity);
    assert.equal((await route(m.reconcileRoute,D,{operationId:op.id,action:'reconcile_provider',signedResponse:signed(op,{ResultCode:'2011'})})).status,409);
    assert.equal((await read(x.id)).solo_guarantee_refund_status,'refunded');
    record('late_signed_rejection_resolves_unknown_without_accepted_downgrade',{pass:true,externalCalls:1});
  } finally {delete process.env.NICEPAY_MID;delete process.env.NICEPAY_MERCHANT_KEY;if(oldMid)process.env.NICEPAY_MID=oldMid;if(oldKey)process.env.NICEPAY_MERCHANT_KEY=oldKey;}
  await claim(c2,(await pair('bank')).id);
  const diag=await rpc(c1,'solo_refund_diagnostics');assert.ok(diag.unknown>0&&diag.settlement_applied>0&&diag.manual_pending>0);record('bounded_aggregate_observability',{pass:true});
  await setup.query("INSERT INTO admin_job_runs(id,job_name,status,lease_token) VALUES(1,'experience_completion_sync','running','test-lease')");
  await m.finishSettlementSyncRunSuccess({supabaseAdmin:adapter(c1),runId:1,jobName:'experience_completion_sync',startedAt:new Date().toISOString(),leaseToken:'test-lease',processedCount:1,skippedCount:0});
  const job=(await setup.query('SELECT * FROM admin_job_runs WHERE id=1')).rows[0];
  assert.equal(job.status,'failed');assert.equal(job.error_message,'solo_refund_reconciliation_required');assert.ok(job.details.solo_refund_diagnostics.reconciliation_required>0);
  record('admin_job_success_cannot_conceal_unresolved_money',{pass:true});
  await setup.query("INSERT INTO admin_job_runs(id,job_name,status,lease_token) VALUES(2,'experience_completion_sync','running','manual-lease')");
  const manualOnly=Object.fromEntries(Object.keys(diag).map(k=>[k,k==='manual_pending'?1:0]));
  await m.finishSettlementSyncRunSuccess({supabaseAdmin:adapter(c2,{beforeRpc:async({name})=>name==='solo_refund_diagnostics'?{data:manualOnly,error:null}:undefined}),runId:2,jobName:'experience_completion_sync',startedAt:new Date().toISOString(),leaseToken:'manual-lease',processedCount:1,skippedCount:0});
  assert.equal((await setup.query('SELECT status FROM admin_job_runs WHERE id=2')).rows[0].status,'failed');
  record('admin_job_manual_pending_attention_without_card_unknown',{pass:true});
  async function ledgerFixture() {
    const slot=await pair('card',38000,'completed','not_applicable','nicepay');
    const [operation]=await claim(c1,slot.id);await begin(c1,operation.id);
    await rpc(c1,'record_solo_refund_outcome_atomic',{p_operation_id:operation.id,p_attempt_identity:operation.attempt_identity,p_outcome:'unknown',p_diagnostic_code:'provider_response_correlation_failed'});
    const op=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE id=$1',[operation.id])).rows[0];
    const booking=await read(slot.id);
    const numeric=new Set(['amount','host_payout_amount','platform_revenue','price_at_booking','refund_amount','solo_guarantee_price','solo_guarantee_refund_amount','total_experience_price','total_price']);
    const snapshot=Object.fromEntries(LEDGER_BOOKING_FIELDS.map(key=>[key,booking[key]==null?null:numeric.has(key)?Number(booking[key]):booking[key]]));
    const started=new Date(op.request_started_at).getTime(),captured=Date.now();
    const evidence={schema_version:1,evidence_source:'nicepay_merchant_ledger',provider:'nicepay',payment_method:'card',
      operation_id:op.id,booking_id:slot.id,attempt_identity:op.attempt_identity,operation_order_reference:op.order_reference,
      merchant_id:'TESTMID',original_transaction_id:op.transaction_reference,cancellation_transaction_id:'TESTMID-CANCEL-'+op.attempt_identity,
      original_amount:op.gross_amount,cancel_amount:op.requested_amount,remaining_amount:op.gross_amount-op.requested_amount,cancellation_count:1,
      original_approved_at:new Date(started-60_000).toISOString(),cancelled_at:new Date(Math.floor(started/1000)*1000).toISOString(),
      captured_at:new Date(captured).toISOString(),acquired_on:new Date(captured+9*60*60*1000).toISOString().slice(0,10),
      query_from:new Date(started-86_400_000).toISOString(),query_to:new Date(captured+86_400_000).toISOString(),
      query_scope:'original_order_all_states',transaction_state:'후취소',acquisition_state:'취소매입',provider_export_sha256:'a'.repeat(64),provider_verifier_account:'test-merchant-admin',
      verifying_admin_id:D,booking_snapshot:snapshot};
    return {slot,op,evidence};
  }
  const ledgerApply=(client,evidence)=>rpc(client,'reconcile_solo_refund_provider_ledger_accepted_atomic',prepareLedgerReconciliationProof(evidence).parameters);
  const money=async id=>{const b=await read(id);return {refund:Number(b.refund_amount),host:b.host_payout_amount,platform:b.platform_revenue,basis:Number(b.total_price),payout:b.payout_status};};
  const validLedger=await ledgerFixture();
  const notificationsBefore=(await setup.query('SELECT count(*)::int n FROM notifications')).rows[0].n;
  await assert.rejects(c1.query('INSERT INTO private.solo_refund_provider_ledger_evidence(operation_id) VALUES($1)',[validLedger.op.id]),{code:'42501'});
  await setup.query('BEGIN');await setup.query('SET LOCAL ROLE authenticated');
  await assert.rejects(setup.query('SELECT * FROM private.solo_refund_provider_ledger_evidence'),{code:'42501'});await setup.query('ROLLBACK');
  const canonical=(await setup.query("SELECT private.canonical_solo_ledger_json($1::jsonb) text",[JSON.stringify(validLedger.evidence)])).rows[0].text;
  assert.equal(crypto.createHash('sha256').update(canonical).digest('hex'),prepareLedgerReconciliationProof(validLedger.evidence).evidenceSha256);
  const originalNetwork=globalThis.fetch;let ledgerNetworkCalls=0;globalThis.fetch=()=>{ledgerNetworkCalls++;throw new Error('Ledger provider call forbidden');};
  try {
    const [result]=await ledgerApply(c1,validLedger.evidence);
    assert.equal(result.outcome,'accepted');assert.ok(result.settlement_applied_at);
    assert.equal(result.result_code,null);assert.equal(result.provider_refund_reference,null);
    assert.equal(result.proof_transaction_reference,validLedger.op.transaction_reference);
    assert.match(result.proof_reference,/^nicepay-ledger:[a-f0-9]{64}$/);
    assert.equal(result.delivery_state,'pending');assert.equal(result.delivery_attempts,0);
    assert.deepEqual(await money(validLedger.slot.id),{refund:38000,host:30400,platform:11400,basis:38000,payout:'pending'});
    assert.equal((await setup.query('SELECT count(*)::int n FROM notifications')).rows[0].n,notificationsBefore);
    const state=(await setup.query('SELECT to_jsonb(b) row FROM bookings b WHERE id=$1',[validLedger.slot.id])).rows[0];
    const ops=(await setup.query('SELECT to_jsonb(o) row FROM booking_solo_refund_operations o WHERE id=$1',[result.id])).rows[0];
    await ledgerApply(c2,validLedger.evidence);
    assert.deepEqual((await setup.query('SELECT to_jsonb(b) row FROM bookings b WHERE id=$1',[validLedger.slot.id])).rows[0],state);
    assert.deepEqual((await setup.query('SELECT to_jsonb(o) row FROM booking_solo_refund_operations o WHERE id=$1',[result.id])).rows[0],ops);
    assert.equal(ledgerNetworkCalls,0);
    assert.equal((await setup.query('SELECT count(*)::int n FROM notifications')).rows[0].n,notificationsBefore);
  } finally {globalThis.fetch=originalNetwork;}
  record('ledger_exact_unknown_accepted_atomic_settlement_and_same_evidence_replay',{pass:true,providerCalls:ledgerNetworkCalls});
  for (const [name,change] of [
    ['amount',p=>{p.cancel_amount++;p.remaining_amount--;}],['TID',p=>{p.original_transaction_id='OTHER-TID';}],
    ['MID',p=>{p.merchant_id='OTHER';p.cancellation_transaction_id='OTHER-CANCEL';}],
    ['gross',p=>{p.original_amount++;p.remaining_amount++;}],['snapshot',p=>{p.booking_snapshot.host_payout_amount++;}],
    ['booking',p=>{p.booking_id='OTHER';}],['attempt',p=>{p.attempt_identity=G;}],
    ['order',p=>{p.operation_order_reference='OTHER';}],['time',p=>{p.cancelled_at=new Date(Date.parse(p.cancelled_at)+60_000).toISOString();p.captured_at=p.cancelled_at;}],
  ]) {
    const f=await ledgerFixture(),bad=structuredClone(f.evidence);change(bad);
    await assert.rejects(ledgerApply(c1,bad),/SOLO_LEDGER_(OPERATION_MISMATCH|SNAPSHOT_CONFLICT|TIME_MISMATCH)/);
    assert.equal((await money(f.slot.id)).refund,0);
    assert.equal((await setup.query('SELECT count(*)::int n FROM private.solo_refund_provider_ledger_evidence WHERE operation_id=$1',[f.op.id])).rows[0].n,0);
    record('ledger_wrong_'+name+'_rejected',{pass:true});
  }
  for (const [name,patch] of [['payout_paid',"payout_status='paid'"],['booking_drift','platform_revenue=platform_revenue+1'],['not_completed',"status='confirmed'"]]) {
    const f=await ledgerFixture();
    // Local superuser fault injection models pre-existing corrupt/drifted rows.
    // Real money guards stay enabled for every RPC and all earlier race tests.
    await setup.query('BEGIN');await setup.query('SET LOCAL session_replication_role=replica');
    await setup.query('UPDATE bookings SET '+patch+' WHERE id=$1',[f.slot.id]);await setup.query('COMMIT');
    await assert.rejects(ledgerApply(c1,f.evidence),/SOLO_LEDGER_SNAPSHOT_CONFLICT/);
    assert.equal((await money(f.slot.id)).refund,0);record('ledger_'+name+'_rejected',{pass:true});
  }
  const impossible=await ledgerFixture(),impossibleParams=prepareLedgerReconciliationProof(impossible.evidence).parameters;
  impossibleParams.p_evidence.remaining_amount++;
  const {canonicalLedgerJson}=await import('../../scripts/financial/solo-refund-ledger-proof.mjs');
  impossibleParams.p_evidence_sha256=crypto.createHash('sha256').update(canonicalLedgerJson(impossibleParams.p_evidence)).digest('hex');
  await assert.rejects(rpc(c1,'reconcile_solo_refund_provider_ledger_accepted_atomic',impossibleParams),/SOLO_LEDGER_OPERATION_MISMATCH/);
  const rollback=await ledgerFixture();
  await setup.query(`CREATE FUNCTION private.reject_ledger_settlement_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${rollback.slot.id}' AND NEW.solo_guarantee_refund_status='refunded' THEN RAISE EXCEPTION 'LOCAL_SETTLEMENT_FAULT'; END IF; RETURN NEW; END $$; CREATE TRIGGER ledger_settlement_fault BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION private.reject_ledger_settlement_fixture();`);
  await assert.rejects(ledgerApply(c1,rollback.evidence),/LOCAL_SETTLEMENT_FAULT/);
  await setup.query('DROP TRIGGER ledger_settlement_fault ON bookings; DROP FUNCTION private.reject_ledger_settlement_fixture()');
  const rollbackOp=(await setup.query('SELECT * FROM booking_solo_refund_operations WHERE id=$1',[rollback.op.id])).rows[0];
  assert.equal(rollbackOp.outcome,'unknown');assert.equal(rollbackOp.proof_reference,null);assert.equal(rollbackOp.settlement_applied_at,null);
  assert.equal((await setup.query('SELECT count(*)::int n FROM private.solo_refund_provider_ledger_evidence WHERE operation_id=$1',[rollback.op.id])).rows[0].n,0);
  assert.equal((await money(rollback.slot.id)).refund,0);
  record('ledger_impossible_balance_and_settlement_failure_atomic_rollback',{pass:true});
  const secondEvidence=structuredClone(validLedger.evidence);secondEvidence.captured_at=new Date(Date.parse(secondEvidence.captured_at)+1).toISOString();
  await assert.rejects(ledgerApply(c1,secondEvidence),/SOLO_LEDGER_EVIDENCE_CONFLICT/);
  const wrongOperation=await ledgerFixture();const reused=prepareLedgerReconciliationProof(validLedger.evidence).parameters;reused.p_operation_id=wrongOperation.op.id;
  await assert.rejects(rpc(c1,'reconcile_solo_refund_provider_ledger_accepted_atomic',reused),/SOLO_LEDGER_PROOF_INVALID/);
  const reusedCancel=structuredClone(wrongOperation.evidence);reusedCancel.cancellation_transaction_id=validLedger.evidence.cancellation_transaction_id;
  await assert.rejects(ledgerApply(c1,reusedCancel),{code:'23505'});
  assert.equal((await money(wrongOperation.slot.id)).refund,0);
  record('ledger_second_evidence_and_cross_operation_digest_or_cancel_tid_rejected',{pass:true});
  const badAdmin=await ledgerFixture();badAdmin.evidence.verifying_admin_id=G;
  await assert.rejects(ledgerApply(c1,badAdmin.evidence),/SOLO_LEDGER_ADMIN_REQUIRED/);
  const wrongDigest=await ledgerFixture(),params=prepareLedgerReconciliationProof(wrongDigest.evidence).parameters;params.p_evidence_sha256='0'.repeat(64);
  await assert.rejects(rpc(c1,'reconcile_solo_refund_provider_ledger_accepted_atomic',params),/SOLO_LEDGER_DIGEST_MISMATCH/);
  record('ledger_real_admin_and_digest_required',{pass:true});
  const signedSettled=await ledgerFixture();await rpc(c1,'reconcile_solo_refund_accepted_atomic',{p_operation_id:signedSettled.op.id,p_result_code:'2001',p_refund_reference:'EXACT-PROVIDER-REF',p_amount:38000,p_transaction_reference:signedSettled.op.transaction_reference,p_order_reference:signedSettled.op.order_reference,p_admin_id:D});
  const signedState=await money(signedSettled.slot.id);await ledgerApply(c2,signedSettled.evidence);
  assert.deepEqual(await money(signedSettled.slot.id),signedState);
  assert.equal((await setup.query('SELECT count(*)::int n FROM private.solo_refund_provider_ledger_evidence WHERE operation_id=$1',[signedSettled.op.id])).rows[0].n,0);
  record('ledger_already_signed_settled_is_read_current_no_double_apply',{pass:true});
  const replayRace=await ledgerFixture();await Promise.all([ledgerApply(c1,replayRace.evidence),ledgerApply(c2,replayRace.evidence)]);
  assert.deepEqual(await money(replayRace.slot.id),{refund:38000,host:30400,platform:11400,basis:38000,payout:'pending'});
  record('ledger_concurrent_same_proof_exactly_once',{pass:true});
  const conflictRace=await ledgerFixture(),conflictProof=structuredClone(conflictRace.evidence);
  conflictProof.captured_at=new Date(Date.parse(conflictProof.captured_at)+1).toISOString();
  const conflictResults=await Promise.allSettled([ledgerApply(c1,conflictRace.evidence),ledgerApply(c2,conflictProof)]);
  assert.equal(conflictResults.filter(x=>x.status==='fulfilled').length,1);
  assert.match(conflictResults.find(x=>x.status==='rejected').reason.message,/SOLO_LEDGER_EVIDENCE_CONFLICT/);
  assert.deepEqual(await money(conflictRace.slot.id),{refund:38000,host:30400,platform:11400,basis:38000,payout:'pending'});
  record('ledger_concurrent_conflicting_proofs_one_winner_one_conflict',{pass:true});
  const guarded=await ledgerFixture();await assert.rejects(pay(c2,guarded.slot.id),/BOOKING_MONEY_UNRESOLVED/);
  assert.equal((await cancelClaim(c2,guarded.slot.id)).length,0);
  await ledgerApply(c1,guarded.evidence);
  const [subsequentCancel]=await cancelClaim(c2,guarded.slot.id);
  assert.ok(subsequentCancel);assert.equal(subsequentCancel.total_price,38000);
  assert.equal((await cancelClaim(c1,guarded.slot.id)).length,0);
  const finalMoney=await money(guarded.slot.id);assert.equal(finalMoney.refund+finalMoney.host+finalMoney.platform,guarded.op.gross_amount);
  record('ledger_payout_cancellation_guards_and_monetary_conservation',{pass:true});
  console.log('PAYOUT_REFUND_RACE_SAFE');console.log('DOUBLE_REFUND_PROTECTED');console.log('FINANCIAL_AUTHORITY_BYPASS_IMPOSSIBLE');
  console.log('PG17_P0_PASS',JSON.stringify({version,checks:checks.length}));
} finally { for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true}); }
