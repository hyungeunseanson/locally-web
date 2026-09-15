# Experience translation Queue operations

## Ownership and truth

PostgreSQL remains the sole business authority for `experience_translation_jobs`, `experience_translation_tasks`, `translation_provider_state`, leases, `not_before`, attempt counts, translation versions, and final task/job state. Cloudflare Queue messages are bounded wake signals only; they never contain a task ID, source text, translation, user identifier, or provider credential.

The shared processor is used by both the Cloudflare Queue consumer and `GET /api/cron/experience-translations`. It preserves the database lease RPC, provider order (Gemini then configured Grok fallback), manual-locale protection, stale-version cancellation, provider cooldown accounting, and task/job status transitions.

## Transport contract

The version-1 message contains only `schema`, `version`, opaque `eventId`, bounded `reason`, and bounded `hop`. A normal wake drains at most `TRANSLATION_WORKER_BATCH_SIZE`; `manual-canary` drains at most one task. A saturated drain may create a continuation wake up to hop 4. Provider retry remains represented by PostgreSQL `retryable` plus `not_before`; no guessed Queue delay is scheduled. The daily recovery Cron creates one wake at `17 19 * * *` UTC.

Database infrastructure failures retry the Queue delivery. A provider result that has been safely recorded as completed, failed, cancelled, or retryable acknowledges the wake. Duplicate wakes are safe because `lease_experience_translation_task` uses the database lease/row-lock contract.

## Deployment profiles

Raw `wrangler.jsonc` values are fail-closed (`false`). The repository-owned Production wrapper independently resolves the public-media and translation profiles:

```sh
# Normal Production release after rollout: media approved cohort + translation ON
npm run cloudflare:deploy:production

# Translation emergency stop without disabling public media
npm run cloudflare:deploy:production -- --translation-profile=off

# Preflight only
npm run cloudflare:deploy:production -- --translation-profile=off --dry-run
```

The OFF profile stops new application and scheduled wakes. It does not cancel messages already accepted by Queue, alter PostgreSQL tasks, purge a Queue, or remove its consumer.

## Recovery and observability

The Cloudflare Cron is the primary missed-enqueue recovery. GitHub `workflow_dispatch` and the authorized HTTP route remain the manual emergency fallback. Logs are limited to event ID, reason, hop, attempt, bounded outcome/diagnostic codes, task counts, and provider-call counts; translation text and raw provider errors are prohibited.

Until Production activation succeeds, the legacy GitHub automatic schedule remains enabled. After activation and a successful Queue canary, remove only the `schedule` trigger while retaining `workflow_dispatch`.
