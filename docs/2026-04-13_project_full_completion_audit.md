# [프로젝트 한 줄 설명]
이 프로젝트는 `게스트 체험 탐색·예약·결제`, `호스트 운영`, `어드민 운영`, `서비스 의뢰`, `전화예약(proxy)`, `메시징`, `리뷰`, `로컬리 콘텐츠 발행`까지 한 저장소 안에 들어 있는 대형 Next.js 플랫폼이며, 핵심 비즈니스 흐름과 repo 안 정적 품질 gate는 이미 강하게 닫혀 있고, 지금 남은 핵심은 `settlement 운영 루틴 고정`과 `외부 콘솔 parity 증빙`입니다.

## [전체 구조 요약]
### 프로젝트 구조
- `app/`: 제품 코드의 중심입니다. App Router 기반 페이지, API route, 공용 context/hooks/utils, 이메일 템플릿이 모두 여기에 있습니다.
- `tests/e2e/`: Playwright E2E와 계약 테스트입니다. 총 180개 항목이 있고, 실제 실행 단위는 176개 수준으로 운용되는 흔적이 보입니다.
- `docs/`: 2026년 4월 기준 도메인별 최신 감사 문서와 운영 runbook이 많이 쌓여 있습니다.
- `public/`: 정적 이미지, 회사/콘텐츠 자산, 로고, 공개 asset입니다.
- `scripts/`: live smoke, diagnostics, cleanup, domain parity 같은 운영 스크립트입니다.
- 루트 SQL 파일들: Supabase 테이블/인덱스/RPC/운영 보강 migration 역할입니다.

### 폴더별 역할
- `app/api`: 총 123개 route owner입니다. 인증, 예약, 결제, 리뷰, 메시징, admin, host, services, proxy, community, analytics, cron이 모두 여기 있습니다.
- `app/context`: `AuthContext`, `NotificationContext`, `LanguageContext`, `ViewModeContext` 같은 전역 상태 owner입니다.
- `app/hooks`: `useChat`, `useWishlist` 등 실제 제품 행동의 client orchestration입니다.
- `app/utils`: DB helper, settlement sync, admin payout, SEO, analytics, payments, security guard, notification/email copy가 모여 있습니다.
- `app/emails`: React Email 템플릿, registry, delivery owner가 있습니다.
- `app/admin`, `app/host`, `app/guest`, `app/community`, `app/services`, `app/proxy-bookings`: 도메인별 사용자 surface입니다.

### 핵심 흐름
- 게스트는 `/` → `/search` → `/experiences/[id]` → `/experiences/[id]/payment` → `/guest/trips`로 이어집니다.
- 호스트는 `/become-a-host` → `/host/register` → `/host/dashboard` → 체험 작성/운영/수익으로 이어집니다.
- 어드민은 `/admin/dashboard`에서 approvals, users, chats, ledger, sales, analytics까지 대부분 운영합니다.
- 메시징은 `inquiries` / `inquiry_messages`를 공통 truth로 두고 guest/host/admin이 같은 스레드를 읽습니다.
- 콘텐츠는 `COMMUNITY_OPEN=false` 상태에서 사실상 `locally_content` 발행면으로 운영됩니다.

### 전수조사 방식
- 전체 폴더/라우트/API 인벤토리 확인
- 핵심 owner 파일 직접 확인
- 기존 최신 감사 문서와 현재 코드 drift 대조
- 실제 검증:
  - `npm run build`: 통과
  - `npm run lint`: 통과
  - `npm run lint -- --quiet`: 통과
  - `npx tsc --noEmit`: 통과
  - close-out regression: `16 specs / 29 tests passed`
  - settlement regression rerun: `7 specs / 18 tests passed`

## [현재 완성도 판단]
- UI 완성도: `89%`
- 기능 완성도: `81%`
- 백엔드 완성도: `85%`
- 운영/배포 준비도: `70%`
- 종합 완성도: `82%`

