import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Real SQL mutation boundaries reached by the five unchanged Cron handlers.
// Does not claim email/provider delivery or complete generated-Worker coverage.
export async function verifyCronDatabase({ sql, rpc, record }) {
  const baseline = await readFile(
    "supabase/migrations/20260912034545_production_schema_baseline.sql",
    "utf8",
  );
  const existing = new Set(
    (
      await sql("SELECT tablename FROM pg_tables WHERE schemaname='public'")
    ).map((r) => r.tablename),
  );
  for (const m of baseline.matchAll(
    /create table "public"\."([^"]+)" \([\s\S]*?\n\);/g,
  ))
    if (!existing.has(m[1])) await sql(m[0]);
  for (const line of baseline
    .split("\n")
    .filter(
      (x) =>
        /^alter table only "public"\."/.test(x) &&
        x.includes(" add constraint ") &&
        !x.includes("FOREIGN KEY"),
    )) {
    const table = line.match(/"public"\."([^"]+)"/)[1];
    if (!existing.has(table)) await sql(line);
  }
  for (const line of baseline
    .split("\n")
    .filter((x) => /^CREATE (UNIQUE )?INDEX /.test(x)))
    await sql(line.replace("INDEX ", "INDEX IF NOT EXISTS "));
  await sql(
    "CREATE SCHEMA auth;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claims',true)::jsonb->>'role'$$",
  );
  await sql(
    "ALTER TABLE public.bookings ADD COLUMN payment_claim_state text,ADD COLUMN payment_claim_expires_at timestamptz,ADD COLUMN payment_provider text,ADD COLUMN payment_provider_reference text,ADD COLUMN payment_claim_token uuid",
  );
  const sources = [
    baseline,
    await readFile(
      "supabase/migrations/20260922081710_experience_payment_claim_and_pending_cleanup.sql",
      "utf8",
    ),
    await readFile(
      "supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql",
      "utf8",
    ),
  ];
  const names = [
    "refresh_experience_popularity_snapshot",
    "claim_due_admin_support_unread_alert_batches",
    "prune_notifications_retention",
    "complete_experience_booking_if_due_atomic",
    "complete_service_booking_if_due_atomic",
    "cancel_expired_pending_bookings_atomic",
  ];
  for (const source of sources)
    for (const name of names) {
      const m = source.match(
        new RegExp(
          "CREATE OR REPLACE FUNCTION public\\." +
            name +
            "\\([\\s\\S]*?\\$function\\$;",
        ),
      );
      if (m) await sql(m[0]);
    }
  await sql(
    "CREATE UNIQUE INDEX IF NOT EXISTS fixture_review_request_unique ON notifications(booking_id) WHERE type='review_request' AND booking_id IS NOT NULL;CREATE UNIQUE INDEX IF NOT EXISTS fixture_guest_review_request_unique ON notifications(booking_id) WHERE type='guest_review_request' AND booking_id IS NOT NULL;GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;NOTIFY pgrst,'reload schema'",
  );
  await new Promise((r) => setTimeout(r, 300));
  await sql(
    "INSERT INTO public.wishlists(user_id,experience_id) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',42)",
  );
  await Promise.all([rpc(names[0], {}), rpc(names[0], {})]);
  assert.equal(
    (
      await sql(
        "SELECT wishlist_count FROM experience_popularity_snapshot WHERE experience_id=42",
      )
    )[0].wishlist_count,
    1,
  );
  record("Cron daily snapshot concurrent rebuild retains exact count");
  await sql(
    "INSERT INTO admin_support_unread_alert_batches(inquiry_id,is_active,alert_due_at) VALUES(100,true,now()-interval '1 hour')",
  );
  const alerts = await Promise.all([
    rpc(names[1], { p_limit: 50 }),
    rpc(names[1], { p_limit: 50 }),
  ]);
  assert.equal(alerts.flat().length, 1);
  assert.equal((await rpc(names[1], { p_limit: 50 })).length, 0);
  record("Cron 10-minute admin alert concurrent claim once");
  await sql(
    "INSERT INTO notifications(user_id,type,title,message,created_at,is_read) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','general','fixture','fixture',now()-interval '365 days',true),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','profile_demographics_required','fixture','fixture',now()-interval '365 days',false)",
  );
  const pruned = await Promise.all([
    rpc(names[2], { p_cutoff: new Date(Date.now() - 86400000).toISOString() }),
    rpc(names[2], { p_cutoff: new Date(Date.now() - 86400000).toISOString() }),
  ]);
  assert.equal(
    pruned.reduce((a, b) => a + b, 0),
    1,
  );
  assert.equal(
    (
      await sql(
        "SELECT count(*) n FROM notifications WHERE type='profile_demographics_required'",
      )
    )[0].n,
    "1",
  );
  record("Cron retention duplicate cleanup preserves protected notice");
  await sql(
    "INSERT INTO bookings(id,order_id,experience_id,status,date,time,user_id,amount) VALUES('native-complete','native-complete',42,'PAID',current_date-2,'10:00','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100)",
  );
  const completion = await Promise.all([
    rpc(names[3], { p_booking_id: "native-complete" }),
    rpc(names[3], { p_booking_id: "native-complete" }),
  ]);
  assert.equal(completion.flat().filter((x) => x.completed).length, 1);
  assert.equal(
    (
      await sql(
        "SELECT count(*) n FROM notifications WHERE booking_id='native-complete' AND type='review_request'",
      )
    )[0].n,
    "1",
  );
  record(
    "Cron completion concurrent booking transition and review notification once",
  );
  await sql(
    "INSERT INTO bookings(id,order_id,experience_id,status,created_at,payment_method,amount) VALUES('native-expired','native-expired',42,'pending',now()-interval '2 days','card',100);INSERT INTO bookings(id,order_id,experience_id,status,created_at,payment_method,amount,payment_claim_state,payment_claim_expires_at) VALUES('native-claimed','native-claimed',42,'pending',now()-interval '2 days','card',100,'processing',now()+interval '1 hour')",
  );
  const cancelled = await Promise.all([
    rpc(names[5], { p_batch_size: 100 }),
    rpc(names[5], { p_batch_size: 100 }),
  ]);
  assert.equal(
    cancelled.flat().reduce((n, r) => n + r.cancelled_count, 0),
    1,
  );
  assert.equal(
    (await sql("SELECT status FROM bookings WHERE id='native-claimed'"))[0]
      .status,
    "pending",
  );
  assert.equal(
    (
      await sql("SELECT refund_amount FROM bookings WHERE id='native-expired'")
    )[0].refund_amount,
    0,
  );
  record(
    "Cron cancellation concurrency preserves in-flight payment and cancels once",
  );
  await sql(
    "INSERT INTO service_requests(id,user_id,title,description,city,service_date,start_time,duration_hours,status) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixture','fixture','Seoul',current_date-2,'10:00',4,'paid');INSERT INTO service_bookings(id,order_id,request_id,customer_id,amount,status) VALUES('native-service','native-service','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,'PAID')",
  );
  const service = await Promise.all([
    rpc(names[4], { p_booking_id: "native-service" }),
    rpc(names[4], { p_booking_id: "native-service" }),
  ]);
  assert.equal(service.flat().filter((x) => x.completed).length, 1);
  assert.equal(
    (
      await sql(
        "SELECT status FROM service_requests WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'",
      )
    )[0].status,
    "completed",
  );
  assert.equal(
    (
      await sql("SELECT amount FROM service_bookings WHERE id='native-service'")
    )[0].amount,
    100,
  );
  record(
    "Cron service completion duplicate request and booking transition once",
  );
}
