---
name: locally-translation-ops
description: Use when investigating Locally experience translation failures, queue state, retryable vs failed tasks, Gemini or Grok fallback behavior, cron/manual reruns, and safe requeue operations.
---

# Locally Translation Ops

Use this skill for requests like:
- "번역 왜 안 됐는지 봐줘"
- "retryable 인지 failed 인지 판단해줘"
- "queue 다시 올려야 하나?"
- "GitHub workflow로 다시 돌려도 되는지 봐줘"

## Start Here

1. Read [references/triage.md](references/triage.md).
2. Read `docs/experience_translation_queue_usage.md`.
3. Re-check `docs/gemini.md` translation section before proposing code changes.
4. Separate:
   - queue/ops problem
   - provider problem
   - data/content problem

## Guardrails

- Do not change DB schema or translation worker flow unless the user explicitly asks.
- Preserve `failed` vs `retryable` semantics.
- Requeue only the targeted tasks; avoid broad updates unless the user asks for bulk backfill.
- Keep `Flash -> Flash-Lite -> retryable/Grok` policy aligned with `docs/gemini.md`.

## Default Workflow

1. Check backlog count and task statuses using [references/sql.md](references/sql.md).
2. Inspect `last_error` before suggesting any retry.
3. If the task is `queued` or `retryable`, do not requeue manually.
4. If the task is `failed`, explain why and only then provide requeue SQL.
5. If code is involved, inspect:
   - `app/api/cron/experience-translations/route.ts`
   - `app/utils/experienceTranslation/providers.ts`
   - `app/api/host/experiences/shared.ts`

## Verification

- Use the GitHub workflow or cron endpoint already documented; do not invent a new runner.
- Verify with:
  - `npx tsc --noEmit`
  - `git diff --check`
- If runtime proof is needed, capture:
  - processed/completed/failed/retried counts
  - updated task statuses in Supabase