## [이번 배치 운영 원칙]
- 이번 release close-out에서는 `새 리팩터`보다 `운영 리스크 축소`를 우선합니다.
- `/host/dashboard` 구조 분리와 같은 대형 refactor는 `release 이후 hardening`으로 미룹니다.
- 현재 green인 host/admin/settlement 회귀 baseline은 가능한 한 그대로 유지합니다.
- release 전 허용하는 변경은 기본적으로 `문서`, `운영 절차`, `안내 copy` 수준으로 제한합니다.

### 계산 근거
- UI 완성도
  - 49개 `page.tsx`, 25개 `layout.tsx`가 대부분 실제 화면으로 연결되어 있습니다.
  - 게스트/호스트/어드민 주요 surface는 모두 존재합니다.
  - `company/news`, `company/careers`, `company/investors`, `site-map`은 이제 preview/read-only 의미로 안전하게 고정됐지만, 실제 external article / hiring / IR asset launch는 아직 아닙니다.
- 기능 완성도
  - 기존 최신 감사 문서 기준 `게스트 프리북킹`, `예약·결제`, `리뷰`, `계정/인증`, `메시징`, `호스트`, `어드민 탭`, `proxy`, `서비스`, `로컬리 콘텐츠 SEO`, `메일/알림`, `public analytics`는 대체로 `정상`입니다.
  - 남은 실질 리스크는 `settlement sync 운영 의존성`, `외부 콘솔 parity`, `legacy compatibility`, `의도된 self-service 미지원 영역` 쪽입니다.
- 백엔드 완성도
  - 123개 API route, Supabase admin/server/browser client 분리, cron guard, public write guard, localized notification/email builder까지 실제로 연결돼 있습니다.
  - 다만 legacy fallback과 compatibility route가 적지 않고, 일부 schema-missing fallback이 남아 있어 완전한 정리 상태는 아닙니다.
- 운영/배포 준비도
  - `eslint`, `eslint --quiet`, `tsc --noEmit`, `next build`가 모두 현재 기준으로 통과합니다.
  - `next.config.ts`의 `ignoreBuildErrors` 우회는 제거된 상태이며, `siteUrl`도 production에서 legacy alias fallback 없이 env guard로 고정돼 있습니다.
  - 남은 운영 리스크는 `settlement sync day-of 운영 의존성`과 `외부 OAuth/PG console parity 미증빙`입니다.

## [잘 되어 있는 부분]
- 핵심 사용자 흐름이 실제로 연결돼 있습니다.
  - 근거: `app/experiences/[id]/ExperienceClient.tsx`, `app/experiences/[id]/payment/page.tsx`, `app/api/bookings/route.ts`
- 인증/권한/상태 owner가 비교적 분명합니다.
  - 근거: `app/context/AuthContext.tsx`, `app/utils/adminAccess.ts`
- 메시징은 guest/host/admin 공통 owner가 있습니다.
  - 근거: `app/hooks/useChat.ts`, `app/api/inquiries/thread/route.ts`, `app/api/inquiries/message/route.ts`
- 리뷰 체인은 공개/호스트/게스트/어드민까지 실제로 닫혀 있습니다.
  - 근거: `app/api/reviews/route.ts`, `app/api/host/reviews/reply/route.ts`, `app/utils/reviews/reviewAggregates.ts`
- 로컬리 콘텐츠는 단순 커뮤니티가 아니라 SEO 랜딩면으로 정리돼 있습니다.
  - 근거: `app/community/page.tsx`, `app/community/[id]/page.tsx`, `app/sitemap.ts`, `app/robots.ts`
- 이메일/알림 시스템이 단순 mock가 아니라 실제 transport 분기까지 구현돼 있습니다.
  - 근거: `app/emails/delivery/sendTemplatedEmail.ts`, `app/api/notifications/email/route.ts`
- 어드민 대시보드는 “화면만 있는” 수준이 아니라 실제 운영 surface입니다.
  - 근거: `app/admin/dashboard/page.tsx`, `app/admin/dashboard/components/*`, `app/api/admin/*`

