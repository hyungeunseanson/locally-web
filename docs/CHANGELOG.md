# Locally-Web CHANGELOG

> 과거 완료된 버그 수정, UI/UX 조정, 패치 내역을 보관하는 이력 문서.
> 새로운 기능/아키텍처 결정은 `gemini.md`에 기록한다.

---

## v3.24.1 — RLS 보안 정책 최적화 및 통합 마이그레이션 스크립트 갱신

**작업일:** 2026-03-03

### 개요
- DB 마이그레이션 적용 중 발생한 Permission Denied 에러를 원천 차단하기 위해 `auth.users` 서브쿼리를 조회하는 불안정한 방식을 폐기하고, Supabase 권장 안전 방식인 `auth.jwt() ->> 'email'` 클레임 추출 방식으로 모든 RLS(Row Level Security) 정책 8개를 전면 재작성했습니다. (안정성 극대화 및 레이턴시 단축)
- 분산될 수 있는 테이블 생성(`proxy_requests`, `proxy_comments`) 및 인덱스/트리거 로직을 하나의 통합본인 `supabase_proxy_service_migration.sql` 파일에 모두 병합하여, 빈 DB에서도 한 번의 실행으로 완벽한 인프라가 구축되도록 무결성을 보장했습니다.

---

## v3.24.0 — 일본 현지 전화 대행 예약 서비스 (Proxy Service) 내재화

**작업일:** 2026-03-03

### 개요
스마트스토어에서 수동으로 운영 중이던 '일본 전화 대행 예약 서비스'를 Locally 플랫폼으로 내재화하여 고객-관리자 간의 1:1 티켓 기반 양방향 커뮤니케이션 파이프라인으로 구축 완료.

### [Proxy-1] 통일된 1:1 티켓 보드 아키텍처 (어드민 대시보드 무의존)
- 무거운 별도의 어드민 페이지 없이, 고객과 관리자가 권한(Role)에 따라 다르게 접근하는 단일 라우트 `/proxy-bookings`를 구현.
- 고객은 자신의 예약건만 확인 가능하고, 관리자는 모든 요청을 모니터링 및 상태 변경 가능하도록 Supabase RLS 및 서버사이드 접근 제어(ACL) 적용.

### [Proxy-2] 유연한 폼 데이터(JSONB)와 2-Track 결제
- 카테고리별(식당 예약, 교통 문의 등 5가지)로 완전히 다른 입력 양식을 하나의 테이블에 수용할 수 있도록 `proxy_requests.form_data`(JSONB) 스키마 도입.
- 기존 스마트스토어 결제 고객(주문번호 대신 직관적 구매자명 수집)과 Locally 자체 웹 결제 고객의 데이터 폼 트랙을 분리하여 Zod 기반 다이나믹 유니온 스키마 검증 구축.

### [Proxy-3] 양방향 댓글 시스템 + 실시간 이메일 알림
- 고객과 관리자가 1:1로 소통할 수 있는 `proxy_comments` 테이블 및 양방향 채팅 UI 구현.
- 답글 작성 시 즉각적으로 상대방에게 로컬리 이메일 알림을 비동기 발송하도록 `/api/notifications/send-email` (`type: proxy_comment_notify`) 백그라운드 확장.

---

## v3.23.0 — Platform Stability & Email Infrastructure Overhaul Backend Patch

**작업일:** 2026-03-03

### 개요
플랫폼의 치명적인 결함(Postgres 참조 무결성 500 에러 및 이메일 결합도로 인한 PG사 결제 타임아웃)을 전면 척결하고, 데이터 정합성과 알림 시스템의 독립성을 보장하는 대규모 백엔드 구조조정 완료.

### [Core-1] Postgres DB Auth Trigger를 통한 프로필 동기화 아키텍처 (100% 보장)
- 클라이언트단(`syncProfile.ts` 등 6곳)에 의존하던 수동 프로필 동기화 런타임을 폭파하고, DB 레벨의 Postgres Trigger(`on_auth_user_created`)로 마이그레이션.
- 예약 및 1:1 문의 등 필수 파이프라인에서 발생하던 `profiles` FK Constraint Violation(`500 Error`) 영구 해결.

### [Core-2] 결제 웹훅과 이메일 시스템의 완벽 분리 (Decoupling)
- 메인 결제 라우트(`nicepay-callback`, `cancel`) 내부에 공생하며 타임아웃을 유발하던 무거운 React Email 렌더링 + Nodemailer 발송 로직 전단 도려냄.
- 이메일 전용 백그라운드 API `/api/notifications/send-email`을 신설하고, PG망에는 `200 OK`를 우선 반환한 후 비동기 Fetch(fire-and-forget) 방식으로 알림을 넘기는 독립 아키텍처 구현.

### [Core-3] React Email 렌더링 크래시 방어 및 안정성 패치
- 결제 콜백 웹훅으로부터 누락되었던 필수 `totalAmount` 페이로드를 조인하여 전송.
- `BookingConfirmationEmail`/`BookingCancellationEmail` 내부에서 조인되지 않은 `null`, `undefined`, 빈 문자열 등이 주입되어도 Vercel 엔진이 뻗지 않도록 모든 Props에 옵셔널 체이닝(`?.`) 및 런타임 Fallback(`|| 0`) 방어벽 100% 구축.

### [Core-4] 백그라운드 에러 로깅 복구 및 무결성 확보 (Silent Error 추적)
- `send-email` 내부의 렌더 에러 예외 처리 블록(`catch`)에서 `request.clone().json()`을 이중으로 호출하다가 "stream already read"로 죽어버려 에러를 은폐하던 치명적 버그 디버깅 완료.
- 렌더에 실패하더라도 메인 결제 모델엔 지장 없이, `notifications` 테이블에 대상자의 `hostId`와 함께 `type: 'system_error'` 로그를 즉각 박아넣는 무결성 달성.

---

## v3.22.1 — React Email 렌더링 및 백그라운드 로깅 핫픽스 (Hotfix)

**작업일:** 2026-03-03

### 개요
v3.22.0 분리 이후 발생한 `BookingConfirmationEmail` 렌더링 크래시 및 에러 로깅 누락(Silent Error) 해결.

### [Hotfix-1] 이메일 페이로드 및 렌더링 타입 안정화
- 결제 콜백 웹훅으로부터 누락되었던 필수 `totalAmount` 데이터를 페이로드에 추가.
- React Email 컴포넌트 내부에서 `null` 값 참조 시 크래시가 발생하던 취약점을 방어하기 위해 Optional Chaining(`?.`) 및 컴포넌트 내부 런타임 Fallback 값 보강.

