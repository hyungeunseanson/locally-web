# Notification Audit Policy

## Primary docs

- `docs/email_notification_policy.md`
- `docs/gemini.md`
- `docs/CHANGELOG.md`

## Current operating rules

- Important status changes can send immediate email.
- Admin alert center reuses `notifications` with `type='admin_alert'`.
- Team chat is not digest-based; no cron dependency.
- Guest-host inquiries stay in `Message Monitoring`, not admin alerts.
- `/api/notifications/email` single-recipient path only allows self notifications or server-verifiable ownership contexts.

## Common mistakes to avoid

- Treating `sendNotification()` as if it were safe for any arbitrary recipient.
- Reintroducing team recipients from `users.role='admin'` instead of `admin_whitelist`.
- Sending both domain-specific email and generic notification email for the same event without checking duplication.
