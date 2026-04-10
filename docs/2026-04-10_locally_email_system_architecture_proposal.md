# Locally 단일 이메일 시스템 설계안

## 문서 성격
- 이번 문서는 대규모 구현 전 단계의 아키텍처 제안서다.
- 목표는 현재의 분산된 이메일 발송 구조를 `React Email` 중심 단일 시스템으로 통합하기 위한 구현 기준을 확정하는 것이다.
- 이번 문서에는 실제 코드 수정이나 마이그레이션 결과는 포함하지 않는다.

## 배경과 결론
- 현재 이메일 시스템은 아래 3개 경로로 분산돼 있다.
  - `React Email` 기반 예약 템플릿: [app/emails/templates/BookingConfirmationEmail.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/emails/templates/BookingConfirmationEmail.tsx), [app/emails/templates/BookingCancellationEmail.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/emails/templates/BookingCancellationEmail.tsx)
  - generic HTML shell: [app/utils/emailNotificationJobs.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/emailNotificationJobs.ts), [app/utils/adminEmailProvider.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/adminEmailProvider.ts)
  - inline HTML 알림: [app/api/notifications/email/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/notifications/email/route.ts), [app/api/inquiries/thread/shared.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts)
- 이 구조는 브랜드 일관성, subject/preheader 관리, CTA 품질, 모바일 대응, dark mode 안정성, 접근성, 유지보수성 모두에서 한계가 명확하다.
- 결론은 부분 개선이 아니라, `React Email + 단일 발송 API + 템플릿 레지스트리` 중심의 **단일 이메일 시스템**으로 재설계하는 것이다.

## 목표
- Locally 웹사이트와 같은 판단 기준을 가진 이메일 경험을 만든다.
- 기준 톤은 `premium / trust / travel utility`다.
- “에어비앤비처럼 보이기”가 아니라 “정보가 명확하고 믿을 수 있는 글로벌 예약/호스팅 플랫폼”으로 재해석한다.
- 구현 목표는 아래 4가지다.
  - 모든 주요 운영 메일이 같은 레이아웃 시스템을 사용한다.
  - 모든 템플릿이 `subject + preheader + html + text`를 함께 가진다.
  - locale, CTA, 상태 variant가 한 시스템 안에서 관리된다.
  - big bang 없이 단계적으로 마이그레이션할 수 있어야 한다.

## 현재 구조 진단

### 현재 발송 경로
| 영역 | 현재 방식 | 핵심 파일 | 문제 |
| --- | --- | --- | --- |
| 예약 확정/취소 일부 | React Email | [app/api/notifications/send-email/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/notifications/send-email/route.ts), [app/utils/bookingTemplateEmailCopy.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/bookingTemplateEmailCopy.ts) | 예약 2종만 별도 품질, 나머지 메일과 시스템 분리 |
| 일반 운영 메일 | generic HTML shell | [app/utils/emailNotificationJobs.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/emailNotificationJobs.ts), [app/utils/emailCopy.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/emailCopy.ts) | 브랜드/레이아웃/프리헤더 부재 |
| 관리자 메일 | admin shell | [app/utils/adminEmailProvider.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/adminEmailProvider.ts) | 별도 shell 중복 유지 |
| 문의/알림 일부 | inline HTML | [app/api/inquiries/thread/shared.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts), [app/api/notifications/email/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/notifications/email/route.ts) | 문단 + 링크 수준, 브랜드 경험 부족 |

### 현재 시스템의 구조적 문제
- 템플릿 방식이 3개라 공통 수정이 어렵다.
- subject는 있으나 preheader가 대부분 없다.
- 예약 메일 2종만 레이아웃이 있고, 나머지는 utility mail 수준이다.
- admin/customer/host 메일이 같은 기준으로 설계되어 있지 않다.
- locale은 부분적으로 공통화돼 있으나 시각 시스템은 공통화되지 않았다.
- text fallback, dark mode 안정성, mobile density, accessibility가 계약으로 관리되지 않는다.

## 브랜드 방향

### 톤앤매너
- 중심 무드는 `차분한 프리미엄 여행 유틸리티`다.
- 과한 축하 연출, 대형 비주얼, 감정 과잉 카피는 지양한다.
- 메일을 여는 순간 “상태가 명확하고, 다음 행동이 분명하며, 믿을 수 있는 플랫폼”처럼 보여야 한다.

