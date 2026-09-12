# Cloudflare functional canary gate

This suite is the functional half of the canonical [Workers cutover runbook](./cloudflare-workers-cutover-runbook.md). Repository changes do not provision or deploy Cloudflare resources. The suite must run only against the named Cloudflare canary and an isolated Supabase staging backend. A data-less persistent branch of the Production project is preferred; a separate staging project is also supported. Both receive their own project ref, API/Auth/Storage endpoints, and credentials. The guards refuse the known Production ref `uhinvcydgzqlpnvieyal`, the Locally production domain, Vercel hosts, an unverified staging target, and non-sandbox payment mode.

## Mandatory account-edge protection before secrets

Protect the complete `locally-web-opennext-canary` Worker with a Cloudflare Access self-hosted application whose destination type is `worker` (production and preview traffic). This is mandatory before the Worker receives a staging service-role key, Gmail credentials, payment credentials, or Sentry server credentials. Access is the right boundary here because Cloudflare evaluates every request before the Worker runs; adding a second application authentication system would duplicate Supabase Auth without protecting unauthenticated execution at the edge.

The canary configuration sets both `workers_dev` and `preview_urls` to `false`. During a separately approved provisioning phase, create the otherwise unreachable Worker service first, attach the Worker-level Access application and its policies, and only then add a dedicated canary hostname/route. Do not create a path-scoped exception or a second hostname Access application that overrides the Worker policy. Configure both an interactive Allow policy for human OAuth checks and a Service Auth policy for automation. No high-sensitivity Worker secret may be staged until `npm run cloudflare:functional:remote:access` proves that a request containing the valid Locally canary secret but no Access credentials is rejected with 302/401/403 and never reaches the readiness route, while the same route succeeds with the Access service token.

Locally Realtime does not traverse this Worker. `app/utils/supabase/client.ts` creates a browser Supabase client, and `NotificationContext`/`useChat` open channels directly to the staging Supabase Realtime hostname. Worker-level Access therefore does not proxy or terminate that WebSocket. The Realtime runtime gate still verifies the actual browser socket and reconnect behavior.

For Google/Kakao, a human signs in to Access first and retains the canary-origin `CF_Authorization` cookie while the browser visits Supabase and the provider, then returns through the staging Supabase allowlisted canary `/auth/callback`. Automation uses `CF-Access-Client-Id` and `CF-Access-Client-Secret` only through an exact-canary-origin Playwright route. That route fetches only one hop (`maxRedirects: 0`) and returns the redirect response to the browser, so a newly created cross-origin request cannot inherit the Access headers. Every APIRequestContext call carrying the token also disables redirects. Never use Playwright `extraHTTPHeaders`, never attach these headers to Supabase/provider requests, and keep the OAuth request assertion that both headers are absent.

## Adapter resources required before the first remote run

- Worker: `locally-web-opennext-canary`
- Access: Worker-level self-hosted application targeting the complete canary Worker, with human Allow and automation Service Auth policies
- Incremental-cache R2: `locally-opennext-incremental-cache-canary` (new and dedicated; never any public-image or backup bucket)
- Durable Objects: `DOQueueHandler` bound as `NEXT_CACHE_DO_QUEUE`; `DOShardedTagCache` bound as `NEXT_TAG_CACHE_DO_SHARDED`
- Images binding: `IMAGES` in both canary and production. This is selected instead of a custom loader because public experience/host R2 images already bypass optimization while account, chat, payment, OAuth avatars, and other existing `next/image` call sites still depend on `/_next/image`. A global custom loader would change those URLs and semantics.
- Service binding: `WORKER_SELF_REFERENCE` -> `locally-web-opennext-canary`
- Static assets binding: `ASSETS`

No existing bucket may be reused: `locally-public-experience-canary`, `locally-public-host-profiles`, `locally-private-host-profile-stale`, and `locally-production-db-backups` are explicitly out of scope.

## Required Worker vars