### [Hotfix-2] 백그라운드 로깅 예외(Exception) 버그 수정
- `app/api/notifications/send-email/route.ts` 내에서 이미 소모된 `request.json()` 스트림을 `catch` 블럭 안에서 `request.clone().json()`으로 중복 호출하여 "Type Error: stream already read" 에러가 이중으로 발생하던 설계상의 버그를 발견하여 즉각 수정.
- 본문 변수(`body`)의 스코프를 `try..catch` 바깥으로 승격시켜 이제 시스템 에러 발생 시 정상적으로 `notifications` 테이블에 대상자와 원인 에러 로그가 강제 저장됨.

---

## v3.22.0 — 결제 웹훅과 이메일 전송의 완전한 분리 (Decoupling)

**작업일:** 2026-03-03

### 개요
결제망의 타임아웃을 유발하던 무거운 React Email 렌더링 부하를 메인 결제 스레드에서 완전히 분리하는 아키텍처 재설계 진행.

### [Fix-1] 이메일 전용 백그라운드 API 신설
- 무거운 HTML 렌더링(React Email)과 Nodemailer 발송 로직만을 전문적으로 담당하는 `app/api/notifications/send-email/route.ts` 신설.
- 이메일 발송 실패 시(Catch), 아무도 모르게 무시(Swallow)하던 버그를 해결하기 위해 `notifications` 테이블에 `type: 'system_error'`로 장애 로그를 강제 기록하도록 구현.

### [Fix-2] 결제 콜백 API에서 이메일 렌더링 로직 철거
- `app/api/payment/nicepay-callback/route.ts` (예약 확정) 및 `app/api/payment/cancel/route.ts` (예약 취소) 내부에 있던 동기식 이메일 처리 로직을 완벽하게 도려냄.
- DB 처리가 끝난 즉시 신설된 전용 API(`send-email`)를 비동기 Fetch(fire-and-forget) 방식으로 호출하고, PG망에는 1순위로 `200 OK`를 빠르게 반환하여 Timeout 및 Silent Failure 사태 원천 차단.

---

## v3.21.0 — 프로필 동기화 아키텍처 개선 및 FK 결함 척결

**작업일:** 2026-03-03

### 개요
예약 및 1:1 문의 등 주요 파이프라인에서 발생하던 `profiles` 테이블 참조 무결성(FK Constraint) 500 에러를 영구적으로 해결하기 위한 DB 레벨 아키텍처 개선.

### [Arch-1] Postgres DB Trigger 기반 자동 프로필 생성 (Backfill 포함)
- 클라이언트의 네트워크 상태나 비정상 종료에 의존하던 불안정한 수동 생성(Upsert) 방식을 폐기.
- Supabase Auth 회원가입(`auth.users` Insert) 시 즉각적으로 연동되는 Postgres Trigger `on_auth_user_created` 구현.
- 기존 DB 내 누락된 '유령 유저'들을 복구하는 Backfill 마이그레이션 스크립트 작성 반영 (`supabase_profile_sync_migration.sql`).

### [Arch-2] 프론트엔드 불안정 코드 척결 및 Graceful Error Handling
- 클라이언트 레벨에서 프로필 시드를 강제로 쑤셔넣던 위험 코드 전역 삭제 (`syncProfile.ts`, `auth/callback/route.ts`, `LoginModal.tsx`, `account/page.tsx`, `MobileProfileView.tsx`, `ProfileEditor.tsx`).
- 핵심 API 라우트 (`api/bookings`, `useChat.ts` 등)에서 DB 지연에 따른 500 에러 발생 시, 유저 친화적인 400 Bad Request 에러 메시지로 반환하도록 런타임 안정성 보강.

---

## v3.20.0 — 이메일 UX 글로벌 프리미엄 모던 리뉴얼 적용

**작업일:** 2026-03-03

### 개요
글로벌 스탠다드에 맞추어 `react-email`을 도입하고, 핵심 비즈니스 이메일(예약 확정 / 예약 취소)의 디자인을 에어비앤비 수준의 모던하고 친근한 영수증 스타일로 전면 개편.

### [Email-1] 공통 이메일 레이아웃 및 컴포넌트 에셋 구축
- **파일:** `app/emails/components/EmailLayout.tsx`, `CTAButton.tsx`
- 연한 회색 바탕과 중앙 정렬된 16px 곡률의 흰색 컨테이너를 기본 레이아웃으로 제정.
- 명확도 높은 검은색 큰 CTA 버튼 적용.

### [Email-2] 핵심 비즈니스 이메일 템플릿(React Email) 교체
- 기존의 하드코딩 Raw HTML을 버리고, React 기반의 선언적 템플릿 렌더링 도입.
- **예약 확정 메일:** 직관적인 영수증 형태의 정보 배치 (인원수, 일자 명확히 분리 표기).
- **예약 취소 알림:** 위약금 환불액과 취소 사유를 명시하는 정중한 톤앤매너 템플릿 적용.
- **파일:**
  - `app/emails/templates/BookingConfirmationEmail.tsx`
  - `app/emails/templates/BookingCancellationEmail.tsx`
  - `app/api/payment/nicepay-callback/route.ts` (템플릿 render() 연결)
  - `app/api/payment/cancel/route.ts` (템플릿 render() 연결)

---

## v3.19.0 — 관리자 대시보드 유저 상세 모달 더미 데이터 척결

**작업일:** 2026-03-03

### 개요
어드민 대시보드(`UsersTab`)의 유저 상세 보기 모달에 방치되어 있던 하드코딩 구매/리뷰 데이터를 실제 DB 연동으로 전면 개편.

### [Data-1] 실제 결제/예약 및 리뷰 내역 연동
- 선택된 유저 ID를 기반으로 Supabase `bookings` 및 `reviews` 테이블 통합 Fetch 로직 추가.
- 가져온 실제 데이터를 바탕으로 '총 구매액', '구매 횟수', '마지막 구매일' 동적 산출 및 렌더링.
- 렌더링 목적의 가짜 구매 활동 배열(`을지로 노포 투어...`) 및 가짜 리뷰 배열 영구 삭제.
- **파일:** `app/admin/dashboard/components/UsersTab.tsx`

### [Data-2] Loading 및 Empty State 처리 추가
- 데이터 Fetching 중 상태를 표시하기 위한 로딩 스피너 UI 추가.
- 해당 유저의 결제 내역이나 받은 리뷰가 없을 경우 "구매 내역이 없습니다", "아직 받은 리뷰가 없습니다" 문구를 표시하는 Empty State 방어 코드 적용.

---

## v3.18.0 — 체험 등록 파이프라인 데이터 렌더링 누수 복구

**작업일:** 2026-03-03

### 개요
호스트가 체험 등록 시 입력한 데이터 중 어드민 및 게스트 화면에서 정상적으로 렌더링되지 않던 항목(누수 및 고립 데이터)을 복구하여 UI에 온전히 표시되도록 수정.