### 웹사이트와의 정합성
- 웹의 전역 기준은 [app/globals.css](/Users/hyungeunseanson/Documents/서비스/locally-web/app/globals.css), [app/layout.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/layout.tsx)에 맞춘다.
- 반영 기준:
  - 화이트 기반 surface
  - `slate / charcoal` 계열 본문 타이포
  - 제한적으로만 쓰는 brand pink `#FF385C`
  - 부드러운 radius와 border 중심 구조
- 웹의 local font는 이메일에 직접 쓰지 않는다. 메일 클라이언트 안전성을 우선한다.

## 공통 이메일 구조

### Base Layout
- 모든 템플릿은 동일한 base layout 위에서 렌더한다.
- 기본 구조:
  1. `Preview`
  2. `Outer canvas`
  3. `Container`
  4. `Header`
  5. `Title block`
  6. `Summary / message / status blocks`
  7. `Primary CTA`
  8. `Secondary help`
  9. `Footer / legal`

### Header
- 중앙 정렬 로고를 기본으로 한다.
- 선택적으로 eyebrow 또는 status badge를 둘 수 있다.
- 대형 hero image는 기본 시스템에서 제외한다.

### Title Block
- 구성:
  - optional eyebrow
  - title
  - supporting sentence
  - optional status pill
- 제목은 한 줄에 핵심 상태를 명확히 보여주고, 보조 문장은 “다음 행동”이나 “상태 설명”으로 한정한다.

### Summary / Info Block
- 기본은 `stacked key-value row`다.
- 긴 번역 문자열, 모바일 줄바꿈, Outlook 안정성을 고려해 2열 테이블을 기본형으로 사용하지 않는다.
- 공통 block variant:
  - `SummaryCard`
  - `StatusNoteCard`
  - `MessagePreviewCard`
  - `TimelineHintCard`

### Primary CTA
- 단일 primary CTA만 기본 계약으로 둔다.
- secondary CTA는 버튼이 아니라 본문 링크 형태로만 허용한다.
- CTA 라벨은 구체적 동사형으로 작성한다.
  - `예약 상세 보기`
  - `대화 열기`
  - `신청 내역 확인하기`

### Secondary Help
- 링크가 없으면 숨긴다.
- 링크가 있으면 `Need help` 계열 1줄만 노출한다.
- 기본 링크는 현행 운영 구조를 따라 `/about`를 사용하되, 템플릿 단에서 override 가능하게 설계한다.

### Footer / Legal
- variant는 2종만 둔다.
  - `transactional`: 고객/호스트 대상
  - `opsAdmin`: 운영팀 대상
- `transactional` 기본 포함 요소:
  - support 이메일
  - privacy
  - terms
  - company info
- `opsAdmin`은 더 간결하게 유지하되, 동일한 브랜드 토큰을 쓴다.

### Subject / Preheader 원칙
- 모든 템플릿은 `subject`, `preheader`, `html`, `text`를 함께 렌더한다.
- subject 규칙:
  - `[Locally]` prefix 유지
  - `상태 + 객체` 순서 우선
  - 불필요한 감탄/emoji 제거
- preheader 규칙:
  - 제목 반복 금지
  - 다음 행동 또는 핵심 상태를 1문장으로 요약
  - 제목보다 구체적이어야 함

## 디자인 토큰

### Color
| Token | Value | 용도 |
| --- | --- | --- |
| `bg.canvas` | `#F7F7F7` | 메일 바깥 캔버스 |
| `bg.surface` | `#FFFFFF` | 메인 컨테이너 |
| `bg.subtle` | `#F8FAFC` | summary / note block |
| `text.strong` | `#222222` | 제목, 핵심 값 |
| `text.default` | `#374151` | 본문 |
| `text.muted` | `#6B7280` | 라벨, 보조 안내 |
| `border.default` | `#E5E7EB` | 공통 border |
| `brand.primary` | `#FF385C` | primary CTA, accent |
| `brand.primaryHover` | `#D90B3E` | hover 대응 기준 |
| `status.success.bg` | `#ECFDF5` | 승인/확정 상태 |
| `status.success.text` | `#166534` | 승인/확정 텍스트 |
| `status.warning.bg` | `#FFFBEB` | 보완/주의 상태 |
| `status.warning.text` | `#92400E` | 보완/주의 텍스트 |
| `status.danger.bg` | `#FEF2F2` | 취소/거절 상태 |
| `status.danger.text` | `#991B1B` | 취소/거절 텍스트 |

