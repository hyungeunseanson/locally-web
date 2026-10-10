// Disposable PG17 + genuine PostgREST, synthetic rows, loopback only.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createHmac } from "node:crypto";
const tools = process.env.TRANSLATION_PG17_MODULES,
  binary = process.env.TRANSLATION_POSTGREST;
assert(
  tools && binary,
  "Set isolated PG17 module directory and PostgREST executable",
);
const require = createRequire(join(tools, "../package.json"));
const EmbeddedPostgres = require("embedded-postgres").default;
const { build } = await import("esbuild");
const root = process.cwd();
await mkdir(".wrangler", { recursive: true });
const dir = await mkdtemp(join(tmpdir(), "translation-p1-"));
const port = async () => {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
};
const pgPort = await port(),
  restPort = await port();
const pg = new EmbeddedPostgres({
  databaseDir: join(dir, "db"),
  user: "postgres",
  password: "synthetic-only",
  port: pgPort,
  persistent: false,
  postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
  onLog() {},
  onError() {},
});
let db, rest;
const checks = [];
const record = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const secret = "translation-local-fixture-secret-at-least-32";
const jwt = (role) => {
  const p =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
  return p + "." + createHmac("sha256", secret).update(p).digest("base64url");
};
const headers = {
  Authorization: "Bearer " + jwt("service_role"),
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const request = async (path, body, method = "POST", role = "service_role") => {
  const r = await fetch(`http://127.0.0.1:${restPort}/` + path, {
    method,
    headers: { ...headers, Authorization: "Bearer " + jwt(role) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
};
const rpc = async (name, args) => {
  const r = await request("rpc/" + name, args);
  assert(r.status < 300, JSON.stringify(r));
  return r.data;
};
const patch = (table, filter, body) =>
  request(table + "?" + filter, body, "PATCH");
const sql = async (s, args = []) => (await db.query(s, args)).rows;
const payload = (t, text = "Translated title") => ({
  ["title_" + t.target_locale]: text,
  ["description_" + t.target_locale]: "A complete English description.",
  ...Object.fromEntries(
    [
      "meeting_point_i18n",
      "supplies_i18n",
      "inclusions_i18n",
      "exclusions_i18n",
      "itinerary_i18n",
      "rules_i18n",
    ].map((k) => [
      k,
      {
        [t.target_locale]:
          k.includes("inclusions") ||
          k.includes("exclusions") ||
          k.includes("itinerary")
            ? []
            : k.includes("rules")
              ? {}
              : "",
      },
    ]),
  ),
  translation_meta: {
    [t.target_locale]: {
      mode: "ai",
      status: "ready",
      version: t.translation_version,
    },
  },
});
const lease = async () => {
  const rows = await rpc("lease_experience_translation_task", {
    p_provider: "gemini",
    p_lease_seconds: 30,
    p_reserved_tokens: 1,
  });
  return rows[0];
};
const finalize = (t, p = payload(t), role = "service_role") =>
  request(
    "rpc/finalize_experience_translation_task",
    {
      p_task_id: t.id,
      p_translation_version: t.translation_version,
      p_lease_expires_at: t.lease_expires_at,
      p_payload: p,
    },
    "POST",
    role,
  );
const row = async (id) =>
  (
    await sql("SELECT * FROM public.experience_translation_tasks WHERE id=$1", [
      id,
    ])
  )[0];
const reset = async () => {
  await sql(
    "TRUNCATE private.translation_completion_receipts,public.experience_translation_tasks,public.experience_translation_jobs,public.experiences RESTART IDENTITY CASCADE",
  );
  await sql(
    "UPDATE public.translation_provider_state SET dispatched_requests=0,dispatched_tokens=0,window_started_at=now(),cooldown_until=NULL",
  );
  await sql(
    "INSERT INTO public.experiences(id,title,description,price,source_locale,translation_version) OVERRIDING SYSTEM VALUE VALUES(42,'서울 체험','서울 여행을 소개합니다',100,'ko',1)",
  );
  const j = (
    await sql(
      "INSERT INTO public.experience_translation_jobs(experience_id,translation_version,source_locale) VALUES(42,1,'ko') RETURNING id",
    )
  )[0].id;
  await sql(
    "INSERT INTO public.experience_translation_tasks(job_id,experience_id,translation_version,source_locale,target_locale,provider) VALUES($1,42,1,'ko','en','gemini')",
    [j],
  );
};
const expire = async (t, status = "processing") => {
  await sql(
    "UPDATE public.experience_translation_tasks SET status=$2,lease_expires_at=date_trunc('milliseconds',now()-interval '1 second') WHERE id=$1",
    [t.id, status],
  );
};
try {
  await pg.initialise();
  await pg.start();
  db = pg.getPgClient("postgres", "127.0.0.1");
  await db.connect();
  assert.match(
    (await sql("SELECT current_setting('server_version') v"))[0].v,
    /^17\./,
  );
  await sql(
    "CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE SCHEMA private;",
  );
  const baseline = await readFile(
    "supabase/migrations/20260912034545_production_schema_baseline.sql",
    "utf8",
  );
  for (const table of [
    "experiences",
    "experience_translation_jobs",
    "experience_translation_tasks",
    "translation_provider_state",
  ]) {
    const match = baseline.match(
      new RegExp(
        'create table "public"\\."' + table + '" \\([\\s\\S]*?\\n\\);',
      ),
    );
    assert(match, table);
    await sql(match[0]);
  }
  for (const line of baseline
    .split("\n")
    .filter(
      (x) =>
        /^alter table only "public"\."(experiences|experience_translation_jobs|experience_translation_tasks|translation_provider_state)" add constraint/.test(
          x,
        ) && !x.includes("FOREIGN KEY"),
    ))
    await sql(line);
  for (const name of [
    "lease_experience_translation_task",
    "record_translation_provider_outcome",
  ])
    for (const m of baseline.matchAll(
      new RegExp(
        "CREATE OR REPLACE FUNCTION public\\." +
          name +
          "\\([\\s\\S]*?\\$function\\$;",
        "g",
      ),
    ))
      await sql(m[0]);
  await sql(
    "GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;",
  );
  await sql(
    "ALTER TABLE public.experiences ADD COLUMN media_revision bigint NOT NULL DEFAULT 0;CREATE FUNCTION private.bump_experience_media_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN NEW.media_revision:=OLD.media_revision+1;RETURN NEW;END$$;CREATE TRIGGER experience_media_revision BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION private.bump_experience_media_revision()",
  );
  const leaseOidsBefore = await sql(
    "SELECT oid::text,pronargs FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='lease_experience_translation_task' ORDER BY pronargs",
  );
  const migrationSql = await readFile(
    "supabase/migrations/20261010102639_translation_queue_recovery_p1.sql",
    "utf8",
  );
  await sql(
    "INSERT INTO public.experiences(id,title,price,translation_version) OVERRIDING SYSTEM VALUE VALUES(42,'fixture',100,1);WITH j AS (INSERT INTO public.experience_translation_jobs(experience_id,translation_version,source_locale) VALUES(42,1,'ko') RETURNING id) INSERT INTO public.experience_translation_tasks(job_id,experience_id,translation_version,source_locale,target_locale,provider,status) SELECT id,42,1,'ko','en','gemini','processing' FROM j",
  );
  await assert.rejects(
    sql(migrationSql),
    /translation_migration_requires_no_inflight_leases/,
  );
  await sql("ROLLBACK");
  assert.equal(
    (
      await sql(
        "SELECT to_regclass('private.translation_completion_receipts') AS relation",
      )
    )[0].relation,
    null,
  );
  await sql(
    "TRUNCATE public.experience_translation_tasks,public.experience_translation_jobs,public.experiences",
  );
  record("installation refuses in-flight legacy leases with no partial DDL");
  await sql(
    await readFile(
      "supabase/migrations/20261010102639_translation_queue_recovery_p1.sql",
      "utf8",
    ),
  );
  assert.deepEqual(
    await sql(
      "SELECT oid::text,pronargs FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='lease_experience_translation_task' ORDER BY pronargs",
    ),
    leaseOidsBefore,
  );
  await sql(
    "INSERT INTO public.translation_provider_state(provider,model,max_concurrency,rpm_limit,tpm_limit,window_seconds) VALUES('gemini','fixture',10,1000,100000,60),('grok','fixture',10,1000,100000,60)",
  );
  rest = spawn(binary, [], {
    env: {
      PATH: process.env.PATH,
      DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH,
      PGRST_DB_URI: `postgres://postgres:synthetic-only@127.0.0.1:${pgPort}/postgres`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(restPort),
      PGRST_JWT_SECRET: secret,
      PGRST_LOG_LEVEL: "error",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let restErrors = "";
  rest.stderr.on("data", (d) => (restErrors += d));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${restPort}/`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, "PostgREST startup failed: " + restErrors);
  await reset();
  let t = await lease();
  assert(t);
  let r = await finalize(t);
  assert.equal(r.data, true, JSON.stringify(r));
  assert.equal((await row(t.id)).status, "completed");
  assert.equal(
    (await sql("SELECT status FROM public.experience_translation_jobs"))[0]
      .status,
    "completed",
  );
  assert.equal(
    (await sql("SELECT media_revision FROM public.experiences"))[0]
      .media_revision,
    "1",
  );
  record(
    "normal atomic finalization, job aggregate and existing media revision trigger",
  );
  assert.equal((await finalize(t)).data, true);
  assert.equal(
    (
      await sql(
        "SELECT count(*) n FROM private.translation_completion_receipts",
      )
    )[0].n,
    "1",
  );
  record("duplicate finalization and ACK-loss retry");
  for (const role of ["anon", "authenticated"])
    assert(
      [401, 403, 404].includes((await finalize(t, payload(t), role)).status),
    );
  record("anonymous/authenticated RPC denial");
  await reset();
  t = await lease();
  await sql(
    "CREATE FUNCTION public.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected';END$$;CREATE TRIGGER fixture_fail AFTER UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.fixture_fail()",
  );
  r = await finalize(t);
  assert(r.status >= 400);
  assert.equal(
    (await sql("SELECT title_en FROM public.experiences"))[0].title_en,
    null,
  );
  assert.equal((await row(t.id)).status, "leased");
  await sql(
    "DROP TRIGGER fixture_fail ON public.experiences;DROP FUNCTION public.fixture_fail()",
  );
  assert.equal(
    (await sql("SELECT status FROM public.experience_translation_jobs"))[0]
      .status,
    "queued",
  );
  assert.equal(
    (
      await sql(
        "SELECT count(*) n FROM private.translation_completion_receipts",
      )
    )[0].n,
    "0",
  );
  record(
    "failure after task/job writes rolls back experience/task/job/receipt",
  );
  for (const status of ["leased", "processing"]) {
    await reset();
    t = await lease();
    await expire(t, status);
    const next = await lease();
    assert(next && next.id !== t.id && next.translation_version === 2);
    assert.equal((await row(t.id)).status, "cancelled");
    assert.equal((await finalize(t)).data, false);
    assert.equal((await finalize(next)).data, true);
    record(status + " expiry rotates identity and version fence");
  }
  await reset();
  t = await lease();
  await patch("experience_translation_tasks", "id=eq." + t.id, {
    status: "processing",
  });
  r = await patch(
    "experiences",
    "id=eq.42&translation_version=eq.1",
    payload(t),
  );
  assert(r.status < 300, JSON.stringify(r));
  assert.equal((await row(t.id)).status, "completed");
  await patch("experience_translation_tasks", "id=eq." + t.id, {
    status: "processing",
  });
  assert.equal((await row(t.id)).status, "completed");
  record("legacy split write atomically completes before lost task PATCH");
  await reset();
  t = await lease();
  await expire(t);
  const next = await lease();
  r = await patch(
    "experiences",
    "id=eq.42&translation_version=eq.1",
    payload(t, "Late old title"),
  );
  assert.deepEqual(r.data, []);
  await patch("experience_translation_tasks", "id=eq." + t.id, {
    status: "completed",
  });
  assert.equal((await row(t.id)).status, "cancelled");
  assert.equal((await finalize(next)).data, true);
  record("late old Worker cannot overwrite reclaimed generation");
  await reset();
  t = await lease();
  await sql(
    "UPDATE public.experiences SET translation_version=2,title_en='Latest source' WHERE id=42",
  );
  assert.equal((await finalize(t)).data, false);
  assert.equal(
    (await sql("SELECT title_en FROM public.experiences"))[0].title_en,
    "Latest source",
  );
  record("newer source version protected");
  await reset();
  await sql(
    "ALTER TABLE public.experiences DISABLE TRIGGER translation_legacy_finalize_p1;UPDATE public.experiences SET manual_locales=ARRAY['en'],title_en='Manual title',description_en='Manual description' WHERE id=42;ALTER TABLE public.experiences ENABLE TRIGGER translation_legacy_finalize_p1",
  );
  t = await lease();
  assert.equal((await finalize(t)).data, true);
  assert.equal(
    (await sql("SELECT title_en FROM public.experiences"))[0].title_en,
    "Manual title",
  );
  record("manual locale survives legacy/new finalization");
  await reset();
  t = await lease();
  await sql(
    "UPDATE public.experience_translation_tasks SET status='cancelled' WHERE id=$1",
    [t.id],
  );
  assert.equal((await finalize(t)).data, false);
  record("cancellation wins before completion");
  await reset();
  const leases = await Promise.all([lease(), lease()]);
  assert.equal(leases.filter(Boolean).length, 1);
  record("concurrent duplicate wakes lease one task");
  await reset();
  assert.equal((await lease()).translation_version, 1);
  assert.equal(await lease(), undefined);
  record("no eligible task differs from existing in-flight task");

  // Bundle both real repository/consumer implementations. Only the AI boundary is synthetic.
  const entry =
    "export * from './app/utils/experienceTranslation/worker';export * from './app/utils/experienceTranslation/queueConsumer';export * from './app/utils/experienceTranslation/queueMessage';";
  const implementations = {};
  for (const revision of ["old", "new"]) {
    const target = join(
      root,
      ".wrangler",
      "translation-" + revision + "-native.cjs",
    );
    await build({
      stdin: { contents: entry, resolveDir: root, loader: "ts" },
      outfile: target,
      bundle: true,
      platform: "node",
      format: "cjs",
      packages: "external",
      tsconfig: "tsconfig.json",
      plugins:
        revision === "old"
          ? [
              {
                name: "protected-worker-source",
                setup(b) {
                  b.onLoad(
                    {
                      filter: /app\/utils\/experienceTranslation\/worker\.ts$/,
                    },
                    () => ({
                      contents: execFileSync(
                        "git",
                        [
                          "show",
                          "53e89e18e23f1f56498e3395edf590c7211fd551:app/utils/experienceTranslation/worker.ts",
                        ],
                        { encoding: "utf8" },
                      ),
                      loader: "ts",
                      resolveDir: resolve("app/utils/experienceTranslation"),
                    }),
                  );
                },
              },
            ]
          : [],
    });
    implementations[revision] = createRequire(import.meta.url)(target);
  }
  const nativeFetch = globalThis.fetch;
  for (const [firstName, secondName] of [
    ["old", "old"],
    ["old", "new"],
    ["new", "old"],
    ["new", "new"],
  ]) {
    for (const fault of ["task-completion", "provider-outcome", "ack"]) {
      await reset();
      let calls = 0,
        ack = 0,
        retry = 0,
        injected = false;
      const transport = async (input, init = {}) => {
        const u = new URL(String(input));
        assert.equal(u.hostname, "127.0.0.1");
        assert.equal(u.port, String(restPort));
        u.pathname = u.pathname.replace(/^\/rest\/v1/, "");
        const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
        if (
          !injected &&
          ((fault === "task-completion" &&
            u.pathname === "/experience_translation_tasks" &&
            body.status === "completed") ||
            (fault === "provider-outcome" &&
              u.pathname === "/rpc/record_translation_provider_outcome"))
        ) {
          injected = true;
          return new Response(
            JSON.stringify({ message: "synthetic transport fault" }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }
        return nativeFetch(u, init);
      };
      const env = {
        CLOUDFLARE_DEPLOYMENT_ENV: "production",
        EXPERIENCE_TRANSLATION_QUEUE_ENABLED: "true",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${restPort}`,
        SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
        GEMINI_API_KEY: "synthetic",
        TRANSLATION_WORKER_BATCH_SIZE: "1",
      };
      const deliver = async (name, attempt) => {
        const impl = implementations[name],
          d = impl.createExperienceTranslationWorkerDependencies(env, {
            explicitCredentials: true,
            fetch: transport,
          });
        d.translateGemini = async () => {
          calls++;
          return {
            title: "Seoul walking tour",
            description: "Explore Seoul with a local guide.",
            meetingPoint: "",
            supplies: "",
            inclusions: [],
            exclusions: [],
            itinerary: [],
            rules: {
              age_limit: "",
              activity_level: "",
              refund_policy: "",
              host_notice: "",
            },
            totalTokens: 12,
          };
        };
        await impl.handleExperienceTranslationQueueBatch(
          {
            queue: impl.EXPERIENCE_TRANSLATION_QUEUE_NAME,
            messages: [
              {
                body: impl.createExperienceTranslationQueueMessage(
                  "job-created",
                  0,
                  "native_test_0001",
                ),
                attempts: attempt,
                ack() {
                  if (fault === "ack" && !injected) {
                    injected = true;
                    throw Error("synthetic ACK loss");
                  }
                  ack++;
                },
                retry() {
                  retry++;
                },
              },
            ],
          },
          env,
          { createDependencies: () => d, log() {} },
        );
      };
      await deliver(firstName, 1);
      assert.equal(
        (await sql("SELECT status FROM public.experience_translation_tasks"))[0]
          .status,
        "completed",
        `${firstName}/${fault}`,
      );
      await deliver(secondName, 2);
      assert.equal(calls, 1);
      assert(ack >= 1);
      if (injected) assert.equal(retry, 1);
      assert.equal(
        (await sql("SELECT status FROM public.experience_translation_jobs"))[0]
          .status,
        "completed",
      );
      record(
        `${firstName} -> ${secondName}: ${fault}, one AI call, terminal task/job`,
      );
    }
  }
  await reset();
  t = await lease();
  await expire(t);
  r = await finalize({
    ...t,
    lease_expires_at: (await row(t.id)).lease_expires_at.toISOString(),
  });
  assert(r.status >= 400);
  assert.equal((await row(t.id)).status, "processing");
  assert(await lease());
  record("expired finalization preserves recovery eligibility");

  await reset();
  t = await lease();
  const bad = payload(t);
  delete bad.translation_meta;
  r = await patch("experiences", "id=eq.42&translation_version=eq.1", bad);
  assert(r.status >= 400);
  assert.equal((await row(t.id)).status, "leased");
  record("ready metadata absent cannot certify partial payload");
  await reset();
  await sql("UPDATE public.experiences SET meeting_point='서울역' WHERE id=42");
  t = await lease();
  r = await finalize(t, payload(t));
  assert(r.status >= 400);
  assert.equal((await row(t.id)).status, "leased");
  record("nonempty source body requires real target field");
  await reset();
  t = await lease();
  r = await finalize(t, { ...payload(t), price: 1 });
  assert(r.status >= 400);
  assert.equal(
    Number((await sql("SELECT price FROM public.experiences"))[0].price),
    100,
  );
  record("RPC payload cannot change price or unrelated fields");
  await reset();
  t = await lease();
  await sql("BEGIN;SELECT id FROM public.experiences WHERE id=42 FOR UPDATE");
  const waiting = finalize(t);
  await patch("experience_translation_tasks", "id=eq." + t.id, {
    status: "cancelled",
  });
  await sql("COMMIT");
  assert.equal((await waiting).data, false);
  assert.equal((await row(t.id)).status, "cancelled");
  record("cancellation competes with blocked finalization");
  await reset();
  t = await lease();
  const duplicated = await Promise.all([finalize(t), finalize(t)]);
  assert(duplicated.every((x) => x.data === true));
  assert.equal(
    (
      await sql(
        "SELECT count(*) n FROM private.translation_completion_receipts",
      )
    )[0].n,
    "1",
  );
  record("concurrent finalization one receipt and commit");
  await reset();
  t = await lease();
  await sql(
    "INSERT INTO public.experience_translation_tasks(job_id,experience_id,translation_version,source_locale,target_locale,provider) VALUES($1,42,1,'ko','ja','grok')",
    [t.job_id],
  );
  assert.deepEqual(
    await rpc("lease_experience_translation_task", {
      p_provider: "grok",
      p_reserved_tokens: 1,
    }),
    [],
  );
  assert.equal((await finalize(t)).data, true);
  const ja = (
    await rpc("lease_experience_translation_task", {
      p_provider: "grok",
      p_reserved_tokens: 1,
    })
  )[0];
  assert(ja);
  assert.equal(
    (await finalize(ja, payload(ja, "Japanese fixture text"))).data,
    true,
  );
  assert.equal(
    (await sql("SELECT title_en FROM public.experiences"))[0].title_en,
    "Translated title",
  );
  assert.equal(
    (await sql("SELECT status FROM public.experience_translation_jobs"))[0]
      .status,
    "completed",
  );
  record(
    "cross-provider locale serialization preserves sibling translation and aggregate",
  );
  await reset();
  t = await lease();
  await patch("experience_translation_tasks", "id=eq." + t.id, {
    status: "retryable",
    lease_expires_at: null,
    not_before: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal(await lease(), undefined);
  const rotated = (
    await sql(
      "SELECT * FROM public.experience_translation_tasks WHERE status='queued'",
    )
  )[0];
  assert.equal(rotated.translation_version, 2);
  assert.equal((await row(t.id)).status, "cancelled");
  assert.equal(await lease(), undefined);
  assert.equal(
    (await sql("SELECT translation_version FROM public.experiences"))[0]
      .translation_version,
    2,
  );
  record("retryable rotates once and retains provider backoff");
  for (const name of ["old", "new"]) {
    const impl = implementations[name];
    let ack = 0,
      retry = 0;
    for (let attempt = 1; attempt <= 6; attempt++)
      await impl.handleExperienceTranslationQueueBatch(
        {
          queue: impl.EXPERIENCE_TRANSLATION_QUEUE_NAME,
          messages: [
            {
              body: { invalid: true },
              attempts: attempt,
              ack() {
                ack++;
              },
              retry() {
                retry++;
              },
            },
          ],
        },
        { CLOUDFLARE_DEPLOYMENT_ENV: "production" },
        {
          createDependencies() {
            throw Error("invalid message must not reach DB");
          },
          log() {},
        },
      );
    assert.equal(ack, 0);
    assert.equal(retry, 6);
    record(
      name +
        " invalid-message retries through provider max_retries=5 boundary (DLQ routing provider contract)",
    );
  }
  const catalog = await sql(
    "SELECT p.proname,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) owner,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('lease_experience_translation_task','finalize_experience_translation_task')",
  );
  assert.equal(catalog.length, 3);
  for (const c of catalog) {
    assert.equal(c.owner, "postgres");
    assert.equal(c.prosecdef, true);
    assert.equal(c.anon, false);
    assert.equal(c.authenticated, false);
    assert.equal(c.service, true);
    assert.deepEqual(c.proconfig, ["search_path=pg_catalog, public"]);
  }
  record("catalog owner definer search path and all overload ACLs");

  for (const [lateName, recoveryName] of [
    ["old", "new"],
    ["new", "old"],
  ]) {
    await reset();
    let release, entered;
    const providerEntered = new Promise((r) => (entered = r)),
      providerGate = new Promise((r) => (release = r));
    let calls = 0;
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${restPort}`,
      SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
      GEMINI_API_KEY: "synthetic",
      TRANSLATION_WORKER_BATCH_SIZE: "1",
    };
    const transport = (input, init) => {
      const u = new URL(String(input));
      assert.equal(u.hostname, "127.0.0.1");
      u.pathname = u.pathname.replace(/^\/rest\/v1/, "");
      return nativeFetch(u, init);
    };
    const deps = (name, late) => {
      const d = implementations[
        name
      ].createExperienceTranslationWorkerDependencies(env, {
        explicitCredentials: true,
        fetch: transport,
      });
      d.translateGemini = async () => {
        calls++;
        if (late) {
          entered();
          await providerGate;
        }
        return {
          title: late ? "Late stale title" : "Recovered current title",
          description: "Explore Seoul with a local guide.",
          meetingPoint: "",
          supplies: "",
          inclusions: [],
          exclusions: [],
          itinerary: [],
          rules: {},
          totalTokens: 12,
        };
      };
      return d;
    };
    const first = implementations[lateName].runExperienceTranslationWorker(
      deps(lateName, true),
    );
    await providerEntered;
    t = (
      await sql(
        "SELECT * FROM experience_translation_tasks WHERE status='processing'",
      )
    )[0];
    await expire(t);
    const recovered = await implementations[
      recoveryName
    ].runExperienceTranslationWorker(deps(recoveryName, false));
    assert.equal(recovered.completed, 1);
    release();
    await first;
    assert.equal((await row(t.id)).status, "cancelled");
    assert.equal(
      (await sql("SELECT title_en FROM experiences"))[0].title_en,
      "Recovered current title",
    );
    assert.equal(
      (
        await sql(
          "SELECT count(*) n FROM experience_translation_tasks WHERE status='completed'",
        )
      )[0].n,
      "1",
    );
    assert.equal(calls, 2);
    record(
      `${lateName} late provider versus ${recoveryName} reclaim: current result retained, no stale task writes`,
    );
  }
  await sql(
    await readFile(
      "supabase/staging/translation-recovery-contract.sql",
      "utf8",
    ),
  );
  record("read-only post-install catalog contract");
  await (
    await import("./cron-database.mjs")
  ).verifyCronDatabase({ sql, rpc, record });
  if (process.env.TRANSLATION_WORKER_ARTIFACT_DIRS)
    await (
      await import("./worker-cron.mjs")
    ).verifyWorkerCron({ sql, restPort, token: jwt("service_role"), record });
  console.log(
    JSON.stringify({
      checks: checks.length,
      postgres: (await sql("SELECT version() v"))[0].v,
      postgrest: execFileSync(binary, ["--version"], {
        encoding: "utf8",
      }).trim(),
      productionCalls: 0,
    }),
  );
  await writeFile(
    ".wrangler/translation-recovery-native.json",
    JSON.stringify({ checks, productionCalls: 0 }, null, 2),
  );
} finally {
  rest?.kill("SIGTERM");
  await db?.end().catch(() => {});
  await pg.stop().catch(() => {});
  await rm(dir, { recursive: true, force: true });
}
