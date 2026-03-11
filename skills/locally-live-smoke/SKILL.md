---
name: locally-live-smoke
description: Use when running or updating Locally live Playwright smoke tests against production-like flows such as guest signup, booking, inquiry messaging, host actions, and admin checks.
---

# Locally Live Smoke

Use this skill for requests like:
- "Playwright로 확인해줘"
- "실서비스에서 이 흐름 눌러봐"
- "이건 제품 버그인지 테스트 셀렉터 문제인지 봐줘"

## Start Here

1. Read [references/scope.md](references/scope.md).
2. Pick the closest existing test first. Do not create a new broad scenario if one already exists.
3. Prefer live smoke over local mock tests only when the user explicitly wants runtime proof.

## Guardrails

- Treat live tests as production-touching. Use the smallest scenario that proves the point.
- Reuse the existing live test assets and unique account generation patterns.
- If a test fails at step 1, determine whether it is selector drift or product regression before touching app code.
- Clean Playwright artifacts before committing. Only commit intentional test file changes.

## Default Workflow

1. Find the closest existing spec from [references/tests.md](references/tests.md).
2. Run only that spec.
3. If it fails:
   - read `error-context.md`
   - compare with current component structure
   - patch the test selector first if the UI changed but behavior is still correct
4. Re-run the same spec.
5. Report exactly:
   - command used
   - pass/fail
   - where it failed
   - whether the issue was test drift or product regression

## Verification

- `npx playwright test <target spec> --project=chromium`
- `git diff --check`
- `git status --short` should be clean except for intentional test edits