### Spacing
- outer padding: `40px desktop / 24px mobile`
- content padding: `32px desktop / 20px mobile`
- section gap: `24px desktop / 16px mobile`
- item gap: `12px desktop / 8px mobile`

### Typography
- font stack:
  - `-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif`
- title: `28px desktop / 24px mobile`
- subtitle/body: `15px`
- label: `12px`
- footer/legal: `11px`
- 본문 line-height는 `1.55~1.65` 범위를 유지한다.

### Button
- primary CTA only
- solid fill
- radius `12px`
- min height `48px`
- full-width block
- 텍스트는 `14px / 600`

### Card / Block
- radius `16px`
- border 기반
- 그림자는 선택 요소이며 기본은 미세하거나 없음
- 카드 타입:
  - `SummaryCard`
  - `MessagePreviewCard`
  - `StatusNoteCard`

### 모바일 기준
- max width `600px`
- single-column only
- body side padding `16px`
- footer legal 링크는 줄바꿈 가능한 형태로 둔다.

## 기술 구조

### 통일 기준
- 단일 렌더링 엔진은 `React Email`로 통일한다.
- 기존 아래 함수/경로는 모두 migration 대상로 본다.
  - `renderEmailShell`
  - `renderAdminEmailShell`
  - `buildNotificationEmailHtml`
  - inquiry route 내부 inline HTML

### 제안 디렉터리 구조
```ts
app/emails/
  components/
    EmailBaseLayout.tsx
    EmailHeader.tsx
    EmailTitleBlock.tsx
    EmailSummaryCard.tsx
    EmailKVRow.tsx
    EmailMessagePreviewCard.tsx
    EmailPrimaryCTA.tsx
    EmailFooter.tsx
  theme/
    tokens.ts
    variants.ts
  templates/
    booking/
      BookingConfirmedEmail.tsx
      BookingCancelledEmail.tsx
    inquiry/
      InquiryNewMessageEmail.tsx
    host/
      HostApplicationStatusEmail.tsx
    service/
      ServicePaymentConfirmedEmail.tsx
  registry/
    emailTemplates.ts
    emailContentBuilders.ts
    emailTypes.ts
  render/
    renderEmailTemplate.ts
    renderEmailText.ts
```

### 제안 인터페이스
```ts
type EmailTemplateId =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'inquiry.new_message'
  | 'host_application.status'
  | 'service.payment_confirmed';

type EmailAudience = 'guest' | 'host' | 'admin';
type EmailLocale = 'ko' | 'en' | 'ja' | 'zh';

type EmailRenderResult = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

type EmailRecipient = {
  userId?: string;
  email?: string;
};

type EmailPayloadMap = {
  'booking.confirmed': {
    experienceTitle: string;
    bookingDate: string;
    bookingTime?: string;
    partySize: number;
    amount: number;
    ctaUrl: string;
    recipientName?: string;
  };
  'booking.cancelled': {
    experienceTitle: string;
    reason?: string;
    refundAmount?: number;
    ctaUrl: string;
    recipientName?: string;
    variant: 'standard' | 'admin_force' | 'host_fault';
  };
  'inquiry.new_message': {
    actorName: string;
    threadTitle?: string;
    messagePreview: string;
    ctaUrl: string;
  };
  'host_application.status': {
    status: 'approved' | 'revision' | 'rejected';
    note?: string;
    ctaUrl: string;
  };
  'service.payment_confirmed': {
    requestTitle: string;
    amount?: number;
    ctaUrl: string;
    recipientName?: string;
  };
};

type EmailSendRequest<T extends EmailTemplateId> = {
  templateId: T;
  audience: EmailAudience;
  locale: EmailLocale;
  recipient: EmailRecipient;
  payload: EmailPayloadMap[T];
};
```

