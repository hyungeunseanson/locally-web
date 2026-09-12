# Locally Cloudflare Workers cutover runbook

This is the canonical code and platform handoff for moving the complete Next.js application from Vercel to Cloudflare Workers. The repository is deploy-ready only after all remote gates below pass. Nothing in this runbook authorizes production writes, resource creation, deployment, DNS changes, or secret changes by itself.

The machine-readable source of names and classifications is [`config/cloudflare/migration-manifest.json`](../config/cloudflare/migration-manifest.json). `wrangler.jsonc` deliberately contains binding schemas and non-secret environment labels only. Never commit account IDs, Access tokens, Supabase keys, provider credentials, or resource IDs.

## Frozen runtime and adapter architecture

- Next.js `16.2.4`, React/React DOM `19.2.3`, Node `24.20.0` (`24.x` engine)
- `@opennextjs/cloudflare` `1.19.6`, Wrangler `4.129.1`, compatibility date `2026-09-08`
- App Router with Server Components, one Server Action module, 144 Route Handlers, SSR cookies, dynamic routes, and existing rewrites/redirects
- OpenNext R2 incremental cache, DO queue, and sharded DO tag cache with 12 base shards
- `regionalCache: false`, `enableCacheInterception: false`, and no automatic cache purge
- Cloudflare Images binding for the existing `/_next/image` path; public experience and host R2 variants remain direct/unoptimized
- Supabase PostgreSQL/Auth/RLS/RPC/Realtime/Storage remain the system of record. Browser Realtime WebSockets continue directly to Supabase.
- GitHub Actions remains the scheduler for current cron endpoints. No D1, Cloudflare Queues, or Cloudflare Cron migration is part of this cutover.

`app/middleware.ts` is not a Next.js root proxy and does not execute today. Creating `proxy.ts` would change Vercel and Cloudflare authentication behavior at the same time, so it stays deferred and is not a Cloudflare prerequisite. Current cookie refresh happens through the server Supabase client and is covered by the login/logout/session and OAuth canary gates.

## Vercel dependency audit

| Finding | Runtime decision |
| --- | --- |
| `@vercel/analytics` in the root layout | Removed. Google Analytics remains provider-neutral telemetry. |
| Hard-coded Vercel Analytics admin link | Removed. No account-specific Cloudflare dashboard URL is guessed. |
| `VERCEL_ENV` | `CLOUDFLARE_DEPLOYMENT_ENV` is the Cloudflare Sentry fallback. `VERCEL_ENV` remains after it only for the 14-day rollback origin. |
| `x-vercel-forwarded-for` | Retained as the final rollback-only IP fallback. `cf-connecting-ip` is preferred on Workers. |
| `automaticVercelMonitors: false` in Sentry config | This disables an optional integration and is not a Vercel runtime dependency. Keep it while the same Next config builds on both origins. |
| `next/dist/compiled/@vercel/og` | Next.js internal package used for metadata/OG rendering, not a Vercel service. OpenNext bundles its WASM/font assets. |
| `scripts/check-live-domain-parity.mjs` Vercel alias | Retained intentionally as the rollback-origin comparator until Vercel retirement. It is not imported by the application. |
| Vercel wording in archived/historical docs | Non-runtime history; it does not affect a Worker build. Operational steps in this file supersede it. |
| GitHub cron workflows | Provider-neutral HTTP callers. Change the protected `PROD_URL` only during the approved production cutover; keep `CRON_SECRET` equal at both origins during rollback. |
| `@tosspayments/payment-widget-sdk` | No active import was found, but it is not Vercel-specific. It is intentionally untouched because payment dependency cleanup is outside migration scope. Active runtime providers are PortOne, NICEPAY, and PayPal. |

Vercel remains a rollback origin for 14 days after cutover. Remove the two rollback-only fallbacks and the legacy parity alias only in a later Vercel-retirement PR.

## Workers compatibility audit and code resolutions