## [preview/read-only 또는 legacy로 남은 부분]
- `/company/news`
  - 외부 기사 링크 없이 `Archive preview`로 고정돼 있고, 공식 업데이트 CTA는 `/company/notices`로 유도됩니다.
  - 근거: `app/company/news/page.tsx`
- `/company/careers`
  - planned role 안내형이며 실제 apply link는 열려 있지 않습니다.
  - 근거: `app/company/careers/page.tsx`
- `/company/investors`
  - metrics/report row는 `preview only / publication pending` 의미로 잠겨 있고 실제 download asset은 없습니다.
  - 근거: `app/company/investors/page.tsx`
- `/site-map`
  - investor/news/careers entry는 유지되며, legal은 `#` placeholder 대신 modal 문서로 연결됩니다.
  - 근거: `app/site-map/page.tsx`
- `footer-test`
  - 과거 내부 테스트용 페이지였고, 현재는 공개 라우트에서 제거되어 `404`로 닫혀 있습니다.
  - 근거: `tests/e2e/180-footer-test-hidden.spec.ts`
- `become-a-host2`
  - 별도 기능이 아니라 redirect alias입니다.
  - 근거: `app/become-a-host2/page.tsx`
- `payment/success`
  - 현재 성공 플로우의 owner가 아니라 legacy compatibility landing입니다.
  - 근거: `app/payment/success/page.tsx`

## [아직 비어 있는 부분]
- 비밀번호 재설정 self-service는 없습니다.
  - 현재는 미지원으로 copy만 맞춰져 있습니다.
  - 근거: `app/help/page.tsx`, `docs/2026-04-12_account_auth_self_service_e2e_audit.md`
- 회원 탈퇴 self-service도 없습니다.
  - 계정 페이지에 “운영팀 문의” 안내만 있습니다.
  - 근거: `app/account/page.tsx`
- 커뮤니티 오픈 포럼 기능은 중단 상태입니다.
  - 실제 운영은 `locally_content` 중심입니다.
  - 근거: `app/community/page.tsx`, `app/community/categoryMeta.ts`
- 공개 brand/legal surface 일부는 진짜 운영 DB나 CMS가 아니라 코드 상수 기반입니다.
  - 근거: `app/config/companyNotices.ts`, `app/company/news/page.tsx`
- cutover용 외부 콘솔 증빙은 repo 안에 완료 상태로 들어 있지 않습니다.
  - 근거: `docs/2026-04-13_external_console_parity_audit.md`

