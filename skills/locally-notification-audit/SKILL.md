---
name: locally-notification-audit
description: Use when auditing or changing Locally notification behavior, including email, in-app notifications, admin alerts, inquiry notifications, team notifications, and `/api/notifications/email` security boundaries.
---

# Locally Notification Audit

Use this skill for requests like:
- "이 이벤트가 이메일 가는지 확인해줘"
- "관리자 ALERTS에는 뭐가 쌓이지?"
- "중복 메일 나는 것 같은데 점검해줘"
- "이 알림은 인앱만 가게 바꿔줘"

## Start Here

1. Read [references/policy.md](references/policy.md).
2. Read `docs/email_notification_policy.md`.
3. Re-check `docs/gemini.md` sections for admin alerts, notify-team, and notification API security.
4. Identify the exact event before editing code. Do not patch the generic notification path first.

## Guardrails

- Keep `/api/notifications/email` single-recipient path restricted. It is not a generic send API.
- Keep team recipient resolution on `admin_whitelist` only.
- Keep guest-host inquiry monitoring in `Message Monitoring`; do not re-add it to admin alerts unless explicitly requested.
- Prefer changing the domain route that owns the event rather than widening a shared helper.
- If a change affects policy, update `docs/email_notification_policy.md`.

## Default Workflow

1. Find the event owner route/component from [references/event-map.md](references/event-map.md).
2. Verify who should receive:
   - email
   - normal in-app notification
   - admin alert center
3. Check for duplicate paths:
   - direct DB insert to `notifications`
   - `sendNotification()`
   - `sendImmediateGenericEmail()`
   - `/api/notifications/send-email`
4. Make the smallest possible change.
5. Verify with targeted lint/typecheck and, if needed, one live smoke flow.

## Verification

- `npx eslint <touched files>`
- `npx tsc --noEmit` if shared types or server routes changed
- `git diff --check`
- If user asks for runtime proof, use the closest existing Playwright/live flow rather than inventing a brand-new wide test.
