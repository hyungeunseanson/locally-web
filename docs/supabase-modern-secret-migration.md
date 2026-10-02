# Supabase modern secret compatibility — Phase 1

This phase changes code and fixture tests only. Production credentials remain
unchanged; legacy service-role and anon keys must remain active until every
caller has migrated. The preceding preflight observed legacy anon callers even
though the currently served public bundle uses a modern publishable key.

## Credential contracts

- `SUPABASE_SERVICE_ROLE_KEY` remains a server-only compatibility alias. Its
  future value will be a named modern secret API key. No env rename is required.
- SDK consumers keep `createClient(url, key)`; the SDK supports both legacy
  service-role JWTs and modern secret API keys.
- Custom JavaScript HTTP consumers use `createSupabaseApiKeyHeaders`. Modern
  secret/publishable keys use `apikey` only. Legacy keys retain the existing
  Bearer fallback. A separately supplied user session JWT is preserved.
- Python Storage backup uses the equivalent `supabase_api_key_headers`
  transport contract, tested without provider access.
- A supplied Production build/deploy privileged credential must be either a
  modern secret or a legacy HS256 JWT with the service-role claim. Public/anon,
  user-session, empty and malformed values fail with a value-free diagnostic.
  This is offline configuration validation, not signature verification or user
  authorization. Supabase and existing application guards remain authoritative.
- Builds may omit the runtime-only binding. Remote semantic preflight verifies
  secret-binding metadata; it does not inspect encrypted credential values.
  When a privileged key is supplied to a build, the resulting client assets are
  checked for accidental inclusion of that value with value-free diagnostics.

## Consumer map

| Kind | Consumers | Phase 1 treatment |
| --- | --- | --- |
| SDK | Shared admin client and its admin, payment, booking/service, email/notification and server Storage callers | Keep SDK and permission guards |
| SDK | Translation Queue; admin-support, cancel-pending, experience-completion, service-completion and Ops scheduled adapters | Keep SDK; regression contracts |
| SDK | Community bot routes; diagnostics; review-email backfill; Codex runtime-data cleanup | Keep SDK; no credential-format authorization |
| DIRECT_HTTP | Home popularity snapshot; notification retention cleanup | Shared API-key header helper |
| DIRECT_HTTP | Storage byte-backup | Equivalent Python header helper |
| DIRECT_HTTP / SDK | Media source-delete plan/apply; locator-plan apply | Shared helper; SDK deletion path unchanged |
| DIRECT_HTTP | Notification retention preflight | Shared helper and sanitized transport errors |
| DIRECT_HTTP | Media audit/listing, reconciliation, repair, recovery and media Queue latest-row loader | Same helper supports public keys and privileged reuse |
| OTHER | GitHub Cron dispatch | CRON_SECRET authenticates the request; backend key stays in Worker |
| OTHER | DB/R2 backup | DB connection and R2 credentials are independent of Supabase API keys |
| OTHER | Production build/deploy preflight | Offline privileged-credential validation, no remote secret read |

## Subsequent controlled cutover

1. Prepare a named modern secret while legacy keys still work.
2. Replace operator credentials individually and the shared Worker binding as a
   coordinated change; verify every affected consumer.
3. Identify/migrate remaining legacy anon callers separately. The existing
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` name can hold a modern publishable key.
4. Confirm zero legacy dependencies, including infrequent/manual tools, before
   disabling legacy anon/service-role keys.
5. Verify natural jobs, application contracts and old-key rejection.

Public publishable migration and backend secret migration are separate work.
JWT signing-key rotation, history rewrite, Production deploy and provider/data
mutations are outside Phase 1. Do not log credentials or commit env files.

References: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys),
[authorization headers](https://supabase.com/docs/guides/functions/auth-headers).
