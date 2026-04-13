# 이메일·알림 발송 체계 E2E 감사

## Summary
- 감사 범위: `templated email delivery`, `/api/notifications/email`, localized notification/email copy, `opsAdmin` sender split
- 현재 기준 결론:
  - `sendTemplatedEmail()` 중심의 템플릿 발송 파이프라인, `transactional / opsAdmin` transport 분기, shared template render/mobile contract는 `정상`
  - `/api/notifications/email`의 인증, mass-send guard, single-recipient allowlist ownership, sanitize/fail-safe mail dispatch는 `정상`
  - `review_reply`는 서버 helper 단일 owner로 정리돼 `정상`
  - `inquiry.new_message`는 인앱 + localized email이 동작하지만, helper 앞단에 `GMAIL_*` hard gate가 남아 있어 `부분 보장`
- 최신 재검증 결과:
  - `77-notification-email-policy`
  - `123-cancellation-approved-notification-localization`
  - `124-inquiry-email-localization`
  - `125-shared-notification-email-cta`
  - `162-email-template-render-contract`
  - `163-email-template-mobile-design`
  - `168-admin-email-sender-contract`
  - 결과: `25 passed (22.5s)`

## Result Snapshot
| Chain | Source of truth | Current tests | Result | Notes |
| --- | --- | --- | --- | --- |
| Template delivery core | `app/emails/delivery/sendTemplatedEmail.ts`, `app/emails/render/*`, `app/emails/registry/*` | `162`, `163` | 정상 | template registry, locale fallback, render/mobile contract, recipient-missing skip가 안정적이다 |
| Generic/admin adapters | `app/utils/emailNotificationJobs.ts`, `app/utils/adminEmailProvider.ts` | `162`, `168` | 정상 | 두 adapter 모두 `sendTemplatedEmail()` 얇은 wrapper로 유지되고 opsAdmin sender split이 명확하다 |
| Shared notification route | `app/api/notifications/email/route.ts`, `app/utils/notification.ts` | `77`, `123`, `125` | 정상 | auth guard, admin-only mass send, single-recipient allowlist, localized typed CTA가 현재 계약과 맞다 |
| Review reply delivery | `app/utils/reviews/reviewReplyNotification.ts` | `122`, `125` reference | 정상 | DB notification + localized email을 서버 helper가 단일 owner로 처리한다 |
| Inquiry new message delivery | `app/api/inquiries/thread/shared.ts`, `app/emails/templates/inquiry/InquiryNewMessageEmail.tsx` | `124`, `162` | 부분 보장 | localized inquiry email은 green이지만 helper 앞단에 `GMAIL_*` hard gate가 남아 Resend-only transactional config를 막는다 |

## Detailed Findings

### 1. `sendTemplatedEmail()`가 현재 메일 발송 owner다
- source of truth
  - `app/emails/delivery/sendTemplatedEmail.ts`
  - `app/emails/registry/emailTypes.ts`
  - `app/emails/render/renderEmailTemplate.ts`
- 현재 동작
  - 발송 정책은 `transactional | opsAdmin` 두 축으로만 나뉜다
  - recipient email이 없으면 `recipient_missing`으로 fail-safe skip한다
  - `opsAdmin`은 non-production에서 mock file capture를 우선 사용한다
  - dedicated admin Gmail이 있으면 `opsAdmin`은 그 sender를 우선 사용하고, 없으면 shared Gmail로 fallback한다
  - `opsAdmin`은 Gmail이 없을 때만 Resend fallback을 탄다
- 테스트 보장
  - `162-email-template-render-contract`
  - `163-email-template-mobile-design`
  - `168-admin-email-sender-contract`
- 판정
  - `정상`

### 2. `sendImmediateGenericEmail()` / `sendImmediateAdminEmail()`는 얇은 adapter로 유지된다
- source of truth
  - `app/utils/emailNotificationJobs.ts`
  - `app/utils/adminEmailProvider.ts`
- 현재 동작
  - generic 경로는 recipient `userId/email`를 `sendTemplatedEmail()`에 그대로 넘긴다
  - admin 경로는 기본 transport를 `opsAdmin`으로 강제한다
  - legacy subject/title/message 인자는 더 이상 shell owner가 아니고 adapter 바깥 호환용 파라미터다
- 테스트 보장
  - `162-email-template-render-contract`
  - `168-admin-email-sender-contract`
- 판정
  - `정상`

### 3. `/api/notifications/email`는 인앱 저장 + allowlisted 단건 메일 fan-out owner다
- source of truth
  - `app/api/notifications/email/route.ts`
  - `app/utils/notification.ts`
- 현재 동작
  - 호출은 로그인 사용자만 가능하다
  - `recipient_ids` mass send는 관리자만 가능하다
  - single-recipient는 `new_booking`, `booking_cancel_request`, `review_reply`, `cancellation_approved` ownership 검증을 통과한 경우만 허용된다
  - title/message/link sanitize 이후 DB insert를 먼저 하고, 메일 실패는 경고 로그만 남기고 성공 응답을 유지한다
  - `review_reply`, `cancellation_approved`는 typed localized CTA/template payload를 허용한다
- 테스트 보장
  - `77-notification-email-policy`
  - `123-cancellation-approved-notification-localization`
  - `125-shared-notification-email-cta`
- 판정
  - `정상`

### 4. `review_reply`는 서버 helper 단일 owner로 닫혀 있다
- source of truth
  - `app/utils/reviews/reviewReplyNotification.ts`
- 현재 동작
  - host ownership 검증 후 guest notification row를 저장한다
  - 같은 helper 안에서 localized `notice.copy` email까지 best-effort로 발송한다
  - 이메일 실패가 notification truth를 뒤집지 않는다
- 테스트 보장
  - `122-review-reply-notification-localization`
  - `125-shared-notification-email-cta`
- 판정
  - `정상`

### 5. `inquiry.new_message`는 기능은 green이지만 provider gate가 아직 섞여 있다
- source of truth
  - `app/api/inquiries/thread/shared.ts`
  - `app/emails/templates/inquiry/InquiryNewMessageEmail.tsx`
- 현재 동작
  - inquiry message helper는 localized in-app notification을 저장한다
  - recipient email을 찾은 뒤 `sendTemplatedEmail()`로 inquiry template 메일을 best-effort 발송한다
  - 하지만 그 전에 `if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;`로 조기 종료한다
- 테스트 보장
  - `124-inquiry-email-localization`
  - `162-email-template-render-contract`
- 판정
  - `부분 보장`
- 운영 리스크
  - 전체 메일 파이프라인은 Resend/Gmail 추상화가 있는데, inquiry path만 Gmail env 선행 존재를 요구한다
  - 즉, Resend-only transactional 구성을 의도할 경우 inquiry 메일만 조용히 빠질 수 있다

## Coverage Gap
- inquiry message path의 `GMAIL_*` 선행 gate와 `sendTemplatedEmail()` provider fallback 의미를 함께 잠그는 스펙은 아직 없다
- admin/team mail 전 도메인의 실제 recipient whitelist 운영 증거는 이번 감사 범위 밖이다

## Final Verdict
- 템플릿 렌더, sender split, notification route 보안/소유권, localized CTA까지 현재 메일·알림 체인의 대부분은 `정상`
- 남은 핵심 active gap은 `inquiry.new_message` helper의 Gmail hard gate 1건이다
- 다음 핀셋 수정 1순위는 `app/api/inquiries/thread/shared.ts`가 `GMAIL_*` 직접 검사 대신 `sendTemplatedEmail()` provider 추상화에 그대로 위임하도록 정리하는 작업이다
