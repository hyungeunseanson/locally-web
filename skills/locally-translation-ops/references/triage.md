# Translation Triage

## First classify the issue

### Queue issue

- Task is still `queued`, `retryable`, `leased`, or `processing`
- Usually means: wait, rerun workflow later, or inspect `not_before`

### Provider issue

- `last_error` mentions Gemini/Grok/API/network/quota/503
- Usually means: retry policy, provider fallback, env var, or temporary demand spike

### Data issue

- Missing source content
- Missing locale content
- Experience was never queued

## Core files

- `docs/experience_translation_queue_usage.md`
- `docs/gemini.md`
- `app/api/cron/experience-translations/route.ts`
- `app/utils/experienceTranslation/providers.ts`
- `app/api/host/experiences/shared.ts`