### [UI-1] 어드민 체험 관리(EXPS) 상세 화면 데이터 매핑 복구
- DB에는 저장되지만 화면에 누락되었던 필수 정보들을 추가 렌더링.
- 복구 항목: 진행 언어 및 레벨, 카테고리, 상세 주소(`location`), 준비물, 단독 투어 옵션, 참가 제한 규정(연령, 활동 강도).
- **파일:** `app/admin/dashboard/components/DetailsPanel.tsx`

### [UI-2] 상세 지역(subCity) 고립 현상 해결
- DB/폼에 보유 중이던 `subCity` 데이터를 `city`와 결합하여 렌더링하도록 UI 수정 (예: "오사카, 난바").
- 어드민 상세 화면 및 게스트 체험 카드, 상세 화면 Location Header에 모두 적용 완료.
- **파일:** 
  - `app/experiences/[id]/ExperienceClient.tsx`
  - `app/components/ExperienceCard.tsx`
  - `app/admin/dashboard/components/DetailsPanel.tsx`

---

## v3.17.0 — 글로벌 다국어(i18n) 통합 및 UX 라이팅 고도화

**작업일:** 2026-03-02

### 개요
글로벌 런칭 스펙 확정에 따라, 플랫폼 전체(어드민 제외)의 다국어(i18n) 통합 및 에어비앤비 스타일의 프리미엄 UX 라이팅 고도화 작업을 실시결함.

### [i18n-1] LanguageContext 딕셔너리 확장
- 한국어(`ko`), 영어(`en`), 일본어(`ja`), 중국어(`zh`) 4개 국어 사전을 지원하도록 `LanguageContext.tsx` 전면 동기화.
- 리뷰 모달, 메인 알림센터, 서비스 의뢰(목록, 상세, 도입, 신청, 결제, 완료 등), 호스트 대시보드의 서비스 탭 등 주요 컴포넌트에 필요한 다국어 Key-Value 쌍 추가.
- **파일:** `app/context/LanguageContext.tsx`

### [i18n-2] 컴포넌트 내 하드코딩 텍스트 전면 치환 (UX 라이팅 고도화 적용)
- 사용자 경험 향상을 위해 간결하고 행동 지향적이며, 구어체 기반의 친근한 UX 라이팅 적용.
- `t()` 훅을 전역적으로 주입하여 기존 하드코딩되어 있던 한글 텍스트 완벽 교체 완료.
- **파일:**
  - `app/services/page.tsx`
  - `app/services/request/page.tsx`
  - `app/services/[requestId]/ServiceRequestClient.tsx`
  - `app/services/[requestId]/apply/page.tsx`
  - `app/services/[requestId]/payment/page.tsx`
  - `app/services/[requestId]/payment/complete/page.tsx`
  - `app/services/intro/IntroClient.tsx`
  - `app/services/my/page.tsx`
  - `app/host/experiences/[id]/page.tsx`
  - `app/host/dashboard/page.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/components/ReviewModal.tsx`