### 발송 API
- 신규 발송 경로는 `sendTemplatedEmail(request)` 하나로 통일한다.
- 내부 책임:
  - locale resolve
  - subject/preheader/content build
  - React Email render
  - text fallback render
  - transport 선택
- 기존 호출부는 phase별로 adapter를 거쳐 신규 API를 호출하게 만든다.

### Delivery Gateway
- 발송 provider 분기는 gateway 내부에만 남긴다.
- 현재 provider 정책은 당장 유지한다.
  - admin/provider 경로의 `Resend / Gmail / mock`
  - generic Gmail 전송
- 목표는 “provider를 바꾸는 것”이 아니라 “호출부가 provider를 몰라도 되는 구조”다.

### 로케일 유지 전략
- [app/utils/emailCopy.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/emailCopy.ts), [app/utils/bookingTemplateEmailCopy.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/bookingTemplateEmailCopy.ts)의 locale 분기는 phase 1에서 보존한다.
- 다만 로직은 `template content builder`로 옮길 준비를 한다.
- 기존 `EmailCopyKey` 체계는 migration bridge로만 유지하고, 신규 템플릿은 템플릿 단위 subject/preheader/body를 직접 소유한다.

## 우선 개편 대상 5개

### 1. `booking.confirmed`
- audience: `host`, `guest`
- summary fields:
  - 체험명
  - 일정
  - 인원
  - 결제 금액
- CTA: `예약 상세 보기`
- 현재 source:
  - host 예약 확정 템플릿: [app/api/notifications/send-email/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/notifications/send-email/route.ts)
  - guest 결제 완료 generic 메일: [app/utils/experienceNotificationFlows.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/experienceNotificationFlows.ts)

### 2. `booking.cancelled`
- audience: `host`, `guest`
- variant:
  - `standard`
  - `admin_force`
  - `host_fault`
- summary fields:
  - 체험명
  - 취소 사유
  - 환불 금액
  - 다음 단계
- CTA: `예약 보기` 또는 `여행 확인하기`
- 현재 source:
  - 예약 취소 route/generic 메일: [app/api/payment/cancel/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/cancel/route.ts), [app/api/admin/bookings/force-cancel/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/bookings/force-cancel/route.ts)

### 3. `inquiry.new_message`
- audience: `host`, `guest`
- block:
  - actor 이름
  - thread 문맥
  - 2줄 미리보기
- CTA: `대화 열기`
- 현재 source:
  - [app/api/inquiries/thread/shared.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts)
- 우선 제거 대상:
  - inline paragraph + link HTML

### 4. `host_application.status`
- audience: `host`
- status:
  - `approved`
  - `revision`
  - `rejected`
- CTA:
  - approved: `신청 내역 확인하기`
  - revision: `수정하러 가기`
  - rejected: `신청 결과 확인하기`
- 현재 source:
  - [app/actions/admin.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/actions/admin.ts)

### 5. `service.payment_confirmed`
- audience: `guest`
- summary fields:
  - 요청 제목
  - 결제 상태
  - 다음 단계
- CTA: `서비스 요청 보기`
- 현재 source:
  - [app/utils/serviceNotificationFlows.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/serviceNotificationFlows.ts)

## 현재 경로에서 신규 시스템으로의 매핑
| 현재 경로 | 신규 방식 | 처리 원칙 |
| --- | --- | --- |
| `sendImmediateGenericEmail()` | `sendTemplatedEmail()` adapter | phase 2 이후 템플릿별로 직접 전환 |
| `sendImmediateAdminEmail()` | `sendTemplatedEmail()` + `opsAdmin` footer variant | provider는 유지, 렌더만 통일 |
| `buildNotificationEmailHtml()` | 신규 notification template | route 내부 string HTML 제거 |
| inquiry `notifyRecipient()` inline HTML | `inquiry.new_message` template | 가장 먼저 제거할 inline 경로 |
| `send-email/route.ts` booking 템플릿 | 신규 registry 기반 template render | 현재 React Email 2종 재설계 후 흡수 |

## 구현 단계

### Phase 1. 시스템 기반
- 공통 token, layout, footer variant, CTA, summary block, message preview block을 만든다.
- `renderEmailTemplate()`와 `sendTemplatedEmail()`를 도입한다.
- 템플릿 registry와 typed payload map을 만든다.
- legacy shell은 유지하되, 신규 시스템을 호출할 adapter 진입점을 마련한다.