| Surface | Result | Evidence / gate |
| --- | --- | --- |
| App Router, SSR, RSC, Server Actions, redirects/rewrites, cookies | Build-compatible | Both `next build` and OpenNext build must pass. Remote RSC navigation is still mandatory. |
| Runtime project filesystem reads | Resolved | About/host landing assets use committed manifests. Static sitemap entries no longer `stat()` source files. Test-only email capture is the only application `fs` path and is unreachable in production unless explicitly configured. |
| Node `crypto`, Buffer, Nodemailer `net`/`tls` | Build-compatible | `nodejs_compat`; Gmail 465/587 must pass a real Worker `verify()` probe before cutover. |
| `unstable_cache`, SWR, `revalidateTag` | Remote hard gate | R2 + DO tests must prove 60 seconds, stale-while-revalidate, tag invalidation, cross-isolate, and multi-colo behavior. |
| Next 16 RSC/segment prefetch | Remote hard gate | No 503 is allowed during authenticated Link prefetch, RSC navigation, rapid navigation, or browser history. |
| Supabase SSR/Auth cookies | Remote hard gate | Password login/logout, persistence, token refresh, and real Google/Kakao callback journeys. |
| Supabase Realtime | Compatible by architecture | Browser connects to Supabase, not Access/Worker. Test inquiry messages, notifications, reconnect, and publication parity. |
| Supabase Storage | Remote hard gate | Synthetic staging uploads only; public fallback through `/_next/image` and cleanup. |
| `next/image` | Resolved in config, remote hard gate | `IMAGES` is bound in canary and production. Remote patterns accept only HTTPS Supabase public-object paths across production/staging refs. |
| Gmail/Nodemailer | Unknown until runtime | Do not replace Gmail preemptively. If either 465 or 587 is unstable in the Worker, a Resend migration is a cutover blocker and requires its own approval. |
| Sentry server SDK | Unknown until runtime | Verify a server event and source maps in the canary Sentry environment. `SENTRY_AUTH_TOKEN` is build-only. |
| PortOne/NICEPAY/PayPal | Build-compatible | Sandbox/test merchant only. No application financial logic changes are included. |
| Module-global public write limiter | Accepted parity risk | It remains ephemeral/per-isolate, as it was per Vercel instance. Do not claim it is a distributed rate limiter; add a separately reviewed platform rate limit if stronger global enforcement is required. |
| Worker memory / bundle / assets | Local hard gate | 128 MiB runtime memory is remote-observed; CI enforces bundle `<64 MiB`, at most 20,000 assets, and at most 25 MiB per asset. |

## Remote resources to provision explicitly

Provision exact names from the manifest; do not let OpenNext choose names and do not reuse public-image or backup buckets.

### Canary

1. Worker service `locally-web-opennext-canary`, initially without a route, `workers.dev`, or preview URL.
2. R2 bucket `locally-opennext-incremental-cache-canary` bound as `NEXT_INC_CACHE_R2_BUCKET`.
3. DO classes `DOQueueHandler` and `DOShardedTagCache`, declared by migration `opennext-cache-v1` and bound as `NEXT_CACHE_DO_QUEUE` and `NEXT_TAG_CACHE_DO_SHARDED`.
4. Self service binding `WORKER_SELF_REFERENCE` to `locally-web-opennext-canary`.
5. static assets binding `ASSETS` and Images binding `IMAGES`.
6. Worker-level Cloudflare Access application for the complete service, with a human Allow policy and an automation Service Auth policy.
7. One canary hostname/route attached only after Access exists.

The first approved bootstrap deploy creates the otherwise unreachable Worker and the explicitly declared DO namespaces. R2 is created beforehand with the exact command approved by the operator. This is Wrangler-managed provisioning from reviewed schema, not OpenNext remote auto-provisioning.

### Production

1. Worker service `locally-web-opennext-production` with `workers_dev=false` and `preview_urls=false`.
2. R2 bucket `locally-opennext-incremental-cache-production` bound as `NEXT_INC_CACHE_R2_BUCKET`.
3. The same two explicitly declared DO classes/bindings under the production Worker migration.
4. Self service binding to `locally-web-opennext-production`, `ASSETS`, and `IMAGES`.
5. Approved route/custom domain for the existing public hostname at cutover time only.

Never bind `locally-public-experience-canary`, `locally-public-host-profiles`, `locally-private-host-profile-stale`, or `locally-production-db-backups` as OpenNext cache storage.

## Variables and secrets

The manifest is exhaustive for names. Resolve every value from its current approved platform source; do not infer values.

### Build environment

- Required: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Optional source-map upload: `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG`, `SENTRY_PROJECT`, `CI=true`.
- Build separately for canary and production because `NEXT_PUBLIC_*` values are compiled into client chunks. Never promote a staging-built artifact to production.

### Worker core