## [페이지/기능별 상태표]
| 이름 | 현재 상태 | 근거 파일 | 실제 문제점 | 우선순위 |
|---|---|---|---|---|
| 홈/공개 랜딩 | 완성 | `app/page.tsx`, `app/layout.tsx`, `app/components/MainSearchBar.tsx` | 데스크탑/모바일 의미 차이가 있어도 의도된 구조라 괜찮지만, 검색 UX가 완전히 통일된 구조는 아님 | 중 |
| 검색 | 완성 | `app/search/page.tsx`, `app/api/search/experiences/route.ts` | 정적 경고는 닫혔고, 데스크탑/모바일 검색 entry 구조 차이만 UX 관점 과제로 남음 | 중 |
| 체험 상세 | 완성 | `app/experiences/[id]/page.tsx`, `app/experiences/[id]/ExperienceClient.tsx` | 상세 자체는 강하지만 client complexity가 큼 | 중 |
| 예약/결제 | 완성 | `app/experiences/[id]/payment/page.tsx`, `app/api/bookings/route.ts`, `app/api/payment/*` | 복잡도가 높아 회귀 위험이 큰 영역 | 상 |
| 게스트 trips/receipt | 완성 | `app/guest/trips/*`, `app/api/guest/trips/*` | completed sync는 운영 job 영향 받음 | 상 |
| 계정/인증 | 완성 | `app/components/LoginModal.tsx`, `app/context/AuthContext.tsx`, `app/account/page.tsx` | password reset/self-delete는 intentionally 없음 | 중 |
| 알림 센터 | 완성 | `app/notifications/page.tsx`, `app/context/NotificationContext.tsx`, `app/api/notifications/*` | page는 정상이나 caller/notification noise는 도메인별 영향 큼 | 중 |
| 메시징/문의 | 완성 | `app/hooks/useChat.ts`, `app/api/inquiries/*`, `app/admin/dashboard/hooks/useAdminChatQuery.ts` | boundary entry 일부는 partial semantics 문서화가 더 필요 | 중 |
| 리뷰 | 완성 | `app/api/reviews/*`, `app/api/host/reviews/reply/route.ts`, `app/utils/reviews/*` | guest_reviews 어드민은 read-only 수준 | 중 |
| 호스트 등록/승인 | 부분완성 | `app/host/register/*`, `app/api/host/register/submit/route.ts`, `app/api/host/register/admin-alert/route.ts` | legacy compatibility route가 남아 있어 owner가 100% 단일화되진 않음 | 중 |
| 호스트 대시보드 | 부분완성 | `app/host/dashboard/page.tsx` | 기능은 강하지만 shell 응집도가 너무 높아 유지보수 리스크 큼 | 상 |
| 호스트 체험 작성/수정 | 완성 | `app/host/create/*`, `app/host/experiences/[id]/edit/page.tsx`, `app/api/host/experiences/*` | create/edit 중복 로직이 많음 | 중 |
| 어드민 대시보드 | 완성 | `app/admin/dashboard/page.tsx`, `app/admin/dashboard/components/*`, `app/api/admin/*` | 운영 표면은 강하지만 Team/Sales owner complexity가 커서 변경 반경 관리가 필요 | 상 |
| 서비스 의뢰 | 완성 | `app/services/*`, `app/api/services/*`, 관련 감사 문서 | 도메인은 강하지만 복잡함 | 중 |
| 전화예약(proxy) | 완성 | `app/proxy-bookings/*`, `app/api/proxy-bookings/*` | 운영 체인은 닫혔지만 내부 complexity가 높음 | 중 |
| 로컬리 콘텐츠 | 완성 | `app/community/page.tsx`, `app/community/[id]/page.tsx`, `app/api/community/*` | legacy 카테고리 호환 분기가 남음 | 중 |
| 공개 회사/브랜드 페이지 | 부분완성 | `app/about/*`, `app/help/page.tsx`, `app/company/*` | preview/read-only closure는 완료됐지만 실제 newsroom/hiring/IR asset launch는 아직 아님 | 중 |
| SEO/메타 | 완성 | `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/utils/structuredData.ts` | repo 안 guard는 닫혔고, 남은 리스크는 외부 redirect/site URL 콘솔 parity 증빙 | 중 |
| 이메일/알림 발송 | 완성 | `app/emails/delivery/sendTemplatedEmail.ts`, `app/api/notifications/email/route.ts` | best-effort side effect라 운영 관찰은 계속 필요 | 중 |
| 정산 체인 | 부분완성 | `app/utils/settlementSync/experienceCompletion.ts`, `app/api/admin/settlement-sync/route.ts`, `app/api/host/earnings/summary/route.ts` | sync worker/수동 실행 의존성이 남음 | 상 |

## [지금 당장 막아야 할 문제]
- repo 안에서 즉시 수정해야 할 `P0 코드 버그`는 이번 close-out 기준으로 별도로 발견되지 않았습니다.
- 지금 남은 핵심 리스크는 `코드 결함`보다 `운영 discipline`과 `외부 콘솔 parity evidence`입니다.
- 정산 완료 전환이 운영 job에 강하게 묶여 있습니다.
  - fail-closed/race guard 회귀 검증은 현재 green이고 repo 안 runbook/day-of 문서도 정리됐지만, payout 실행 전 `completed + pending payout` 확인과 day-of 수동 실행 루틴은 여전히 실제 운영 discipline에 의존합니다.
  - 근거: `docs/2026-04-13_experience_settlement_chain_e2e_audit.md`