### [i18n-3] 호스트 대시보드 누락 번역 및 Key 매핑 오류 전면 수정
- 프로필 세팅, 문의함, 매칭현황, 정산, 후기, 가이드라인 등 대시보드 내 하단 탭 전체의 하드코딩된 텍스트와 누락 번역 보완.
- `LanguageContext.tsx` 내 `hp_`, `hr_`, `hd_`, `hg_` 등의 프리픽스가 섞여 매핑되지 않던 오류를 전부 식별하고 올바른 Key 값으로 치환.
- **파일:**
  - `app/context/LanguageContext.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
  - `app/host/dashboard/components/GuidelinesTab.tsx`
  - `app/host/dashboard/components/ReservationCard.tsx`

---

## v3.16.0 — Admin 대시보드 UI/UX 라우팅 재설계 (Domain Grouping)

**작업일:** 2026-03-02

### 개요
C레벨 파트너의 의사결정에 따라 데이터/API 로직 변경 없이 순수 프론트엔드 UI/UX 배치만 조정.
MANAGEMENT 그룹 재배치 및 REVIEWS, LOGS 탭을 ANALYTICS 하위 중첩 탭으로 흡수.

### [UI-1] Sidebar 네비게이션 재배치
- `MANAGEMENT` 그룹에 'Approvals (승인 관리)', 'User Management (유저 관리)', 'Service Requests' 3종 집중 배치.
- 서비스 의뢰 네비게이션 영문 텍스트 통일.
- 메인 사이드바에서 `Review Management`와 `Audit Logs` 탭 제거.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [UI-2] AnalyticsTab 내부 중첩 서브 탭 연동
- 메인 Analytics 페이지 상단에 4개의 서브 탭 네비게이터 배치: `Business & Guest`, `Host Ecosystem`, `Review Management`, `Audit Logs`.
- 기존 `ReviewsTab`, `AuditLogTab` 컴포넌트 렌더링 위치를 사이드바 라우팅이 아닌 `AnalyticsTab` 내부 상태 제어로 이관.
- **파일:** `app/admin/dashboard/components/AnalyticsTab.tsx`, `app/admin/dashboard/page.tsx`

### [UI-3] 1:1 문의 채널 상태 관리 및 프로필 고도화
- 관리자가 대기(open) 상태인 1:1 문의에 첫 메시지를 전송 시 자동으로 '처리중(in_progress)' 상태로 전환되도록 자동화 적용. (완료 상태는 수동 관리 유지)
- 관리자가 발송한 메시지의 렌더링 이름을 관리자 개인 계정 이름에서 공식 명칭인 '로컬리'로 고정 노출되도록 개선.
- 기존 '해결' 텍스트를 '완료'로 용어 변경.
- **파일:** `app/admin/dashboard/components/ChatMonitor.tsx`

### [PERF-1] 유저 활동 상태 DB 업데이트 스로틀링 도입 (DB 쓰기 병목 해소)
- 클라이언트의 페이지 전환(라우팅) 시마다 발생하는 무분별한 `last_active_at` 업데이트를 방지하기 위해 5분(300초)의 쿨타임을 적용했습니다.
- 외부 캐시 서버(Redis 등) 도입 없이 브라우저의 `localStorage`와 리액트 의존성(`usePathname`)을 순수하게 활용한 애플리케이션 레벨의 방어 로직을 구축했습니다.
- 실시간 접속 표시를 위한 웹소켓(`Supabase Channel`) 마운트 로직과 영구 저장용 DB 업데이트 로직을 2개의 단독 `useEffect` 훅으로 분리했습니다.
- **파일:** `app/components/UserPresenceTracker.tsx`

### [UX-1] 네이티브 수준의 시각적 고급화 (Premium UX & Micro-interactions)
- **부드러운 페이지 전환 (Page Transitions):** `framer-motion`을 도입하여 페이지 라우팅 시 글로벌 페이드&슬라이드 업 효과 스펙 적용. (어드민 대시보드 예외 처리)
- **쫀득한 조작감 (Bouncy Micro-interactions):** `Button`, `ExperienceCard`, `TripCard`, `ServiceCard`, `HostProfileCard` 등 상호작용 가능한 요소들에 `active:scale-95` 또는 `active:scale-[0.98]` 기반의 물리적 수축 효과 부여. 리플로우(Reflow)를 발생시키지 않는 GPU 가속 애니메이션만을 사용하여 성능을 방어합니다.
- **고급 로딩 경험 (Skeleton UI):** 밋밋한 Pulse 로딩을 걷어내고, 인스타그램/에어비앤비 모델 기반의 Shimmer 스켈레톤 애니메이션 컴포넌트로 전면 교체하여 체감 대기시간 극복.
- **파일:** `app/components/ui/PageTransition.tsx`, `app/components/ui/Skeleton.tsx`, `app/components/ClientMainWrapper.tsx`, `app/components/ui/Button.tsx`, `app/globals.css` 및 카드 컴포넌트 전체.

### [UX-2] 로딩 스피너 디자인 표준화 및 하드코딩 박멸
- **디자인 표준화:** `app/components/ui/Spinner.tsx` 컴포넌트를 신설하여 기존 무분별하게 혼용되던 로딩 방식(텍스트/아이콘)을 통일했습니다. 
- **브랜드 컬러 적용:** `Lucide-react`의 `Loader2`를 기반으로 `Locally` 브랜드 컬러(`text-[#FF385C]`)와 `animate-spin`을 적용, 모듈 십자 레이아웃 호환성을 위해 중앙 정렬(`flex justify-center`) 옵션 내장.
- **하드코딩 텍스트 일괄 제거:** 글로벌 코드베이스를 스캔하여 임시로 작성되었던 `<div>Loading...</div>` 및 `로딩 중...` 텍스트 블록들을 모두 박멸하고 신규 스피너 컴포넌트로 마이그레이션 적용. (ex. `Guest Inbox`, `Account`, `Payment` 파이프라인 등)

## v3.15.0 — 리뷰 시스템 고도화 (알림 파이프라인 + Admin 관리 + 후기 수정 + 평점 집계)

**작업일:** 2026-03-02

### 개요
리뷰 시스템 AS-IS 진단 후 확인된 운영 공백 R1~R7 구현 (R8 영구 폐기).
DB 스키마 변경 2건(마이그레이션 스크립트 `docs/migrations/v3_15_0_review_enhancements.sql` 참조).
R7(게스트 본인 받은 리뷰 열람)은 기존 코드에 이미 구현되어 있음 — 추가 변경 없음.

### [R1] 리뷰 등록 → 호스트 알림

- **기존 문제:** 게스트가 후기 작성 시 호스트에게 아무런 알림 없음. 호스트가 대시보드를 직접 방문해야만 인지 가능.
- **수정:** `POST /api/reviews` 성공 후 `notifications` 테이블에 직접 INSERT (서버사이드 — sendNotification() 불가).
  - type: `'new_review'`, 링크: `/host/dashboard?tab=reviews`
- **파일:** `app/api/reviews/route.ts`

### [R2] 예약 완료 → 게스트 후기 작성 요청 알림

- **기존 문제:** 크론 잡이 예약을 `completed`로 처리하지만, 게스트에게 후기 작성 유도 없음.
- **수정:** `GET /api/cron/complete-trips` — 완료 처리 후 각 게스트에게 `notifications` INSERT.
  - type: `'review_request'`, 링크: `/guest/trips`
  - 초기 select에 `user_id, experiences(title)` 추가.
- **파일:** `app/api/cron/complete-trips/route.ts`

### [R3] 호스트 답글 → 게스트 알림

- **기존 문제:** 호스트가 후기에 답글 작성 시 게스트에게 알림 없음.
- **수정:** `HostReviews.tsx` `handleSubmitReply()` 성공 후 `sendNotification()` 호출 (클라이언트사이드 가능).
  - type: `'review_reply'`, 링크: `/guest/trips`
- **파일:** `app/host/dashboard/HostReviews.tsx`

### [R4] Admin 리뷰 관리 탭 신설

- **기존 문제:** Admin 대시보드에 리뷰 조회/관리 탭 없음. 부적절 리뷰 대응 불가.
- **수정:**
  - `ReviewsTab.tsx` 신규 컴포넌트 생성: 전체 리뷰 목록 + 검색 + 별점 필터 + 강제 삭제.
  - Admin Sidebar `Finance` 그룹에 "Review Management" NavButton 추가 (탭 키: `REVIEWS`).
  - `page.tsx` 라우팅에 `activeTab === 'REVIEWS'` 케이스 추가.
- **파일:** `app/admin/dashboard/components/ReviewsTab.tsx` (신규), `Sidebar.tsx`, `page.tsx`

### [R5] 게스트 후기 수정 기능 (작성 후 7일 이내)

- **기존 문제:** 후기 작성 후 수정 불가. 오탈자/오해 수정 방법 없음.
- **수정:**
  - `PATCH /api/reviews/[id]/route.ts` 신규 엔드포인트: 본인 후기 + 7일 이내 검증 + 평점 재집계.
  - `GET /api/guest/trips`: `reviews (id)` → `reviews (id, rating, content, photos, created_at)` 변경. 응답에 `review` 객체 포함.
  - `ReviewModal.tsx`: `trip.review?.id` 존재 시 수정 모드로 자동 진입. 기존 사진 유지 + 새 사진 추가 지원. 제목 "후기 작성" → "후기 수정" 전환.
  - `PastTripCard.tsx`: 후기 작성 완료 시 "수정" 버튼 노출 (클릭 → `onOpenReview(trip)` 호출 → 수정 모드 ReviewModal 오픈).
- **파일:** `app/api/reviews/[id]/route.ts` (신규), `app/api/guest/trips/route.ts`, `app/components/ReviewModal.tsx`, `app/guest/trips/components/PastTripCard.tsx`

### [R6] 호스트 프로필 전체 평점 집계 (DB 저장 방식)

- **기존 문제:** 호스트 전체 평점이 체험 상세 SSR에서 런타임 계산됨 (체험별 DB 저장값과 불일치).
- **수정:**
  - `profiles.average_rating NUMERIC(3,2)`, `profiles.total_review_count INTEGER` 컬럼 추가 (마이그레이션).
  - `POST /api/reviews` + `PATCH /api/reviews/[id]`: 체험 집계 후 해당 호스트의 전체 리뷰 재집계 → `profiles` 업데이트.
  - 집계 실패 시 후기 저장/수정에 영향 없도록 try-catch 처리.
- **마이그레이션:** `docs/migrations/v3_15_0_review_enhancements.sql`

### [R7] 게스트 본인 받은 리뷰 열람

- **상태:** 기존 코드 확인 결과 이미 구현 완료 (`account/page.tsx` 데스크탑 + `MobileProfileView.tsx` 모바일 양쪽).
- **추가 작업 없음**

### notification.ts — 신규 타입 추가

- `'new_review'`, `'review_reply'`, `'review_request'` 3개 타입 추가.
- **파일:** `app/utils/notification.ts`

---

## v3.14.0 — 메시징 시스템 Phase C (M3 읽음 시각 + M5 CS 상태 큐)

**작업일:** 2026-03-02

### 개요
[M3] C2C 신뢰도 강화: 읽음 시각 정밀화 / [M5] Admin 운영 효율: CS 문의 칸반형 상태 관리.
DB 스키마 변경 2건(마이그레이션 스크립트 `docs/migrations/v3_14_0_chat_enhancements.sql` 참조).

### [M3] inquiry_messages — read_at 컬럼 추가 + "읽음 HH:MM" UI

- **기존 문제:** 발신자 메시지에 '1'만 표시, 상대방이 정확히 언제 읽었는지 알 수 없음.
- **DB 변경:** `inquiry_messages.read_at TIMESTAMPTZ` 컬럼 추가.
- **useChat.ts:** `markAsRead()`에서 `is_read=true`와 함께 `read_at=NOW()` 기록. 이미 `read_at` 있는 메시지는 덮어쓰지 않음(`.is('read_at', null)` 조건).
- **UI 변경 (C2C 발신자 메시지 좌측 메타 영역):**
  - 미읽음: "1" (파란색 bold)
  - 읽음 + read_at 있음: "읽음 오후 2:05" (회색 소문자)
  - 읽음 + read_at 없음(레거시): 표시 없음 (마이그레이션 전 기존 메시지 보호)
- **파일:** `app/hooks/useChat.ts`, `app/guest/inbox/page.tsx`, `app/host/dashboard/InquiryChat.tsx`

### [M5] inquiries — status 컬럼 + ChatMonitor 칸반형 상태 관리

- **기존 문제:** 1:1 CS 문의 상태 관리 불가, 대기/처리중/해결 구분 없음.
- **DB 변경:** `inquiries.status TEXT DEFAULT NULL` 컬럼 추가 (NULL=C2C 무관, 'open'|'in_progress'|'resolved' CS 전용).
- **useChat.ts:** `InquiryRow`에 `status?: string | null` 타입 추가 (select `*`로 자동 포함).
- **ChatMonitor UI:**
  - "1:1 문의" 탭 헤더에 상태 필터 필: 전체 / 대기 / 처리중 / 해결 (null 상태 문의는 '대기'에 포함)
  - 문의 목록 각 아이템에 상태 뱃지 표시 (amber=대기, blue=처리중, green=해결)
  - 채팅 헤더 우상단에 3개 상태 전환 버튼 (클릭 시 supabase.update + refresh() 재조회)
- **C2C 채팅 영향 없음** (monitor 탭은 기존 로직 그대로)
- **파일:** `app/hooks/useChat.ts`, `app/admin/dashboard/components/ChatMonitor.tsx`

---

## v3.13.0 — 메시징 시스템 Phase A & B 고도화 (CS 뱃지 + Admin CS 개시)

**작업일:** 2026-03-02

### 개요
메시징 시스템 현황 진단 후 확인된 운영 긴급 공백(M1, M2) 구현.
DB 스키마 변경 없이 기존 `inquiries.type` 구분 구조 그대로 활용.

### [M2] Sidebar — CS 미답변 건수 뱃지 추가 (Phase A)

- **기존 문제:** Admin 사이드바 "Message Monitoring" 버튼에 CS 1:1 문의 미답변 건수 미노출.
- **수정:**
  - `fetchCounts()`에 2-step 쿼리 추가: admin_support inquiry ID 수집 → `inquiry_messages.is_read=false` 건수 카운트.
  - `counts.csUnreadCount` 상태값 추가, 탭 비활성 시 "Message Monitoring" NavButton 뱃지 노출.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [M1] DetailsPanel — Admin CS 먼저 개시 기능 (Phase B)

- **기존 문제:** Admin이 유저 목록에서 특정 유저에게 먼저 CS 메시지를 보낼 수 없었음.
- **수정:**
  - USERS 탭 상세 패널 하단에 "1:1 CS 메시지 보내기" 버튼 추가.
  - 클릭 시: 기존 admin_support 문의 있으면 해당 채팅으로 이동, 없으면 신규 `inquiries` 레코드 생성 후 이동.
  - `router.push('/admin/dashboard?tab=CHATS&inquiryId=X')` 패턴으로 ChatMonitor 자동 선택 연동.
- **파일:** `app/admin/dashboard/components/DetailsPanel.tsx`

### [M1] ChatMonitor — URL inquiryId 파라미터 자동 선택 (Phase B)

- **기존 문제:** ChatMonitor에 특정 문의 자동 선택 진입점 없음.
- **수정:**
  - `useSearchParams()`로 `?inquiryId=X` 파라미터 감지.
  - inquiries 로드 시 매칭 문의를 자동 선택 (`setActiveTab('admin')` + `loadMessages()`).
- **파일:** `app/admin/dashboard/components/ChatMonitor.tsx`

---

## v3.12.0 — Admin 대시보드 운영 공백(GAP) 고도화

**작업일:** 2026-03-02

### 개요
맞춤 의뢰(Service) 에스크로 선결제 도입 이후 진단된 6개 운영 공백 중 우선순위 4개(G1~G4)를 해결.
기존 useAdminData.ts 무거운 훅 미수정, 테이블 강제 병합 없이 KPI 통합 + 운영 분리 원칙 유지.

### [G4] Sidebar — 서비스 무통장 입금 대기 뱃지 추가

- **기존 문제:** 사이드바의 "맞춤 의뢰 관리" 버튼에 알림 뱃지 없음. 무통장 입금 대기 건수 파악 불가.
- **수정:** `service_bookings` 테이블에서 `status=PENDING & payment_method=bank` 건수를 `fetchCounts()`에 추가. "맞춤 의뢰 관리" NavButton에 `count={counts.servicePendingBank}` 뱃지 노출.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [G2] ServiceAdminTab — 취소 요청 검토 KPI 카드 + 필터 필

- **기존 문제:** `cancellation_requested` 상태 건이 전체 목록에 섞여 운영자가 식별하기 어려움.
- **수정:**
  - KPI 그리드를 `grid-cols-3` → `grid-cols-2 md:grid-cols-4`로 변경하고 4번째 "취소 요청 검토" 카드 추가(건수 > 0일 때 오렌지 강조).
  - AllRequestsTab 상단에 필터 필 2종(전체 / 취소 요청) 추가. 취소 요청 탭 선택 시 해당 행 오렌지 배경 강조 및 빈 상태 메시지 별도 표시.
- **파일:** `app/admin/dashboard/components/ServiceAdminTab.tsx`

### [G3] ServiceAdminTab — 정산 명세서 CSV 다운로드 추가

- **기존 문제:** SettlementTab에 "이체 완료 처리" 버튼만 있고 정산 명세서 내보내기 기능 없음.
- **수정:** 각 호스트 그룹 아코디언 하단에 "명세서 CSV" 버튼 추가. 클릭 시 해당 호스트의 서비스 정산 항목(의뢰명, 날짜, 결제액, 지급액)을 UTF-8 BOM CSV로 다운로드.
- **파일:** `app/admin/dashboard/components/ServiceAdminTab.tsx`

### [G1] SalesTab — 맞춤 의뢰 정산 명세서 CSV 추가 (세무 대응)

- **기존 문제:** SalesTab의 "명세서 다운로드"는 체험 bookings 전용 → 서비스 결제가 세무 명세서에서 완전 누락.
- **수정:** 정산 섹션 헤더에 "맞춤 의뢰 명세서 ↓" 버튼 추가. 클릭 시 현재 날짜 필터 기준으로 `service_bookings` + `service_requests` + `host_applications` + `profiles` on-demand JOIN 조회 후 국세청 소명용 CSV(결제일시/주문번호/의뢰명/고객/호스트/결제수단/금액 등) 생성.
- **파일:** `app/admin/dashboard/components/SalesTab.tsx`

---

## v3.11.0 — 알림 시스템 Phase 1 긴급 수정

**작업일:** 2026-03-02

### 개요
알림 시스템 현황 진단(3가지 치명적 리스크)에 따른 즉시 수정 릴리스.
인앱 알림 + 이메일 2채널 구조를 완벽하게 보장하도록 방어 로직 추가.

### [P1 - CRITICAL] 이메일 SMTP 실패 시 인앱 알림 유실 방지

- **기존 문제:** `POST /api/notifications/email`에서 Gmail SMTP `sendMail()`이 예외를 던지면 외부 try/catch가 HTTP 500을 반환. DB insert는 이미 성공했음에도 불구하고 클라이언트에 에러가 반환되어 혼란 유발 가능.
- **수정:** 단건 `sendMail()` 호출을 독립적인 try/catch 블록으로 격리. 이메일 실패는 `console.warn`으로 로깅만 하고 `{ success: true }` 정상 응답 반환. DB 인앱 알림은 이미 저장됐으므로 사용자 알림은 무조건 보장됨.
- **파일:** `app/api/notifications/email/route.ts`

### [P2 - BUG] 알림 타입 누락으로 인한 TypeScript 타입 불일치 수정

- **기존 문제:** `NotificationType` 유니온에 실제 사용되는 타입 2종 미포함:
  - `'cancellation'` — `app/api/payment/cancel/route.ts`에서 직접 DB INSERT 시 사용
  - `'message'` — `NotificationContext` 내부 가상 알림 생성 시 사용
- **수정:**
  - `app/utils/notification.ts`: `'cancellation'`, `'message'` 두 타입을 유니온에 명시적 추가
  - `app/notifications/page.tsx`: `getIcon()` 함수 개선 — `service_*` 타입에 초록색 Calendar 아이콘 명시 매핑 추가. `cancellation`/`message`가 기존 `includes` 로직으로 이미 올바른 아이콘으로 분기됨을 확인.

### [P3 - CRITICAL] 채팅 알림 새로고침 시 증발 현상 수정

- **기존 문제:** `NotificationContext`가 `inquiry_messages` 테이블 INSERT를 감지해 **메모리에만 존재하는 가상 알림**(id: Date.now())을 생성. 앱 재진입 시 사라지고 알림 페이지 이력에도 남지 않음. 또한 `useChat.sendMessage()`가 `sendNotification()`을 통해 이미 DB에 알림을 저장하므로 토스트가 **2번** 발생하는 중복 문제도 동반.
- **수정:**
  - `app/context/NotificationContext.tsx`: `inquiry_messages` INSERT 구독(Channel B) 완전 제거.
  - `notifications` 테이블 INSERT 구독(Channel A)만 유지. `useChat.sendMessage()` → `sendNotification()` → DB INSERT → Channel A 감지 → 영구 알림 + 토스트의 단일 경로로 통합.
  - `markAsRead()` 가상 ID 분기 가드(`id < 1000000000000`) 제거 — 이제 모든 알림이 실 DB 레코드이므로 항상 DB update 실행.
  - 토스트 아이콘 타입: `newNoti.type.includes('message')` 조건으로 메시지 알림 자동 감지.

### 파일 요약
| 파일 | 변경 내용 |
|------|-----------|
| `app/utils/notification.ts` | MODIFY — `'cancellation'`, `'message'` 타입 추가 |
| `app/api/notifications/email/route.ts` | MODIFY — 단건 sendMail try/catch 격리, 이메일 실패 시 성공 응답 보장 |
| `app/context/NotificationContext.tsx` | MODIFY — Channel B(inquiry_messages) 제거, markAsRead 가드 제거, 토스트 타입 자동 감지 |
| `app/notifications/page.tsx` | MODIFY — getIcon() service_* 타입 명시 매핑 추가 |

---

## v3.10.0 — SEO/OG 메타데이터 최적화

**작업일:** 2026-03-02

### 개요
서비스 매칭(`services/*`) 페이지 전체를 구글 검색 및 소셜 공유(카카오톡 썸네일)에 최적화.

### 변경 내용

#### `app/layout.tsx`
- `metadataBase` 추가 (`NEXT_PUBLIC_SITE_URL` 환경변수 기반, fallback: `https://locally.vercel.app`)
  → 하위 페이지의 상대 경로 OG 이미지 URL이 absolute로 올바르게 해석됨
- `keywords` 에 서비스 관련 키워드 추가: `일본 동행`, `일본 현지 가이드`, `맞춤 의뢰`

#### `app/services/intro/` — Server Wrapper 패턴 적용
- **기존 `page.tsx`** → `IntroClient.tsx`로 이름 변경 (내용 무변경)
- **신규 `page.tsx`** (Server Component): 정적 `metadata` export 추가
  - Title: `일본 현지인 동행 가이드 맞춤 의뢰 | Locally`
  - Description: `도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.`
  - OG/Twitter 카드 포함, keywords 7개
  - OG 이미지: `NEXT_PUBLIC_SERVICE_OG_IMAGE` 환경변수 우선, 없으면 일본 Unsplash 이미지 fallback

#### `app/services/[requestId]/` — Server Wrapper 패턴 적용
- **기존 `page.tsx`** → `ServiceRequestClient.tsx`로 이름 변경 (내용 무변경)
- **신규 `page.tsx`** (Server Component): `generateMetadata` 동적 생성 추가
  - `service_requests` 테이블에서 `title, city, service_date, duration_hours, guest_count` 조회
  - Title: `[의뢰 제목] — 현지 호스트 모집 중 | Locally`
  - Description: `📍 [city] · 📅 [service_date] · ⏱ [n]시간 · 👥 [n]명. 현지인 호스트의 지원을 기다리고 있어요.`
  - OG 이미지: `NEXT_PUBLIC_SERVICE_OG_IMAGE` 환경변수 우선, 없으면 사이트 대표 이미지 fallback (에러 없음 보장)

### 파일 요약
| 파일 | 액션 |
|------|------|
| `app/layout.tsx` | MODIFY — metadataBase 추가 + keywords 보강 |
| `app/services/intro/IntroClient.tsx` | NEW — 기존 page.tsx 내용 이동 (로직 무변경) |
| `app/services/intro/page.tsx` | MODIFY — 서버 래퍼로 교체, 정적 metadata export |
| `app/services/[requestId]/ServiceRequestClient.tsx` | NEW — 기존 page.tsx 내용 이동 (로직 무변경) |
| `app/services/[requestId]/page.tsx` | MODIFY — 서버 래퍼로 교체, generateMetadata 추가 |

---

## v3.3.1 — 버그 수정 이력

**수정일:** 2026-03-01

### [Bug 1 - CRITICAL] 수수료 마진 유출 수정
- **현상:** 호스트 계정으로 잡보드, 의뢰 상세 접속 시 고객 결제 금액(`total_customer_price`)이 노출.
- **수정:**
  - `app/services/page.tsx`: 잡보드 카드 금액 표시를 `total_host_payout`(예상 수입)으로 교체, 라벨/색상 구분
  - `app/services/[requestId]/page.tsx`: 의뢰 상세 금액 블록을 `isOwner` 분기로 엄격 분리 — 고객에게만 총 금액, 호스트에게는 예상 수입만 노출
  - `app/types/service.ts`: `ServiceRequestCard`에 `total_host_payout`, `user_id` 필드 추가
  - `app/api/services/requests/route.ts`: API select 쿼리에 두 필드 추가

### [Bug 2 - DATA] 고객 화면 지원자 리스트 0명 표기 수정
- **현상:** 호스트가 지원 완료 후에도 고객의 의뢰 상세에 "지원한 호스트 (0명)" 표기.
- **근본 원인:** 클라이언트 SDK의 `service_applications` nested join 쿼리가 Supabase RLS 정책에 의해 차단되어 빈 배열 반환.
- **수정:**
  - `app/api/services/applications/route.ts`: `GET` 핸들러 신규 추가 — `service_role` 클라이언트로 RLS 우회, 의뢰 소유자에게는 전체 지원자 + `profiles`/`host_applications` 2단계 조인 반환
  - `app/services/[requestId]/page.tsx`: 클라이언트 직접 조회에서 서버 API 호출로 전환

### [Bug 3 - UX] 호스트 '지원 완료' 상태 렌더링 누락 수정
- **현상:** 호스트가 지원 후 같은 의뢰 상세에 재접속해도 "지원하기" 버튼이 계속 표시됨.
- **근본 원인:** `myApplication` 도출이 `applications` 배열에서만 이루어졌는데, Bug 2로 인해 `applications`가 비어있어 `myApplication`이 항상 `undefined`.
- **수정:**
  - `app/services/[requestId]/page.tsx`: `myApplication`을 독립 state로 분리, `/api/services/applications?requestId=...` GET 호출 시 `myApplication` 직접 반환

### [Bug 4 - UX] 고객(게스트) 진입점 누락 수정
- **현상:** 고객이 의뢰 등록 후 "내 맞춤 의뢰" 목록으로 이동하는 메뉴가 어디에도 없음.
- **수정:**
  - `app/account/page.tsx` 모바일/데스크탑: "내 맞춤 의뢰" → `/services/my` 항목 추가
  - **v3.4.0에서 진입점이 '나의 여행' 페이지로 이동됨 (하단 참고)**

---

## v3.4.0 — UX 개선 이력

**수정일:** 2026-03-01

### [메뉴 재배치] '내 맞춤 의뢰' 진입점 이동
- **이전:** `app/account/page.tsx`(계정/프로필 관리) 내에 위치
- **현재:** `app/guest/trips/page.tsx`(나의 여행 페이지) 하단 "나의 맞춤 의뢰" 섹션으로 통합
  - 최대 5건 미리보기 + "전체 보기" 링크 → `/services/my`
- **account 페이지 정리:** 잘못 추가되었던 모바일 메뉴 아이템, 데스크탑 링크 카드 모두 제거

### [랜딩 페이지 신설] 서비스 소개 페이지 `/services/intro`
- **신규 파일:** `app/services/intro/page.tsx`
- **라우팅 변경:** 홈 화면 5번째 서비스 카드 클릭 시 `/services/request` → `/services/intro`로 변경

### [알림 강화] 서비스 N 배지 시스템 구현
- **호스트 데스크탑:** `app/host/dashboard/page.tsx` — "서비스 매칭" 사이드바 버튼 우측 빨간 점 표시
- **호스트 모바일:** `app/components/mobile/MobileHostMenu.tsx` — "서비스 매칭" 항목 빨간 점 표시
- **고객:** `app/guest/trips/page.tsx` — "나의 맞춤 의뢰" 섹션 제목 옆 빨간 점 표시

### 파일 변경 요약
| 변경 | 파일 |
|---|---|
| [NEW] 서비스 소개 페이지 | `app/services/intro/page.tsx` |
| [MODIFY] 홈 카드 라우팅 변경 | `app/components/HomePageClient.tsx` |
| [MODIFY] 맞춤 의뢰 섹션 + N 배지 추가 | `app/guest/trips/page.tsx` |
| [MODIFY] 서비스 탭 N 배지 (데스크탑) | `app/host/dashboard/page.tsx` |
| [MODIFY] 서비스 탭 N 배지 (모바일) | `app/components/mobile/MobileHostMenu.tsx` |
| [MODIFY] 잘못 추가된 계정 페이지 진입점 제거 | `app/account/page.tsx` |

---

## v3.5.0 — UI/UX 프리미엄 전면 개편

**수정일:** 2026-03-01

### [나의 여행 페이지] 섹션 순서 변경
- 모바일/데스크탑 모두 "나의 맞춤 의뢰" 섹션 → 최상단 배치, 일반 예약 하단

### [서비스 상세 페이지] 에어비앤비 스타일 전면 재설계
- **변경 파일:** `app/services/[requestId]/page.tsx` (전면 재작성)
- 매칭 프로세스 스텝 바, 2×2 아이콘 그리드, LinkedIn 스타일 지원자 카드, 그라디언트 CTA 버튼 추가

### [의뢰 목록 & 잡보드] 카드 UI 개선
- 2섹션 카드 구조, 상태 칩 강화, 금액 강화, 언어 메타, 회색 배경, hover 애니메이션
- **변경 파일:** `app/services/page.tsx`, `app/services/my/page.tsx`

### 파일 변경 요약
| 변경 | 파일 |
|---|---|
| [MODIFY] 맞춤 의뢰 섹션 최상단 배치 | `app/guest/trips/page.tsx` |
| [MODIFY] 상세 페이지 전면 재설계 | `app/services/[requestId]/page.tsx` |
| [MODIFY] 잡보드 카드 UI 개선 | `app/services/page.tsx` |
| [MODIFY] 내 의뢰 목록 카드 UI 개선 | `app/services/my/page.tsx` |

---

## v3.6.0 — 서비스 소개 페이지 에어비앤비 스타일 재설계

**수정일:** 2026-03-01

- **변경 파일:** `app/services/intro/page.tsx` 전면 재작성
- 다크 그라디언트 히어로, 아이콘 그리드, 후기 카드, 데스크탑 sticky 가격 카드, 모바일 하단 고정 바
- **비용:** 시간당 ₩35,000 / 최소 4시간 기준 ₩140,000~
- **대상 지역:** 도쿄, 오사카, 후쿠오카

---

## v3.7.0 — 서비스 소개 페이지 체험 상세 UI 복제

**수정일:** 2026-03-01

### [서비스 소개] 체험 상세 UI 이식
- **변경 파일:** `app/services/intro/page.tsx`
- `app/experiences/[id]/page.tsx`의 레이아웃 구조(사진 갤러리, 헤더/호스트 바, 아이콘 그리드) 복제

### [폼 연동] 예약 바 → 의뢰 정보 수집 연동
- 데스크탑 사이드바: 날짜/시작 시간/이용 시간/인원수 선택 폼
- Query String 라우팅: `/services/request?date=...&startTime=...`으로 전달

### [폼 연동] 의뢰 등록 폼 데이터 Hydration
- **변경 파일:** `app/services/request/page.tsx`
- `useSearchParams`로 intro에서 전달된 파라미터를 초기값으로 자동 매핑

### v3.7.1 Hotfix — 폼 UI 모던화 및 30분 단위 선택
- 날짜 선택: 네이티브 `input type="date"` → 커스텀 달력 UI로 교체
- 시간 선택: 오전 8시~오후 8시 30분 간격 `<select>`로 교체

---

## 누적 상태 정합성 패치 이력 (v3.x P0/P1 시리즈)

> 아래는 booking 상태 상수 통일, Admin 집계 정합성, UI 회귀 수정 등 다수의 핀셋 패치 이력이다.

- 예약 상태 단일화(P1-2): `bookingStatus` 공통 상수에 대소문자 무관 판정 유틸 추가
- Admin 장부/분석 정합성(P1-2): `MasterLedgerTab`, `AnalyticsTab` 하드코딩 상태 배열을 공통 상수 기반으로 전환
- Guest Trips 분류 안정화(P1-2): `useGuestTrips`, `TripCard` 취소/완료 분기를 공통 취소 상태 집합 기준으로 통일
- 예약 상태 유틸 확장(P1-3): `pending/cancellation_requested/completed/cancelled` 전용 판정 유틸 추가
- Admin 매출 탭 정합성(P1-3): `SalesTab` 유효 매출/정산 대상/CSV/상태 뱃지 분기를 공통 상태 유틸로 정렬
- Host 예약 관리 정합성(P1-3): `ReservationManager`, `ReservationCard` 취소요청/취소완료/입금대기 분기를 공통 상태 유틸로 통일
- Admin 정산 실행 정합성(P1-4): `SettlementTab` 상세 유형 분기를 공통 취소 상태 유틸로 통일
- Host 수익 계산 정합성(P1-4): `Earnings` 취소 예약 제외/포함 판단을 공통 유틸 기반으로 정렬
- 결제 취소 API 가드 보강(P1-4): `/api/payment/cancel` "이미 취소됨" 판정을 공통 상태 유틸로 전환
- Admin 정산 조회 필터 보강(P1-5): `SettlementTab` Supabase `.or(...)` 조건을 공통 상태 유틸 기반 필터로 전환
- Admin 장부 Pending 분기 통일(P1-5): `MasterLedgerTab` `PENDING` 직접 비교를 `isPendingBookingStatus`로 치환
- 결제 완료/성공 상태 분기 통일(P1-6): `payment/complete`, `payment/success` 상태 분기를 공통 상태 유틸로 전환
- 결제 좌석 점검 상태 집합 통일(P1-7): `BOOKING_PENDING_STATUSES`, `BOOKING_BLOCKING_STATUSES_FOR_CAPACITY` 상수 추가
- 전역 폰트 로컬 전환(P1-8): `next/font/local` 기반으로 전환, Google Font 의존 제거 (Inter + IBM Plex Sans KR)
- 데스크탑 호스트 전환 회귀 수정(P1-9): `SiteHeader` 드롭다운 호스트 전환 목적지를 `/host/dashboard?tab=reservations`로 복원
- 모바일 언어 전환 진입점 확장(P1-10): 홈 상단, 게스트 계정 헤더, 호스트 메뉴 헤더에 언어 스위처 추가
- 안정성: `.single()` → `.maybeSingle()` 전환, BottomTabNavigation z-index 정리
- 프로필 스키마 정합성(P0): 실DB에 없는 `role/name/is_admin/school` 직접 쿼리 제거
- 호스트 예약 조회 핫픽스(P0): `profiles.school` select 제거 (42703 에러 방지)
- 인증 세션 고정(P0): Supabase 클라이언트 싱글턴, `getUser()` 기반 전환
- OAuth 프로필 동기화 보강(P0): `/auth/callback` 코드 교환 직후 프로필 동기화
- Admin 맞춤 의뢰 관리 통합(v3.9.0): SERVICE_REQUESTS 탭 신설, useServiceAdminData, ServiceAdminTab, /api/admin/service-cancel
- 맞춤 의뢰 무통장 입금 UI 추가(v3.9.1): 결제 수단 선택 UI, complete 페이지 method=bank 분기
- 맞춤 의뢰 무통장 백엔드 연동(v3.9.2): mark-bank API, service-confirm-payment API, ServiceAdminTab 입금 확인 버튼
  - `app/account/page.tsx`
  - `app/components/mobile/MobileProfileView.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
