# Cloudflare functional canary gate

This PR prepares the tests but does not provision or deploy Cloudflare resources. The suite must run only against the named Cloudflare canary and a disposable Supabase staging project. It refuses the Locally production domain, Vercel hosts, the production Supabase project ref, and non-sandbox PayPal/payment mode.

## Adapter resources required before the first remote run

- Worker: `locally-web-opennext-canary`
- Incremental-cache R2: `locally-opennext-incremental-cache-canary` (new and dedicated; never any public-image or backup bucket)
- Durable Objects: `DOQueueHandler` bound as `NEXT_CACHE_DO_QUEUE`; `DOShardedTagCache` bound as `NEXT_TAG_CACHE_DO_SHARDED`
- Images binding: `IMAGES`. This is selected instead of a custom loader because public experience/host R2 images already bypass optimization while account, chat, payment, OAuth avatars, and other existing `next/image` call sites still depend on `/_next/image`. A global custom loader would change those URLs and semantics.
- Service binding: `WORKER_SELF_REFERENCE` -> `locally-web-opennext-canary`
- Static assets binding: `ASSETS`

No existing bucket may be reused: `locally-public-experience-canary`, `locally-public-host-profiles`, `locally-private-host-profile-stale`, and `locally-production-db-backups` are explicitly out of scope.

## Required Worker vars

- `CLOUDFLARE_FUNCTIONAL_CANARY_ENABLED=true`
- `CLOUDFLARE_FUNCTIONAL_CANARY_ALLOW_STAGING_WRITES=true`
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
- `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (dedicated canary environment)
- existing public image-manifest base URL vars used by the current R2 read-only path

## Required Worker secrets

- `CLOUDFLARE_FUNCTIONAL_CANARY_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (staging only)
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- `ADMIN_GMAIL_USER`, `ADMIN_GMAIL_APP_PASSWORD`
- `PORTONE_API_KEY`, `PORTONE_API_SECRET` (sandbox/test merchant only)
- `NICEPAY_MERCHANT_KEY` (sandbox/test merchant only)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (sandbox only)
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT` and existing Sentry upload/auth secrets only if the separate server probe is approved

## Runner-only configuration

- `CLOUDFLARE_CANARY_BASE_URL`, `CLOUDFLARE_CANARY_ALLOWED_HOST`
- `CLOUDFLARE_CANARY_MIN_ISOLATES` (hard gate: integer >= 2)
- optional `CLOUDFLARE_CANARY_MULTI_COLO_URLS` (two or more independently routed URLs)
- optional `CLOUDFLARE_CANARY_MULTI_COLO_ALLOWED_HOSTS` (exact comma-separated allowlist)
- `CLOUDFLARE_CANARY_GUEST_EMAIL`, `CLOUDFLARE_CANARY_GUEST_PASSWORD`, `CLOUDFLARE_CANARY_GUEST_USER_ID`
- `CLOUDFLARE_CANARY_HOST_EMAIL`, `CLOUDFLARE_CANARY_HOST_PASSWORD`, `CLOUDFLARE_CANARY_HOST_USER_ID`
- `CLOUDFLARE_CANARY_INQUIRY_ID`
- `CLOUDFLARE_CANARY_STAGING_SUPABASE_IMAGE_URL`
- `CLOUDFLARE_CANARY_PUBLIC_R2_IMAGE_URL` (read-only approved public object)

## Hard gates after provisioning

1. Run `npm run cloudflare:functional:remote:cache`. It proves one R2-backed value across observed isolates, the 60-second stale-while-revalidate boundary, `revalidateTag(..., 'max')`, and optional multi-colo parity. The isolate minimum must remain at least two.
2. Run `npm run cloudflare:functional:remote:runtime`. It proves Worker-origin login/logout/session persistence, catches every 5xx RSC response during Link prefetch/rapid/history navigation, validates local and staging-Supabase `/_next/image`, reads the existing R2 path, verifies Gmail authentication on 465 and 587 without sending, and proves Realtime message/notification delivery plus reconnect.
3. Complete real Google and Kakao provider login/callback/logout in separate staging browser sessions. The automated test covers callback-origin construction; provider UI completion remains a manual gate because provider MFA/CAPTCHA cannot be made deterministic.
4. Reuse `03-live-host-signup-registration.spec.ts` and `04-live-host-experience-create.spec.ts` for staging-only host profile and experience image uploads. Verify cleanup and Supabase fallback. Never point their environment at production.
5. Reuse the existing PortOne, NICEPAY, and PayPal contract suites, then execute one isolated staging booking/callback/cancellation/refund/payout journey with only sandbox/test-merchant credentials. Production writes are forbidden. PayPal must report `PAYPAL_ENV=sandbox` and the readiness endpoint must report `safe: true` before any write.
6. Run the existing `200-admin-sentry-test-route.spec.ts`, then separately invoke the canary admin Sentry route with a staging admin and confirm one server event in the canary Sentry environment. This PR does not migrate the Sentry runtime.

Any cache/RSC 503, inconsistent generation ID, missing cross-isolate observation, OAuth callback mismatch, Realtime reconnect failure, image transformation mismatch, SMTP instability, Sentry event loss, or non-sandbox financial target blocks cutover.
