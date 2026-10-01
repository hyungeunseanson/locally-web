# Email/password recovery

This change is review-only. Do not merge or deploy during the Home RUM observation window.

Flow: Login → `/auth/forgot-password` → reset email → existing PKCE `/auth/callback` → `/auth/update-password` → current-session sign-out → login with the new password.

- Uses the existing `@supabase/ssr` browser/server clients (anon key, PKCE cookie storage).
- `resetPasswordForEmail` targets the active origin's callback with encoded `next=/auth/update-password&flow=recovery`. No email is in the URL.
- Recovery callback fixes the destination to the update page, skips demographics delivery, strips the code through a redirect, and returns private/no-store and no-referrer headers.
- The update page requires an Auth-server-validated session. Submit rechecks `getUser`; a query parameter or cached browser session cannot grant access.
- Minimum length is the existing signup/Auth minimum (6). Password confirmation must match. Supabase remains authoritative for password rejection.
- Passwords live only in form state and the SDK request, and are cleared after submission. No recovery telemetry or raw provider errors are emitted.
- Success signs out only the current session (`scope: local`) before enabling the login link. Cleanup failure offers cleanup retry without repeating the password write. The installed SDK treats ended sessions (401/403/404) as local cleanup success.
- Auth routes already exclude GA. Locale metadata sync is skipped on recovery pages to avoid unrelated Auth writes.
- PKCE links must open in the browser that requested the email. Expired/reused/missing codes provide a new-email entry.

## Read-only Production configuration audit (2026-10-01)

Management API GET only: email provider enabled, custom SMTP configured, minimum password length 6, additional character restrictions unset, password-update reauthentication disabled. Both confirmation and recovery templates use `ConfirmationURL`. The existing Production callback allowlist includes a callback wildcard suffix and accepts the recovery query. No redirect/template/SMTP change is needed. Signup currently auto-confirms; its existing behavior is unchanged. No real reset email was sent; actual SMTP delivery remains untested.

## Local verification

Use the existing `playwright.contracts.config.ts` with local-only Supabase env (`http://127.0.0.1:54329`, dummy anon/service keys), a Production Next build and `PLAYWRIGHT_SERVER_MODE=start`. The mock server implements recovery, PKCE, user validation/update and local logout. Production-target guards and browser external-network blocking keep these tests local. Do not run user-creating account tests against Production.

Tests: `270-password-reset-self-service`, `183-auth-runtime-contract`, `226-auth-session-regression`; the no-write signup/help subset of `169-account-accessibility-auth-surfaces`. TypeScript, relevant lint, Next/OpenNext builds, Production Wrangler dry-run and Production deploy contracts are required. Dry-run is not deployment.