- 외부 콘솔 parity는 repo 기준으로 아직 닫히지 않았습니다.
  - Google/Kakao/Supabase/PortOne cutover 증빙 부재
  - 근거: `docs/2026-04-13_external_console_parity_audit.md`

## [MVP까지 남은 핵심 작업]
- settlement sync 운영 루틴을 실제 day-of 운영 습관으로 고정
  - repo 안 runbook/day-of checklist/panel 용어는 현재 기준으로 정리됨
  - 근거: `docs/2026-04-13_experience_settlement_sync_runbook.md`
- cutover 준비
  - 외부 콘솔 parity
  - 최종 redirect/site URL/operator evidence 확보
- release blocker 이후 deferred hardening
  - host dashboard shell 응집도 완화
  - create/edit 중복 로직 정리
  - legacy/compat surface 분리
- release 전에는 위 hardening 작업을 새 구현 트랙으로 열지 않고 현재 baseline을 동결합니다.

## [배포 전 필수 확인]
- settlement sync health panel과 day-of checklist를 같은 순서로 운영할 것
- settlement 7-spec regression green 상태를 release baseline으로 유지할 것
- `NEXT_PUBLIC_SITE_URL`, OAuth redirect, Supabase redirect, PortOne live path를 실제 콘솔에서 다시 확인할 것
- OAuth/PG external allowlist 확인
  - repo만으로는 보장 불가
- payout 실행 전 `completed + pending payout` 확인 루틴을 운영 체크리스트에 고정할 것
- `/host/dashboard` 대형 구조 리팩터는 release 전 범위에서 제외하고 현재 green 동작을 유지할 것
- 위 확인 항목이 비면 `code blocker`가 아니라 `operational hold`로 release 판단을 보류할 것

## [셀프리뷰]
- 놓친 폴더가 없는지
  - 최상위 구조, `app`, `tests`, `docs`, `scripts`, `public`, SQL 파일군까지 인벤토리했습니다.
  - 다만 700개가 넘는 TS/TSX를 한 줄씩 전부 읽은 것은 아니고, 전체 owner map + 핵심 파일 + suspicious seam + 최신 감사 문서를 교차 검증했습니다.
- 너무 낙관적으로 본 부분이 없는지
  - 정적 품질 gate가 실제로 닫힌 만큼 초기 판단보다 운영 점수는 올렸습니다.
  - 다만 settlement는 여전히 운영 루틴을 잘 지켜야 하고, 외부 콘솔 parity가 repo 밖/운영 쪽에 남아 있어 과도한 낙관은 피했습니다.
- 실제 코드를 안 보고 추정한 부분이 없는지
  - 본 보고서의 핵심 결론은 실제 확인한 파일, `lint/tsc/build` 재실행, close-out regression `29 passed`, settlement rerun 결과, 기존 최신 감사 문서에만 닻을 내렸습니다.
  - 외부 콘솔 상태처럼 repo 밖 정보가 필요한 항목은 `부분 보장` 또는 `미검증` 의미로 남겼습니다.
- 다시 보면 수정할 판단이 있는지
  - 처음 감사 당시보다 repo 안 정리 상태는 확실히 좋아졌습니다.
  - 지금 남은 핵심은 새 기능이 아니라 `settlement 운영 고정`, `external parity evidence`, `release 이후 구조 hardening`입니다.

## [한 줄 결론]
이 프로젝트는 이제 “repo 안 품질 gate와 공개면 정리는 대부분 끝난 큰 플랫폼”에 가깝고, 남은 핵심 일은 새 기능보다 `settlement 운영 루틴 고정`, `external console parity 증빙`, `release 이후 구조 hardening`을 분리해서 닫는 것입니다.