- Vars: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the environment label already declared by Wrangler.
- Secret: `SUPABASE_SERVICE_ROLE_KEY`. The current server call graph uses the admin client beyond test seeding, so full application parity needs it in each Worker. Use only the separate staging key in canary.
- Feature variables and secrets are grouped in the manifest. Replicate only features currently enabled on the corresponding origin.

### Canary-only safety and runner values

- `CLOUDFLARE_FUNCTIONAL_CANARY_SECRET` is a Worker secret after Access passes.
- Safety vars must attest staging tier, exact staging ref, explicit write enablement, sandbox payment mode, and exactly one active write gate.
- Access service token, synthetic user credentials/IDs, inquiry ID, image URLs, and the runner copy of the staging service-role key are runner-only. Never expose them as browser-wide headers or Worker vars.
- Stage Gmail, one payment provider, and Sentry secrets only immediately before their individual gates. Remove them afterward until final canary approval.
- Google/Kakao client secrets live only in staging Supabase Auth provider configuration.

### Production feature parity

Before production deploy, compare the current Vercel environment name-by-name with the manifest and set the same active application features in the production Worker. At minimum validate cron, the active Gmail/Resend policy, active card provider, PayPal mode if enabled, translation providers, Sentry, Google/Kakao public client configuration, analytics/ads, bank display data, R2 public base URLs, and settlement tunables. No canary safety variable or canary secret belongs in production.

## Code and CI gates before remote provisioning

Run with Node `24.20.0` from a clean checkout:

```sh
npm ci
npm run lint
npm run test:e2e:auth-regression
npm run cloudflare:functional:contract
npm run cloudflare:migration:contract
npm run supabase:staging:contract
npm run build
npm run cloudflare:check
git diff --check
```

`cloudflare:check` validates the pins/manifest, renders all three placement configs, builds OpenNext, generates both environment types, performs canary and production Wrangler dry-runs, and enforces bundle/static-asset limits. CI runs the same sequence. A Vercel Preview must remain READY until production cutover.

## Canary deployment sequence

No command in this section is run without separate platform approval.

1. Create and verify a data-less persistent Supabase branch from Production (preferred), or a separate staging project. A branch already clones the Production schema, so do not replay the non-idempotent canonical baseline over it: run both read-only schema contracts and stop on any mismatch. Configure synthetic guest/host, minimal experience, inquiry/messages, notifications, storage images, and sandbox booking fixtures. Never use Production as fallback.
2. Build with canary `NEXT_PUBLIC_*` values and run all local gates.
3. Create only `locally-opennext-incremental-cache-canary` in R2.
4. Perform the initial no-route canary deployment from canonical `wrangler.jsonc`. Confirm the Worker, explicit DO migration, service binding, `ASSETS`, and `IMAGES`; confirm zero public-image bucket reuse.
5. Create Worker-level Access and policies. Attach the canary hostname only after Access is active.
6. With no high-sensitivity Worker secret present, prove an unauthenticated request is rejected before app code. Then prove the Access service token reaches the app.
7. Add canary core vars and only `CLOUDFLARE_FUNCTIONAL_CANARY_SECRET` plus staging `SUPABASE_SERVICE_ROLE_KEY`.
8. Run cache hard gates, then authenticated RSC/prefetch/Auth/Realtime/image/storage gates from `docs/cloudflare-functional-canary.md`.
9. Stage and remove Gmail credentials around the 465/587 probe. Stage and remove Sentry around its probe.
10. Stage one sandbox payment provider at a time and run only synthetic staging journeys. Production payment writes are forbidden.
11. Do not advance unless every gate passes and Worker memory/CPU/error observations are healthy.

## Seoul public read-only performance parity

This gate is separate from functional writes. It needs no service-role key and reads only public routes. Access headers are attached only to the exact Cloudflare canary origin and redirects are never followed by the probe, preventing leakage to Vercel, Supabase, Google, or Kakao.

Compare the same routes for Vercel and three sequential canary deployments: canonical/default placement, Smart Placement, and an explicit Placement Hint derived from the verified staging Supabase API hostname. The pinned Wrangler schema represents the hint as `mode: "targeted"` plus `hostname`. Sequential reuse of the protected canary Worker is simpler than provisioning three duplicate cache/DO stacks.

For each profile:

1. Generate `.wrangler/placement/wrangler.<profile>.jsonc` with `npm run cloudflare:placement:render -- --profile=<profile>`. The hint profile refuses non-hosted or unverified staging Supabase.
2. With separate approval, deploy that generated config to the same Access-protected canary.
3. From the designated Seoul probe host, set the two exact origins, allowlisted Cloudflare host, public synthetic experience/user IDs, Access service token, `CLOUDFLARE_PERFORMANCE_RUNNER_REGION=seoul`, and the profile name.
4. Run `npm run cloudflare:performance:measure`. It captures header TTFB, full response latency, status/error rate, p50, and p95 for `/`, `/search`, `/experiences/[id]`, `/users/[id]`, and `/api/home/experiences`.
5. After all profiles, run `npm run cloudflare:performance:compare`. At least one profile must pass every route against its same-run Vercel control. Review raw reports even when the default thresholds pass.
6. Restore canonical/default placement unless the measured winner is explicitly approved for production.

The default gate allows at most 1% Cloudflare errors, at most +0.5 percentage points over Vercel, p50 no worse than `1.20x + 50 ms`, and p95 no worse than `1.25x + 100 ms`, for both TTFB and full latency.

## Production cutover

Use canary-domain validation followed by one production route switch. Do not add a percentage/cookie front-door Worker: it adds a second Worker, complicates auth cookies and OAuth/payment callbacks, and makes cache and rollback diagnosis harder at Locally's scale.

1. Freeze the approved Git SHA and record Vercel deployment ID/health, production Supabase health, current DNS, OAuth callbacks, payment callbacks, cron URL, and Worker configuration export.
2. Create production cache R2 only, perform an unreachable/no-route production Worker bootstrap, and verify explicit DO/service/assets/images bindings.
3. Configure production vars/secrets from the approved Vercel parity inventory and build a fresh production artifact with production `NEXT_PUBLIC_*` values.
4. Run production dry-run/artifact gates and a read-only origin smoke. Do not run financial writes against Production.
5. Ensure Google/Kakao and Supabase Auth allow the stable production `/auth/callback`. Update external PortOne/NICEPAY/PayPal notification/return URLs to the stable custom domain when required; no provider may depend solely on `*.vercel.app` after Vercel retirement.
6. Switch the existing production route/custom domain to the production Worker in one change. Keep the public hostname unchanged.
7. Immediately verify public routes, SSR/RSC, cookies/login, read-only Realtime connection, images, email observability, cron authorization, Sentry, and provider callback reachability. Watch Cloudflare and Sentry errors plus Seoul latency.
8. Keep Vercel deployed and healthy as an unadvertised rollback origin for at least 14 days. Do not delete project, env, or aliases during this window.
9. After 14 stable days and explicit retirement approval, remove Vercel origin/callback dependencies and rollback-only code in a separate PR.

## Rollback

Rollback is a route/DNS origin reversal, not a database rollback. Supabase remains shared and schema/data are not changed by this migration.

1. Trigger rollback for sustained 5xx/503, auth/session or OAuth failure, cache/tag inconsistency, Realtime reconnect failure, broken image transforms, unstable SMTP, lost Sentry visibility, payment callback failure, or Seoul parity breach.
2. Route the stable production hostname back to the recorded READY Vercel deployment.
3. Restore the recorded GitHub `PROD_URL` and any provider callback endpoint changed away from the stable hostname/rollback alias.
4. Confirm login/session, public reads, callbacks, cron, and error rates on Vercel. Do not clear or mutate Supabase to roll back compute.
5. Leave the Cloudflare Worker and caches isolated for forensic inspection; do not purge cache automatically. Fix forward in a new PR and rerun the full canary.

## Remaining remote-only blockers

- Separate staging Supabase project and its schema/storage/Auth provider configuration
- Explicit Cloudflare Worker/R2/DO/Access/route provisioning and account binding verification
- `unstable_cache`/SWR/tag invalidation cross-isolate and multi-colo proof
- Next 16 authenticated RSC/segment prefetch 503 proof
- Real Google and Kakao OAuth round trips behind Access
- Realtime reconnect and synthetic storage writes
- Gmail 465/587 Worker runtime stability
- Sentry server event/source-map proof
- PortOne/NICEPAY/PayPal sandbox journeys
- Seoul default/Smart/Supabase-hint measurements and selected placement approval
- Worker memory/CPU observation under canary load
- External OAuth/payment/cron console parity immediately before cutover

When these pass, no further migration code is required before the production route switch.
