# Solo guarantee financial P0 regressions

The native suite starts a disposable PostgreSQL **17** server bound exclusively to `127.0.0.1`, opens four independent connections, creates synthetic rows before applying the new migration, and runs the actual application helpers/routes with real grants, RLS, locks and RPCs. It does not accept a remote database URL. Provider, auth and outbound email boundaries are synthetic; no Production credentials or money calls are required.

Install native test dependencies in an external temporary directory (matching the repository's existing native PostgreSQL regression convention):

```sh
npm install --prefix /tmp/locally-financial-p0-deps embedded-postgres@17.6.0-beta.15 pg esbuild
SOLO_PG17_MODULES=/tmp/locally-financial-p0-deps/node_modules npm run test:solo-guarantee-p0:native
npm run test:solo-guarantee-p0:browser
```

The browser suite uses installed esbuild/Playwright, serves only a loopback fixture and mounts the actual guest page, NotificationProvider, receipt, host earnings summary/chart and refund labels. Supabase/Auth/API responses are synthetic. It requires an installed Playwright Chromium browser. It never invokes payment or cancellation APIs.

`fixtures/solo-pre-p0-schema.json` contains schema columns/constraints and six schema-only Production function definitions captured read-only. It contains no customer rows, provider payloads, credentials or real transaction references. All six definition MD5s were freshly compared with current Production on 2026-10-05; see `docs/solo-guarantee-p0-production-precheck.json`. The fixture includes the live completion definition with the 42702 regression, so the migration must actually fix native PostgreSQL behavior.

Relevant existing pure server contracts run with loopback-only fake configuration:

```sh
NODE_OPTIONS=--conditions=react-server NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-p0-anon SUPABASE_SERVICE_ROLE_KEY=local-p0-service CRON_SECRET=local-p0-cron npx playwright test -c playwright.financial-p0.config.ts tests/e2e/199-solo-guarantee-refund-contract.spec.ts tests/e2e/142-booking-finance-fallback.spec.ts tests/e2e/90-booking-cancel-policy.spec.ts tests/e2e/231-admin-manual-final-payout.spec.ts tests/e2e/255-experience-completion-cloudflare-cron.spec.ts
NODE_OPTIONS=--conditions=react-server NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-p0-anon SUPABASE_SERVICE_ROLE_KEY=local-p0-service CRON_SECRET=local-p0-cron npx playwright test -c playwright.financial-p0.config.ts tests/e2e/165-card-payment-provider-cutover.spec.ts --grep 'credential bundle|WebStd NicePay runtime|approval payloads|NetCancelURL|transaction status query|cancel SignData|matching requires'
```

The old read/update mock financial saga assertions were replaced by native tests for the new authority. Existing pricing, policy, manual payout and cron contracts remain. Existing full browser cancellation tests additionally need a local Supabase Auth server; when unavailable, actual cancellation route authorization/state transitions are exercised by this native suite instead of using Production.