- `CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED=true`
- `CLOUDFLARE_FUNCTIONAL_CANARY_ALLOW_STAGING_WRITES=true`
- `CLOUDFLARE_FUNCTIONAL_CANARY_SUPABASE_TIER=staging`
- `CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_SUPABASE_PROJECT_REF` (the separately approved staging ref)
- `CLOUDFLARE_FUNCTIONAL_CANARY_STAGING_PROJECT_VERIFIED=true` (operator attestation after checking the project dashboard)
- `CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE` (`auth`, `realtime`, `storage`, `portone`, `nicepay`, or `paypal`; select exactly the gate being run)
- `CLOUDFLARE_FUNCTIONAL_CANARY_PAYMENT_MODE=sandbox`
- `CLOUDFLARE_FUNCTIONAL_CANARY_GOOGLE_OAUTH=true`
- `CLOUDFLARE_FUNCTIONAL_CANARY_KAKAO_OAUTH=true`
- `NEXT_PUBLIC_SITE_URL` (canary HTTPS origin)
- `NEXT_PUBLIC_SUPABASE_URL` (staging only)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (staging only)
- `CARD_PAYMENT_PROVIDER` (`portone` and `nicepay` are exercised in separate sandbox/test-merchant runs)
- `NEXT_PUBLIC_PORTONE_IMP_CODE` (test merchant only)
- `NICEPAY_MID` (test merchant only)
- `PAYPAL_ENV=sandbox`
- `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (dedicated canary environment; add only for the Sentry gate)
- existing public image-manifest base URL vars used by the current R2 read-only path

## Secret ownership and staged injection

### Worker runtime only

- `CLOUDFLARE_FUNCTIONAL_CANARY_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` for the isolated staging branch/project. This is not merely a Realtime seed key: the current application imports `createAdminClient()` across server routes, actions, public detail rendering, notifications, booking/payment, and admin paths. It is therefore required in the Worker for full application parity, but only after Access is proven. The browser must never receive it.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally a Worker var/public browser value, not a secret.

### Runner only

- `CLOUDFLARE_ACCESS_CLIENT_ID`, `CLOUDFLARE_ACCESS_CLIENT_SECRET`
- `CLOUDFLARE_CANARY_GUEST_PASSWORD`, `CLOUDFLARE_CANARY_HOST_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` in the isolated test-runner secret store for Realtime seed/cleanup. It has the same staging value as the Worker secret but a separate scope and must never be passed to the browser.
- Any sandbox-provider test-user password needed for a manual/browser journey

### Worker secrets staged only for their gate

- Gmail gate: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_GMAIL_USER`, `ADMIN_GMAIL_APP_PASSWORD`. Add immediately before the 465/587 probe and remove after it until the full email canary is approved. Do not add `RESEND_API_KEY`; the purpose is to exercise the existing Gmail path.
- PortOne gate: `PORTONE_API_KEY`, `PORTONE_API_SECRET` with `ACTIVE_WRITE_GATE=portone` and a test merchant.
- NICEPAY gate: `NICEPAY_MERCHANT_KEY` with `ACTIVE_WRITE_GATE=nicepay` and a test MID.
- PayPal gate: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` with `ACTIVE_WRITE_GATE=paypal` and `PAYPAL_ENV=sandbox`.
- Sentry gate: `SENTRY_DSN` only for the server runtime probe. `SENTRY_AUTH_TOKEN` is build/CI-only and must not be stored as a Worker secret; `SENTRY_ORG`, `SENTRY_PROJECT`, and environment labels are configuration, not runtime secrets.

`CRON_SECRET`, `GEMINI_API_KEY`, `XAI_API_KEY`, and Resend credentials are used by existing runtime paths but are not required for the initial functional gates and must not be injected as part of this canary step. Google/Kakao provider secrets remain in the separate staging Supabase Auth provider configuration, not in the Worker or runner.

## Runner-only configuration

- `CLOUDFLARE_CANARY_BASE_URL`, `CLOUDFLARE_CANARY_ALLOWED_HOST`
- `CLOUDFLARE_ACCESS_CLIENT_ID`, `CLOUDFLARE_ACCESS_CLIENT_SECRET` (service token accepted only by the canary Access policy)
- `CLOUDFLARE_CANARY_MIN_ISOLATES` (hard gate: integer >= 2)
- optional `CLOUDFLARE_CANARY_MULTI_COLO_URLS` (two or more independently routed URLs)
- optional `CLOUDFLARE_CANARY_MULTI_COLO_ALLOWED_HOSTS` (exact comma-separated allowlist)
- `CLOUDFLARE_CANARY_GUEST_EMAIL`, `CLOUDFLARE_CANARY_GUEST_PASSWORD`, `CLOUDFLARE_CANARY_GUEST_USER_ID`
- `CLOUDFLARE_CANARY_HOST_EMAIL`, `CLOUDFLARE_CANARY_HOST_PASSWORD`, `CLOUDFLARE_CANARY_HOST_USER_ID`
- `CLOUDFLARE_CANARY_INQUIRY_ID`
- `CLOUDFLARE_CANARY_STAGING_SUPABASE_IMAGE_URL`
- `CLOUDFLARE_CANARY_PUBLIC_R2_IMAGE_URL` (read-only approved public object)

## Hard gates after provisioning

0. **Staging prerequisite:** remote Auth/Realtime/Storage/financial write gates are blocked until a data-less persistent Supabase staging branch (preferred) or separate staging project has been created and independently verified. Its URL-derived ref must exactly equal the declared staging ref and must differ from `uhinvcydgzqlpnvieyal`. Production Supabase is never an emergency or temporary fallback. Repository automation does not create the branch/project.
1. Run `npm run cloudflare:functional:remote:access` before any high-sensitivity secret is added. Anonymous traffic must be stopped by Access before OpenNext executes. A valid service token must reach the app. This remains a hard gate on every canary hostname.
2. Run `npm run cloudflare:functional:remote:cache`. It proves one R2-backed value across observed isolates, the 60-second stale-while-revalidate boundary, `revalidateTag(..., 'max')`, and optional multi-colo parity. The isolate minimum must remain at least two.
3. Set `CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE=realtime`, explicitly enable staging writes, and run `npm run cloudflare:functional:remote:runtime`. Readiness must report `safe: true`, the exact declared staging ref must match the configured URL, and the active gate backend must be configured. The suite proves Worker-origin login/logout/session persistence, catches every 5xx RSC response during Link prefetch/rapid/history navigation, validates local and staging-Supabase `/_next/image`, reads the existing R2 path, verifies Gmail authentication on 465 and 587 without sending, and proves Realtime message/notification delivery plus reconnect.
4. Set `CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE=auth`, require `safe: true`, then complete real Google and Kakao provider login/callback/logout in separate staging browser sessions. Access must already be authenticated; the staging Supabase redirect allowlist must contain the exact canary callback. The automated test covers callback-origin construction and verifies Access headers are absent from the Supabase authorization request. Provider UI completion remains manual because provider MFA/CAPTCHA cannot be deterministic.
5. Set `CLOUDFLARE_FUNCTIONAL_CANARY_ACTIVE_WRITE_GATE=storage`, then reuse `03-live-host-signup-registration.spec.ts` and `04-live-host-experience-create.spec.ts` for staging-only host profile and experience image uploads. Verify cleanup and Supabase fallback. Never point their environment at production.
6. Stage only one provider's credentials and select the matching `portone`, `nicepay`, or `paypal` active write gate. Reuse the existing contract suites, then execute one isolated staging booking/callback/cancellation/refund/payout journey with only sandbox/test-merchant credentials. The readiness endpoint must report both `safe: true` and the selected provider configured before any write.
7. Run the existing `200-admin-sentry-test-route.spec.ts`, then separately invoke the canary admin Sentry route with a staging admin and confirm one server event in the canary Sentry environment. Sentry remains a remote runtime gate; source-map credentials are build-only.

Any cache/RSC 503, inconsistent generation ID, missing cross-isolate observation, OAuth callback mismatch, Realtime reconnect failure, image transformation mismatch, SMTP instability, Sentry event loss, or non-sandbox financial target blocks cutover.