## 부록 1. 핵심 근거 파일
- 구조/전역
  - `app/layout.tsx`
  - `app/context/AuthContext.tsx`
  - `app/context/NotificationContext.tsx`
  - `next.config.ts`
  - `package.json`
- 게스트/예약
  - `app/page.tsx`
  - `app/search/page.tsx`
  - `app/experiences/[id]/page.tsx`
  - `app/experiences/[id]/ExperienceClient.tsx`
  - `app/experiences/[id]/payment/page.tsx`
  - `app/api/bookings/route.ts`
- 인증/계정
  - `app/components/LoginModal.tsx`
  - `app/account/page.tsx`
  - `app/help/page.tsx`
- 메시징
  - `app/hooks/useChat.ts`
  - `app/api/inquiries/thread/route.ts`
  - `app/api/inquiries/message/route.ts`
  - `app/api/inquiries/read/route.ts`
- 호스트/어드민
  - `app/host/dashboard/page.tsx`
  - `app/admin/dashboard/page.tsx`
  - `app/utils/adminAccess.ts`
  - `app/utils/cronAuth.ts`
- 콘텐츠/SEO
  - `app/community/page.tsx`
  - `app/community/[id]/page.tsx`
  - `app/api/community/posts/route.ts`
  - `app/robots.ts`
  - `app/sitemap.ts`
  - `app/utils/structuredData.ts`
- 이메일/알림
  - `app/api/notifications/email/route.ts`
  - `app/emails/delivery/sendTemplatedEmail.ts`
  - `app/utils/adminEmailProvider.ts`
- 운영 리스크
  - `app/utils/siteUrl.ts`
  - `docs/2026-04-13_external_console_parity_audit.md`
  - `docs/2026-04-13_experience_settlement_chain_e2e_audit.md`

## 부록 2. 이번 실행 증거
- `npm run build`: 통과
- `npm run lint`: 통과
- `npm run lint -- --quiet`: 통과
- `npx tsc --noEmit`: 통과
- close-out regression rerun
  - 실행 스펙
    - `107-home-landing-ingress`
    - `114-search-mobile-city-filter`
    - `137-home-search-location-localization`
    - `142-home-mobile-city-shortcuts`
    - `43-guest-search-detail-ingress`
    - `15-admin-team`
    - `18-admin-team-badge`
    - `89-admin-team-mobile`
    - `93-host-create-copy-layout`
    - `97-host-register-visibility`
    - `34-host-edit-and-dates-ui`
    - `38-host-profile-save`
    - `129-host-profile-language-dedup`
    - `51-host-mobile-photo-actions`
    - `48-service-visibility`
    - `106-service-host-flow-guidance`
  - 결과
    - `16 specs / 29 tests passed`
  - 메모
    - `89-admin-team-mobile`는 현재 Team Workspace 계약(`Daily Log & Tasks / 팀 메모장 / 전화 예약`)에 맞게 stale expectation을 정리했습니다.
- settlement regression rerun
  - 실행 스펙
    - `57-guest-trips-sync-completed`
    - `130-admin-settle-host-payout-guard`
    - `133-host-payout-summary-reflection`
    - `155-admin-settlement-sync-status`
    - `156-admin-settlement-sync-manual-trigger`
    - `157-settlement-sync-race-guard`
    - `158-settlement-sync-fail-closed`
  - 결과
    - `7 specs / 18 tests passed`
  - 메모
    - `157`, `158`는 local `next start` 기준에서도 재현 가능한 localhost test-hook 경로로 정리해 fail-closed/race guard 회귀를 다시 green으로 맞췄습니다.

## 부록 3. dead code / legacy / placeholder 후보
- `footer-test` route retired (`404`)
- `app/become-a-host2/page.tsx`
- `app/payment/success/page.tsx`
- `app/api/bookings/confirm-payment/route.ts`
- `app/api/services/bookings/route.ts`
- `app/api/host/register/admin-alert/route.ts`
- `app/[...rest]` 빈 디렉터리
- `scripts/diagnostics/*`의 CommonJS 진단 스크립트들