### Phase 2. 핵심 5개 전환
- `booking.confirmed`
- `booking.cancelled`
- `inquiry.new_message`
- `host_application.status`
- `service.payment_confirmed`
- 위 5개를 신규 시스템으로 먼저 옮기고, 발송 지점을 연결한다.

### Phase 3. 운영 메일 확장
- review, membership, proxy, service request/application/cancel 등 나머지 메일을 registry로 이관한다.
- 이 시점부터 `emailCopy.ts`는 legacy bridge 성격으로 축소한다.

### Phase 4. 정리
- `renderEmailShell`
- `renderAdminEmailShell`
- route 내부 inline HTML
- 위 3개 축을 최종 제거한다.

## 테스트 및 수용 기준

### 공통 계약 테스트
- 모든 신규 템플릿은 아래를 만족해야 한다.
  - subject 존재
  - preheader 존재
  - html 렌더 성공
  - text fallback 렌더 성공
  - logo/header 존재
  - title block 존재
  - 단일 primary CTA 존재
  - footer variant 존재

### 로케일 테스트
- `ko / en / ja / zh`에 대해 subject, preheader, CTA, summary label이 렌더돼야 한다.
- locale별 긴 문장에서도 layout이 깨지지 않아야 한다.

### 렌더 테스트
- representative 5개 템플릿은 desktop/mobile snapshot을 유지한다.
- CTA 폭, 요약 블록 줄바꿈, footer link wrapping을 주요 기준으로 본다.

### 회귀 테스트
- 기존 링크가 바뀌지 않아야 한다.
- recipient locale 적용이 유지되어야 한다.
- 취소/승인 상태 variant가 잘못 섞이지 않아야 한다.
- 기존 provider routing은 유지되어야 한다.

### 호환성 기준
- dark theme를 별도 제작하지는 않지만, auto-dark 환경에서도 읽을 수 있게 명시적 background/text 대비를 유지한다.
- Gmail web/mobile, Apple Mail, Outlook web/desktop 기준으로 깨지지 않는 단일 컬럼 구조를 유지한다.
- semantic heading, alt, 구체적 CTA 라벨, 충분한 line-height를 기본 계약으로 둔다.

## 리스크와 대응
- 리스크: generic shell과 inline HTML가 많아 발송 경로가 분산되어 있다.
  - 대응: big bang 금지, adapter-first migration
- 리스크: locale copy가 여러 파일에 흩어져 있다.
  - 대응: phase 1에서는 copy 로직 보존, render 구조만 통합
- 리스크: admin 메일과 customer 메일의 footer 요구가 다르다.
  - 대응: 다른 시스템이 아니라 footer variant만 분리
- 리스크: 예약/취소 메일은 이미 React Email이므로 부분적 중복 기간이 생긴다.
  - 대응: registry 기반 새 템플릿이 안정화되면 기존 템플릿 교체 후 제거

## 구현 시 기본 결정 사항
- `React Email` 중심 통일은 재논의하지 않는다.
- `subject + preheader + html + text`는 모든 신규 템플릿의 필수 계약이다.
- CTA는 단일 primary 버튼만 기본으로 허용한다.
- summary block은 stacked key-value rows를 기본형으로 사용한다.
- locale fallback 우선순위는 `요청값 > recipient preferred_locale > ko`로 고정한다.
- 새 템플릿 추가 ownership은 `emailTypes.ts`가 계약, `emailContentBuilders.ts`가 locale별 subject/preheader/body, `emailTemplates.ts`가 컴포넌트 등록을 각각 책임진다.
- help link 기본값은 `/about`를 사용한다.
- 회원가입/인증 메일은 이번 구현 범위에서 제외하되, 시스템 안정화 후 같은 엔진으로 이관 가능한 구조를 유지한다.

## 바로 다음 작업
1. `app/emails` 아래 공통 token, layout, shared block 컴포넌트 설계
2. `sendTemplatedEmail()`와 registry/types 골격 추가
3. 우선 5개 템플릿 중 `booking.confirmed`, `booking.cancelled`, `inquiry.new_message`부터 구현
4. 기존 route/copy 경로를 adapter로 연결
