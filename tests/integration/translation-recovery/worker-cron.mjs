import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  Miniflare,
  convertV4MiniflareOptions,
  kCurrentWorker,
  Log,
  LogLevel,
} from "miniflare";

export async function verifyWorkerCron({ sql, restPort, token, record }) {
  const directories = JSON.parse(process.env.TRANSLATION_WORKER_ARTIFACT_DIRS);
  const config = JSON.parse(await readFile("wrangler.jsonc", "utf8")).env
    .production;
  await sql(
    "TRUNCATE bookings,service_bookings,service_requests,notifications,admin_support_unread_alert_batches,admin_job_runs CASCADE",
  );
  const baseline = await readFile(
    "supabase/migrations/20260912034545_production_schema_baseline.sql",
    "utf8",
  );
  await sql("SET check_function_bodies=false");
  for (const name of ["list_due_experience_completion_candidates"]) {
    const m = baseline.match(
      new RegExp(
        "CREATE OR REPLACE FUNCTION public\\." +
          name +
          "\\([\\s\\S]*?\\$function\\$;",
      ),
    );
    assert(m);
    await sql(m[0]);
  }
  for (const [file, name] of [
    [
      "20260916111416_review_tour_end_db_foundation.sql",
      "list_due_experience_review_request_candidates",
    ],
    [
      "20260923084232_one_time_review_request_reminders.sql",
      "claim_due_review_request_reminders",
    ],
  ]) {
    const source = await readFile("supabase/migrations/" + file, "utf8");
    const match = source.match(
      new RegExp(
        "CREATE (?:OR REPLACE )?FUNCTION public\\." +
          name +
          "\\([\\s\\S]*?\\$function\\$;",
      ),
    );
    assert(match, name);
    await sql(match[0]);
  }
  await sql(
    await readFile(
      "supabase/migrations/20260912050655_service_concierge_assignment.sql",
      "utf8",
    ),
  );
  await sql(
    await readFile(
      "supabase/migrations/20260923013312_ops_anomaly_monitor_snapshot.sql",
      "utf8",
    ),
  );
  await sql(
    await readFile(
      "supabase/migrations/20261005104924_solo_guarantee_financial_authority.sql",
      "utf8",
    ),
  );
  const financialBaseline = await readFile(
    "tests/fixtures/targeted-card-closeout/baseline.sql",
    "utf8",
  );
  await sql(
    financialBaseline.match(
      /CREATE OR REPLACE FUNCTION public\.confirm_experience_payment_atomic\([\s\S]*?\$function\$;/,
    )[0],
  );
  await sql(
    await readFile(
      "docs/financial/installed/20261009035059_targeted_nicepay_ab_closeout.sql",
      "utf8",
    ),
  );
  await sql(
    "GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;NOTIFY pgrst,'reload schema'",
  );
  await new Promise((r) => setTimeout(r, 300));
  for (const [label, directory] of Object.entries(directories)) {
    const dir = path.resolve(directory),
      files = (await readdir(dir)).filter(
        (x) =>
          x === "cloudflare-worker.js" ||
          x.endsWith(".wasm") ||
          x.endsWith(".ttf.bin"),
      );
    const modules = files
      .map((x) => ({
        type: x.endsWith(".js")
          ? "ESModule"
          : x.endsWith(".wasm")
            ? "CompiledWasm"
            : "Data",
        path: path.join(dir, x),
      }))
      .sort(
        (a, b) =>
          (a.type === "ESModule" ? -1 : 1) - (b.type === "ESModule" ? -1 : 1),
      );
    const bindings = {
      ...config.vars,
      CF_VERSION_METADATA: { id: label },
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: token,
      SUPABASE_SERVICE_ROLE_KEY: token,
      CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
      OPS_ANOMALY_MONITOR_CLOUDFLARE_API_TOKEN: "isolated-readonly-metrics",
    };
    for (const flag of [
      "EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED",
      "HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED",
      "ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED",
      "NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED",
      "EXPERIENCE_COMPLETION_SCHEDULED_ENABLED",
      "SERVICE_COMPLETION_SCHEDULED_ENABLED",
      "CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED",
      "OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED",
    ])
      bindings[flag] = "true";
    const requests = [];
    const mf = new Miniflare({
      ...convertV4MiniflareOptions({
        modules,
        modulesRoot: dir,
        compatibilityDate: config.compatibility_date ?? "2026-09-08",
        compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
        bindings,
        r2Buckets: config.r2_buckets.map((x) => x.binding),
        durableObjects: Object.fromEntries(
          config.durable_objects.bindings.map((x) => [
            x.name,
            { className: x.class_name, useSQLite: true },
          ]),
        ),
        queueProducers: Object.fromEntries(
          config.queues.producers.map((x) => [x.binding, "local-" + x.queue]),
        ),
        serviceBindings: {
          WORKER_SELF_REFERENCE: kCurrentWorker,
          ASSETS: () => new Response("", { status: 404 }),
        },
        outboundService: async (req) => {
          const u = new URL(req.url);
          if (u.hostname === "api.cloudflare.com") {
            assert.equal(req.method, "GET");
            const queueNames = [
              "locally-experience-translation-production",
              "locally-experience-translation-dlq-production",
              "locally-public-experience-media-mirror-production",
              "locally-public-experience-media-mirror-dlq-production",
            ];
            return Response.json({
              success: true,
              result: u.pathname.endsWith("/metrics")
                ? { backlog_count: 0, oldest_message_timestamp_ms: 0 }
                : queueNames.map((queue_name, i) => ({
                    queue_name,
                    queue_id: String(i),
                  })),
            });
          }
          assert.equal(
            u.hostname,
            "abcdefghijklmnopqrst.supabase.co",
            "No external provider calls allowed",
          );
          const local =
            `http://127.0.0.1:${restPort}` +
            u.pathname.replace(/^\/rest\/v1/, "") +
            u.search;
          const response = await fetch(local, {
            method: req.method,
            headers: req.headers,
            ...(req.method === "GET" || req.method === "HEAD"
              ? {}
              : { body: await req.arrayBuffer() }),
          });
          requests.push({
            path: u.pathname,
            status: response.status,
            ...(!response.ok ? { error: await response.clone().text() } : {}),
          });
          return response;
        },
      }),
      log: new Log(LogLevel.NONE),
      telemetry: { enabled: false },
    });
    try {
      const worker = await mf.getWorker();
      for (const cron of config.triggers.crons) {
        requests.length = 0;
        const outcomes = await Promise.all([
          worker.scheduled({ cron, scheduledTime: Date.now() }),
          worker.scheduled({ cron, scheduledTime: Date.now() }),
        ]);
        assert(
          outcomes.every((x) => x.outcome === "ok"),
          JSON.stringify({ label, cron, outcomes, requests }),
        );
        assert(
          requests.every(
            (r) =>
              r.status < 400 ||
              (r.status === 409 &&
                r.path === "/rest/v1/admin_job_runs" &&
                r.error.includes("23505")),
          ),
          JSON.stringify({ label, cron, requests }),
        );
        record(label + " exact generated Worker concurrent Cron " + cron);
      }
    } finally {
      await mf.dispose();
    }
  }
}
