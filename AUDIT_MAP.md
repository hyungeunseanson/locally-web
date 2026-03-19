# 🗺️ LOCALLY 전수 점검 전략 지도 (AUDIT_MAP)

> **목적**: 로컬리 서비스의 안정적 런칭을 위한 코드 전수 조사 및 결함 수정
>
> **협업 구조**
> - 총괄 PM: **Claude 4.6** — 전략 수립, 우선순위 결정, 수정 실행
> - 기술 감사관: **Codex 5.4 xhigh** — 도메인별 정밀 정적 분석, 버그 탐색
> - 운영 방식: Codex에게 도메인 단위로 파일 목록 + 점검 포인트를 전달 → 병렬 분석 후 결과 보고 → Claude가 수정 실행
>
> **생성일**: 2026-03-19 | **상태**: 점검 대기 중
> **스캔 제외**: `node_modules/`, `.next/`, `.git/`, `.vscode/`, `app/fonts/`

## 📜 운영 원칙 및 작업 가이드 (Operational Principles)

1. **[Context First]** 모든 도메인의 코드 수정 시작 전, 코덱스는 프로젝트 루트의 `gemini.md`를 필독하여 최신 컨텍스트와 기존에 학습된 주의 사항을 반드시 숙지한다.
2. **[Pinpoint Fix]** 불필요한 대규모 리팩토링을 지양한다. 결함이 발견된 지점만 정확히 타격하는 **'핀셋 수정'**을 원칙으로 하여 사이드 이펙트를 최소화한다.
3. **[Zero Regression]** 수정 후 기존 기능이 망가지는 '회귀'를 절대 금지한다. 수정 전후의 로직 변화를 코덱스와 이중 검증하여 안정성을 확보한다.
4. **[Completion Protocol]** 도메인별 작업 완료 후에는 반드시 다음 절차를 수행한다:
   - `git push`를 통해 코드를 즉시 동기화한다.
   - `CHANGELOG.md`에 수정된 파일 목록과 해결된 이슈를 상세히 기록한다.
   - `AUDIT_MAP.md`의 진행 상태(`- [ ]` -> `- [x]`)를 업데이트한다.
---

## 📊 도메인 분류 요약

| # | 도메인 | 핵심 리스크 | 파일 수 |
|---|--------|-----------|--------|
| D-01 | Auth & Session | 세션 누수, OAuth 콜백 버그 | 5 |
| D-02 | Guest Flow | 예약 상태 관리, 취소 로직 | 22 |
| D-03 | Host Flow | 체험 등록/관리, 대시보드 | 24 |
| D-04 | Payment Engine | 이중결제, 콜백 검증 누락 | 14 |
| D-05 | Service Marketplace | 매칭 로직, 정산 | 18 |
| D-06 | Proxy Bookings | 전화대행 흐름 완결성 | 7 |
| D-07 | Notification System | 중복 발송, 미발송 케이스 | 10 |
| D-08 | Admin CMS | 권한 검증, 데이터 무결성 | 32 |
| D-09 | Community | XSS, 익명성 처리 | 18 |
| D-10 | Core Infrastructure | Supabase 클라이언트, 타입 안전성 | 20 |
| D-11 | SEO & Public Pages | 메타데이터, OG 이미지 | 10 |
| D-12 | Cron & Automation | 자동화 작업 실패 처리 | 5 |

---

## D-01: Auth & Session

> **핵심 리스크**: 로그인 후 자동 로그아웃, OAuth 프로필 미동기화, 세션 중복

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [x] | `app/auth/callback/route.ts` | OAuth 콜백 처리, 코드 교환 후 프로필 동기화 | ✅ 수정완료: `next` 파라미터 오픈 리다이렉트 차단 (상대경로 검증) |
| - [x] | `app/context/AuthContext.tsx` | 전역 auth 상태, 세션 갱신 로직 | ✅ 감사완료: getUser() 사용 확인, 구독 cleanup 정상. 로그아웃 race는 low-risk |
| - [x] | `app/utils/supabase/client.ts` | 브라우저용 Supabase 클라이언트 싱글턴 | ✅ 수정완료: `https://missing.com` 위험 fallback 제거 → 명시적 에러 throw |
| - [x] | `app/utils/supabase/server.ts` | 서버용 Supabase 클라이언트 (cookies) | ✅ 감사완료: cookies() await 정상, cookie write 에러 swallow는 low-risk |
| - [x] | `app/utils/supabase/middleware.ts` | 미들웨어 세션 갱신 | ✅ 감사완료: 리디렉션 루프 없음, 보호경로 게이트는 미들웨어 아닌 각 페이지에서 처리 |

---

## D-02: Guest Flow

> **핵심 리스크**: 예약 상태 불일치, 결제 후 상태 미전환, 취소 환불 계산 오류

### 2-1. 체험 탐색 & 검색

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/components/HomePageClient.tsx` | 홈화면 체험 목록, 필터링 | stale closure 버그, 언어 변경 시 리렌더 최적화 |
| - [ ] | `app/hooks/useExperienceFilter.ts` | 체험 필터 상태 관리 | `applyFilters` locationOverride 파라미터 안전성, 디바운스 누락 |
| - [ ] | `app/api/search/experiences/route.ts` | 체험 검색 API | SQL 인젝션 방어, 페이지네이션 경계값 처리 |
| - [ ] | `app/search/page.tsx` | 검색 결과 페이지 | SSR/CSR 하이드레이션 불일치 가능성 |
| - [ ] | `app/search/components/SearchFilter.tsx` | 검색 필터 UI | 필터 초기화 시 상태 잔류 버그 |

### 2-2. 체험 상세 & 예약

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/experiences/[id]/page.tsx` | 체험 상세 서버 컴포넌트 | 존재하지 않는 ID 접근 시 404 처리, revalidatePath 적용 여부 |
| - [ ] | `app/experiences/[id]/ExperienceClient.tsx` | 체험 상세 클라이언트 | 슬롯 선택 상태 관리, sold_out 날짜 표시 로직 |
| - [ ] | `app/experiences/[id]/components/ReservationCard.tsx` | 예약 카드 (사이드바) | 인원 검증, 날짜 미선택 시 제출 방어 |
| - [ ] | `app/experiences/[id]/components/ExpSidebar.tsx` | 데스크탑 사이드바 | 가격 계산 일관성, solo guarantee 조건 |
| - [ ] | `app/experiences/[id]/components/StickyActionSheet.tsx` | 모바일 하단 예약 버튼 | z-index 충돌, 스크롤 시 sticky 동작 |
| - [x] | `app/api/bookings/route.ts` | 예약 생성 API | ✅ 수정완료: paymentMethod allowlist 검증 추가; solo-guarantee TOCTOU pre-check 제거(RPC atomic 처리에 위임) |
| - [x] | `app/utils/experienceAvailability.ts` | 예약 가능 여부 공통 로직 | ✅ 수정완료: .gte('date', today) 필터 추가 — 과거 슬롯이 예약 가능으로 표시되는 버그 수정 |

### 2-3. 결제

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [x] | `app/experiences/[id]/payment/page.tsx` | 결제 페이지 | ✅ 수정완료: 클라이언트 용량 체크 BLOCKING→ACTIVE (PENDING 포함 시 false "자리 없음" 버그 수정) |
| - [x] | `app/experiences/[id]/payment/complete/page.tsx` | 결제 완료 페이지 | ✅ 수정완료: CRITICAL — 본인 예약 소유권 검증(.eq user_id) 추가; analytics 확정상태 게이팅; 취소/거절 예약 별도 UI 분기 |
| - [x] | `app/payment/success/page.tsx` | 무통장 결제 성공 페이지 | ✅ 수정완료: getUser() + .eq('user_id') 추가 — 비인증 방문자 orderId 탐지 방지 |

### 2-4. 여행 목록 & 취소

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/guest/trips/page.tsx` | 게스트 여행 목록 | 예약 상태별 필터링 정확성 |
| - [ ] | `app/guest/trips/hooks/useGuestTrips.ts` | 여행 데이터 훅 | 캐시 무효화 타이밍, 완료 동기화 |
| - [ ] | `app/guest/trips/components/CancellationModal.tsx` | 취소 모달 | 취소 사유 필수값 검증, 환불 금액 표시 |
| - [ ] | `app/guest/trips/components/ReceiptModal.tsx` | 영수증 모달 | 금액 포맷, 통화 표시 |
| - [ ] | `app/api/guest/trips/route.ts` | 게스트 여행 조회 API | 본인 예약만 조회 권한 검증 |
| - [x] | `app/utils/bookingFinance.ts` | 예약 금액 계산 유틸 | ✅ 수정완료: totalExperienceAmount를 totalPaidAmount로 clamp — 레거시 데이터에서 hostPayout 오버플로 방지 |

---

## D-03: Host Flow

> **핵심 리스크**: 호스트 신청 승인 흐름, 체험 편집 시 데이터 손실, 수익 정산 오류

### 3-1. 호스트 신청

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/host/register/page.tsx` | 호스트 신청 페이지 | 중복 신청 방어 |
| - [ ] | `app/host/register/components/HostRegisterForm.tsx` | 신청 폼 | 파일 업로드 크기/형식 검증, 언어레벨 이중구조 처리 |
| - [x] | `app/api/host/register/submit/route.ts` | 신청 제출 API | ✅ 수정완료: approved 호스트 재제출 데이터 덮어쓰기 방어; insert .single()→.maybeSingle(). 동시 중복 삽입은 DB unique constraint 필요 — known risk |
| - [ ] | `app/api/host/register/admin-alert/route.ts` | 신청 어드민 알림 | 알림 중복 발송 방어 |

### 3-2. 체험 생성/편집

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/host/create/page.tsx` | 체험 생성 페이지 | 인증 guard, 호스트 권한 검증 |
| - [ ] | `app/host/create/components/ExperienceFormSteps.tsx` | 다단계 폼 | 단계 이탈 시 데이터 보존, 이미지 업로드 실패 처리 |
| - [ ] | `app/host/create/experienceFormState.ts` | 폼 상태 관리 | 초기값 누락 필드, 타입 불일치 |
| - [ ] | `app/host/experiences/[id]/edit/page.tsx` | 체험 수정 페이지 | 수정 권한(본인 체험만), 부분 업데이트 안전성 |
| - [ ] | `app/host/experiences/[id]/dates/page.tsx` | 날짜/슬롯 관리 | 이미 예약된 슬롯 삭제 방어 |
| - [ ] | `app/api/host/experiences/route.ts` | 체험 목록 조회/생성 | 호스트 본인 체험만 반환 검증 |
| - [x] | `app/api/host/experiences/[id]/route.ts` | 체험 수정/삭제 | ✅ 수정완료: DELETE 전 활성 예약 존재 시 409 차단 |
| - [x] | `app/api/host/experiences/[id]/availability/route.ts` | 가용 슬롯 관리 | ✅ 수정완료: insert→upsert(ignoreDuplicates) 동시 슬롯 중복 삽입 방어. TOCTOU 삭제 race는 RPC 없이 해결 불가 → 알려진 리스크로 기록 |
| - [x] | `app/api/host/experiences/shared.ts` | 체험 공통 유틸 | ✅ 수정완료: CRITICAL — updateQuery 재할당 버그 수정 (호스트 소유권 필터 미적용) |

### 3-3. 호스트 대시보드

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/host/dashboard/page.tsx` | 대시보드 진입점 | 탭별 lazy loading, 초기 데이터 패칭 오류 처리 |
| - [ ] | `app/host/dashboard/components/ReservationManager.tsx` | 예약 관리 | 예약 상태 전환 버튼 권한, 낙관적 업데이트 롤백 |
| - [ ] | `app/host/dashboard/components/ReservationCard.tsx` | 예약 카드 | 게스트 이름 표시 버그 (이슈 보고됨) |
| - [x] | `app/host/dashboard/components/GuestProfileModal.tsx` | 게스트 프로필 모달 | ✅ 수정완료: profiles.school 없음 확인 완료; guest_reviews 에러 무시 수정; supabase useRef 안정화로 반복 재요청 버그 수정 |
| - [ ] | `app/host/dashboard/Earnings.tsx` | 수익 현황 | 정산 금액 계산, 통화 변환 |
| - [ ] | `app/host/dashboard/InquiryChat.tsx` | 문의 채팅 | 실시간 구독 메모리 누수, 읽음 처리 |
| - [ ] | `app/host/dashboard/MyExperiences.tsx` | 내 체험 목록 | 체험 상태(활성/비활성) 토글 |
| - [ ] | `app/api/host/profile/route.ts` | 호스트 프로필 조회/수정 | 본인 프로필만 수정 권한 |
| - [x] | `app/api/host/guest-reviews/route.ts` | 호스트가 게스트에게 쓰는 후기 | ✅ 수정완료: CRITICAL — booking.status==='completed' guard 추가; 23505 중복 삽입 방어 |
| - [x] | `app/api/host/reviews/reply/route.ts` | 후기 답글 | ✅ 수정완료: UPDATE에 .eq('experience_id') TOCTOU 방어 추가 |

---

## D-04: Payment Engine

> **핵심 리스크**: 이중결제, 결제 콜백 서명 검증 누락, 환불 금액 오차, 무통장 중복 확인

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [x] | `app/api/payment/nicepay-callback/route.ts` | NicePay 카드 결제 콜백 | ✅ 수정완료: `.eq('status','PENDING')` 조건부 UPDATE로 race condition 방지, 멱등성 응답 추가 |
| - [x] | `app/api/payment/card-ready/route.ts` | 카드 결제 준비 | ✅ 감사완료: 금액 미포함 라우트, 보안 상태 노출 low-risk |
| - [x] | `app/api/payment/paypal/create-order/route.ts` | PayPal 주문 생성 | ✅ 감사완료: 금액 DB에서 조회, 중복 주문 생성 가능하나 capture 단계에서 차단됨 |
| - [x] | `app/api/payment/paypal/capture-order/route.ts` | PayPal 결제 캡처 | ✅ 수정완료: `.eq('status','PENDING')` 조건부 UPDATE로 중복 캡처 DB 반영 차단 |
| - [x] | `app/api/payment/cancel/route.ts` | 결제 취소/환불 | ✅ 수정완료: CRITICAL — isCancelledBookingStatus로 교체(declined/cancellation_requested 차단); isHostCancel guard를 lock 전으로 이동; PG 실패 시 rollback; SSRF 위험 fetch→direct email; profiles.full_name; createAdminClient() |
| - [x] | `app/api/bookings/confirm-payment/route.ts` | 무통장 입금 확인 (호스트) | ✅ 수정완료: CAS 조건부 UPDATE; payment_method!='bank' guard 추가; 非pending→409 반환; 이메일 호출 개별 try/catch 분리; bookingId 타입 검증 |
| - [x] | `app/api/admin/bookings/confirm-payment/route.ts` | 무통장 어드민 확인 | ✅ 수정완료: CAS 조건부 UPDATE; bookingId 타입 검증; experience null guard; recordAuditLog 독립 try/catch 분리 |
| - [x] | `app/utils/paypal/server.ts` | PayPal 서버 유틸 | ✅ 수정완료: capture/refund에 `PayPal-Request-Id` 멱등성 헤더 추가 |
| - [x] | `app/utils/portone/server.ts` | PortOne/NicePay 서버 유틸 | ✅ 감사완료: 서버사이드 금액 검증 정상 |
| - [x] | `app/utils/bookingFinance.ts` | 결제 금액 계산 | ✅ 감사완료: Math.floor 다단계 1~2원 오차 허용 범위 (KRW 특성상 무시 가능) |

### Services 결제 (별도)

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [x] | `app/api/services/payment/nicepay-callback/route.ts` | 서비스 NicePay 콜백 | ✅ 수정완료: `.eq('status','PENDING')` 조건부 UPDATE + 멱등성 응답 |
| - [x] | `app/api/services/payment/paypal/capture-order/route.ts` | 서비스 PayPal 캡처 | ✅ 수정완료: 동일 CAS 패턴 적용 |
| - [x] | `app/api/services/payment/mark-bank/route.ts` | 서비스 무통장 처리 | ✅ 수정완료: status 대소문자 정규화; UPDATE에 customer_id + status + payment_method IS NULL 추가 (atomic race guard) |
| - [x] | `app/api/admin/service-confirm-payment/route.ts` | 서비스 어드민 결제 확인 | ✅ 수정완료: 조건부 UPDATE + 멱등성 응답 |

---

## D-05: Service Marketplace

> **핵심 리스크**: 호스트 선정 로직, 서비스 상태 전환, 정산 처리

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/services/page.tsx` | 서비스 게시판 목록 | 로그인 없이 접근 가능 범위 |
| - [ ] | `app/services/ServiceJobBoardClient.tsx` | 서비스 게시판 클라이언트 | 필터/정렬 상태 관리 |
| - [ ] | `app/services/request/page.tsx` | 서비스 요청 작성 | 입력값 검증, 파일 업로드 |
| - [ ] | `app/services/[requestId]/page.tsx` | 서비스 요청 상세 | 권한별 표시 분기 (요청자/지원자/어드민) |
| - [ ] | `app/services/[requestId]/ServiceRequestClient.tsx` | 서비스 상세 클라이언트 | 상태 전환 버튼 조건 로직 |
| - [ ] | `app/services/[requestId]/apply/page.tsx` | 호스트 지원 페이지 | 중복 지원 방어, 지원 마감 처리 |
| - [ ] | `app/services/[requestId]/payment/page.tsx` | 서비스 결제 | 선정된 호스트만 결제 진행 가능 여부 |
| - [ ] | `app/services/my/page.tsx` | 내 서비스 요청 목록 | 본인 요청만 표시 권한 |
| - [x] | `app/api/services/requests/route.ts` | 서비스 요청 생성/조회 | ✅ 수정완료: duration/guest 상한 추가; requestId GET 401 guard 추가 |
| - [x] | `app/api/services/applications/route.ts` | 지원 생성/조회 | ✅ 수정완료: 23505→409, appeal_message 2000자 제한, createAdminClient() 마이그레이션 |
| - [x] | `app/api/services/select-host/route.ts` | 호스트 선정 | ✅ 수정완료: CRITICAL — RPC missing 시 503 반환, 비원자적 폴백 차단 |
| - [x] | `app/api/services/bookings/route.ts` | 서비스 예약 생성 | ✅ 수정완료: contact 입력값 검증(이름 100자/전화번호 regex), createAdminClient() 마이그레이션 |
| - [x] | `app/api/services/cancel/route.ts` | 서비스 취소 | ✅ 수정완료: PAID+open 경로에 atomic lock (status→cancellation_requested) |
| - [x] | `app/api/services/start-chat/route.ts` | 서비스 채팅 시작 | ✅ 수정완료: requestId 타입 검증 (undefined 시 무관한 thread 매칭 방지) |
| - [ ] | `app/utils/serviceNotificationFlows.ts` | 서비스 알림 흐름 | 모든 상태전환에 알림 누락 없는지 |
| - [ ] | `app/utils/serviceHostNotifications.ts` | 서비스 호스트 알림 | 중복 발송 방어 |
| - [ ] | `app/utils/serviceRequestLocation.ts` | 서비스 위치 유틸 | 지역 코드 정규화 |
| - [ ] | `app/types/service.ts` | 서비스 타입 정의 | 상태 유니온 타입 완결성 |

---

## D-06: Proxy Bookings (전화대행 예약)

> **핵심 리스크**: 댓글 알림 흐름, 상태 전환 완결성

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/proxy-bookings/page.tsx` | 전화대행 목록 | 권한 분기 (어드민/호스트) |
| - [ ] | `app/proxy-bookings/new/page.tsx` | 전화대행 생성 | 어드민 전용 접근 제한 |
| - [ ] | `app/proxy-bookings/[id]/page.tsx` | 전화대행 상세 | 댓글 로딩, 상태 표시 |
| - [x] | `app/api/proxy-bookings/route.ts` | 전화대행 생성/조회 API | ✅ 수정완료: profiles.name → full_name (42703 에러 방지) |
| - [x] | `app/api/proxy-bookings/[id]/route.ts` | 전화대행 상세/수정 | ✅ 수정완료: .single()→.maybeSingle(); admin PATCH에 status/payment_status allowlist 추가 |
| - [x] | `app/api/proxy-bookings/[id]/comments/route.ts` | 댓글 CRUD | ✅ 수정완료: 5000자 max length guard; profiles.name→full_name |
| - [ ] | `app/schemas/proxyRequestSchema.ts` | 전화대행 입력 스키마 | Zod 검증 완결성 |

---

## D-07: Notification System

> **핵심 리스크**: 중복 발송, 미발송, 알림 생성자 포함 버그

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/context/NotificationContext.tsx` | 알림 전역 상태 | 실시간 구독 메모리 누수, unread count 정확성 |
| - [ ] | `app/notifications/page.tsx` | 알림 센터 페이지 | 읽음 처리 타이밍, 알림 타입별 라우팅 |
| - [ ] | `app/host/notifications/page.tsx` | 호스트 알림 페이지 | 동일 컴포넌트 re-export 여부 확인 |
| - [x] | `app/api/notifications/read/route.ts` | 읽음 처리 API | ✅ 확인완료: .eq('user_id', user.id) 소유권 체크 정상 |
| - [x] | `app/api/notifications/send-email/route.ts` | 이메일 발송 API | ✅ 수정완료: createAdminClient() 마이그레이션(×2); profiles.full_name 수정; listUsers()→profiles 조회로 교체; 알려진위험: x-internal-secret=SERVICE_ROLE_KEY 분리 필요(INTERNAL_API_SECRET env 추가 권장) |
| - [x] | `app/api/notifications/email/route.ts` | 이메일 라우트 (별도) | ✅ 수정완료: CRITICAL — new_booking 소유권 로직 수정(booking 행 기반 검증); DB insert 400 guard 순서 수정+실패 시 early return |
| - [x] | `app/utils/notification.ts` | 알림 생성 공통 유틸 | ✅ 확인완료: NotificationType 완결성 OK, 순수 fetch 래퍼 — 보안 이슈 없음 |
| - [x] | `app/utils/emailNotificationJobs.ts` | 이메일 발송 잡 | ✅ 수정완료: sendHtmlEmail 반환값 체크 — 발송 실패 시 sent:false 반환 |
| - [ ] | `app/utils/experienceNotificationFlows.ts` | 체험 알림 흐름 | 모든 예약 상태전환 커버리지 |
| - [x] | `app/utils/teamNotificationPolicy.ts` | 팀 알림 정책 | ✅ 수정완료: actorEmail 미확인 시 return true→false (fail-closed) — 이메일 불명 시 작성자 본인 수신 버그 수정 |

---

## D-08: Admin CMS

> **핵심 리스크**: 어드민 권한 검증 누락, 유저 삭제 연쇄 처리, 정산 계산 오류

### 8-1. 어드민 API

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/actions/admin.ts` | 서버액션 권한 처리 | admin_whitelist 검증 일관성 |
| - [ ] | `app/utils/adminAccess.ts` | 어드민 접근 유틸 | 권한 체크 함수 재사용 패턴 |
| - [ ] | `app/api/admin/bookings/route.ts` | 예약 전체 조회 | 권한 검증, 페이지네이션 |
| - [x] | `app/api/admin/bookings/force-cancel/route.ts` | 강제 취소 | ✅ 수정완료: 마커 UPDATE를 atomic CAS로 변환 (.not+maybeSingle), 동시 요청 이중환불 차단 |
| - [x] | `app/api/admin/delete/route.ts` | 유저 삭제 | ✅ 수정완료: 일반 삭제 경로에 ALLOWED_DELETE_TABLES 허용목록 추가 (임의 테이블 주입 차단) |
| - [x] | `app/api/admin/host-applications/route.ts` | 호스트 신청 관리 | ✅ 수정완료: caller 제공 ?select= 파라미터 제거 — 서버사이드 summarySelect/detailSelect만 사용 |
| - [ ] | `app/api/admin/master-ledger/route.ts` | 마스터 장부 | 금액 집계 쿼리 정확성 |
| - [ ] | `app/api/admin/sales-summary/route.ts` | 매출 요약 | 집계 기준 (결제 완료 기준 vs 체험 완료 기준) |
| - [ ] | `app/api/admin/reviews/route.ts` | 후기 관리 | 후기 삭제 시 평점 재계산 트리거 |
| - [ ] | `app/api/admin/reviews/[id]/route.ts` | 개별 후기 삭제 | 권한 검증 |
| - [ ] | `app/api/admin/users-summary/route.ts` | 유저 통계 | 집계 성능 (인덱스 활용) |
| - [ ] | `app/api/admin/users/[userId]/timeline/route.ts` | 유저 활동 타임라인 | 조회 범위 및 성능 |
| - [x] | `app/api/admin/service-cancel/route.ts` | 서비스 강제 취소 | ✅ 수정완료: HIGH — PAID 취소 전 atomic sentinel lock(cancellation_requested) 추가로 이중환불 차단; refund_amount 음수/초과 검증; PENDING 취소 에러 체크 추가 |
| - [x] | `app/api/admin/service-payouts/mark-paid/route.ts` | 정산 완료 처리 | ✅ 수정완료: `.eq('payout_status','pending')` 조건부 UPDATE로 이중 정산 방어 |

### 8-2. 어드민 팀 워크스페이스

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [x] | `app/api/admin/team/tasks/route.ts` | 팀 태스크 CRUD | ✅ 수정완료: content 5000자 길이 제한 추가 (POST) |
| - [x] | `app/api/admin/team/tasks/[id]/route.ts` | 개별 태스크 수정 | ✅ 수정완료: PATCH content 2000자 길이 제한 |
| - [x] | `app/api/admin/team/comments/route.ts` | 팀 댓글 CRUD | ✅ 수정완료: SSRF(https:// 강제), content 5000자 제한, emoji키 길이/개수 제한 |
| - [x] | `app/api/admin/team/comments/[id]/route.ts` | 개별 댓글 수정/삭제 | ✅ 수정완료: HIGH — author_id 소유권 검증(수평권한상승 방지); emoji 20개/user 100개 DoS 제한 |
| - [x] | `app/api/admin/team/whitelist/route.ts` | 팀 화이트리스트 | ✅ 수정완료: 이메일 형식 regex 검증 + 254자 상한 (인증 오판 방지) |
| - [ ] | `app/api/admin/team/_shared.ts` | 팀 공통 유틸 | 재사용 패턴 |
| - [x] | `app/api/admin/notify-team/route.ts` | 팀 전체 알림 | ✅ 수정완료: HIGH — admin 검증을 body 파싱 전으로 이동; title 200자/message 2000자 상한 |

### 8-3. 어드민 대시보드 UI

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/admin/dashboard/page.tsx` | 어드민 대시보드 | 권한 없는 접근 시 리디렉션 |
| - [ ] | `app/admin/dashboard/components/RealtimeBookings.tsx` | 실시간 예약 | Supabase Realtime 구독 누수 |
| - [ ] | `app/admin/dashboard/components/MasterLedgerTab.tsx` | 마스터 장부 탭 | 금액 표시 정확성 |
| - [ ] | `app/admin/dashboard/components/SettlementTab.tsx` | 정산 탭 | 미정산 항목 집계 |
| - [ ] | `app/admin/dashboard/components/UsersTab.tsx` | 유저 관리 탭 | 유저 삭제 전 확인 UX |
| - [ ] | `app/types/admin.ts` | 어드민 타입 정의 | 타입 완결성, any 사용 여부 |

---

## D-09: Community

> **핵심 리스크**: XSS 취약점, 익명 처리 일관성, 좋아요/조회수 중복

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/community/page.tsx` | 커뮤니티 메인 | SSR 캐시 전략 |
| - [ ] | `app/community/write/page.tsx` | 글 작성 페이지 | 로그인 guard, 이미지 업로드 검증 |
| - [x] | `app/community/write/PostEditor.tsx` | 에디터 컴포넌트 | ✅ 수정완료: title maxLength=200, content maxLength=10000 (UI 레이어 입력 제한); XSS — React text nodes 사용 확인(dangerouslySetInnerHTML 없음), 서버 sanitizeText() 적용 |
| - [ ] | `app/community/[id]/page.tsx` | 게시글 상세 | OG 메타데이터, 삭제된 글 처리 |
| - [x] | `app/community/components/CommentSection.tsx` | 댓글 섹션 | ✅ 확인완료: React text nodes 사용(XSS 없음), 대댓글 parent_id flattening으로 깊이 1 제한 |
| - [ ] | `app/community/components/LikeButton.tsx` | 좋아요 버튼 | 중복 좋아요 방어 (낙관적 업데이트 롤백) |
| - [ ] | `app/community/authorDisplay.ts` | 작성자 표시 유틸 | 익명 처리 일관성 |
| - [x] | `app/community/anonymousColumn.ts` | 익명 컬럼 처리 | ✅ 확인완료: 순수 에러 메시지 분류기, 사용자 데이터 미접촉; 댓글 GET에서 user_id 노출 — profiles.id로 대체 필요(프론트엔드 수정 필요, 알려진 위험으로 기록) |
| - [x] | `app/api/community/posts/route.ts` | 게시글 CRUD | ✅ 수정완료: sanitizeText() + title 200자/content 10000자 제한 추가 |
| - [x] | `app/api/community/comments/route.ts` | 댓글 CRUD | ✅ 수정완료: .single()→.maybeSingle()+null체크; sanitizeText() + 2000자 제한; GET user_id 노출 알려진 위험(profiles.id 대체 필요) |
| - [x] | `app/api/community/likes/route.ts` | 좋아요 | ✅ 수정완료: 23505→409 (동시 중복 삽입 시 500 방지) |
| - [x] | `app/api/community/views/route.ts` | 조회수 | ✅ 수정완료: UUID 형식 검증 추가; TOCTOU(view_count+1 race) — DB RPC 필요한 알려진 위험으로 기록 |
| - [x] | `app/api/community/comment-likes/route.ts` | 댓글 좋아요 | ✅ 수정완료: 23505→409 |
| - [x] | `app/api/bot/auto-post/route.ts` | 봇 자동 게시 | ✅ 수정완료: CRON_SECRET mandatory guard + 가짜 view_count 제거 |
| - [x] | `app/api/bot/auto-comment/route.ts` | 봇 자동 댓글 | ✅ 수정완료: CRON_SECRET mandatory guard + sanitizeText() 적용 |
| - [ ] | `app/utils/bot/ai.ts` | AI 봇 유틸 | API 키 노출 방어, 토큰 한도 처리 |
| - [x] | `app/utils/sanitize.ts` | HTML sanitize 유틸 | ✅ 수정완료: sanitizeUrl() return url.trim() 버그 수정 |
| - [ ] | `app/types/community.ts` | 커뮤니티 타입 | 타입 완결성 |

---

## D-10: Core Infrastructure

> **핵심 리스크**: Supabase 클라이언트 복수 인스턴스, 타입 any 남용, 환경변수 누락 처리

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/layout.tsx` | 루트 레이아웃 | Provider 중첩 순서, Suspense 경계 |
| - [ ] | `app/context/AuthContext.tsx` | 인증 전역 상태 | *(D-01에서 중복 점검)* |
| - [ ] | `app/context/LanguageContext.tsx` | 언어 전역 상태 | 초기 로케일 감지 로직, hydration mismatch |
| - [ ] | `app/context/NotificationContext.tsx` | 알림 전역 상태 | *(D-07에서 중복 점검)* |
| - [ ] | `app/context/ViewModeContext.tsx` | 게스트/호스트 뷰 모드 | 모드 전환 시 데이터 캐시 처리 |
| - [ ] | `app/context/SplashContext.tsx` | 스플래시 전역 상태 | showSplash 중복 호출 방어 |
| - [ ] | `app/context/ToastContext.tsx` | 토스트 알림 | 토스트 스택 최대 개수 제한 |
| - [ ] | `app/utils/supabase/client.ts` | 브라우저 클라이언트 | *(D-01에서 중복 점검)* |
| - [ ] | `app/utils/supabase/server.ts` | 서버 클라이언트 | *(D-01에서 중복 점검)* |
| - [ ] | `app/utils/supabase/admin.ts` | 서비스롤 클라이언트 | `SUPABASE_SERVICE_ROLE_KEY` 사용처 최소화 확인 |
| - [ ] | `app/utils/supabase/middleware.ts` | 미들웨어 | *(D-01에서 중복 점검)* |
| - [x] | `app/lib/supabase.ts` | 레거시 supabase 클라이언트 | ✅ 수정완료: ExperienceClient.tsx 유일 임포터 → utils/supabase/client로 마이그레이션 |
| - [ ] | `app/utils/contentHelper.ts` | i18n 콘텐츠 헬퍼 | 누락 번역 키 fallback 처리 |
| - [ ] | `app/utils/locale.ts` | 로케일 유틸 | 지원 언어 상수 관리 |
| - [ ] | `app/utils/siteUrl.ts` | 절대 URL 생성 | 환경변수 누락 시 fallback |
| - [ ] | `app/utils/image.ts` | 이미지 유틸 | Supabase Storage URL 생성, 만료 처리 |
| - [x] | `app/utils/profile.ts` | 프로필 유틸 | ✅ 수정완료: school 필드 타입/레이블에서 제거 (DB 미존재 컬럼) |
| - [ ] | `app/constants/bookingStatus.ts` | 예약 상태 상수 | 상태 유니온 완결성, 전체 사용처 일관성 |
| - [ ] | `app/types/index.ts` | 공통 타입 | any 타입 사용 빈도 |
| - [ ] | `app/types/proxy.ts` | 전화대행 타입 | 완결성 |

---

## D-11: SEO & Public Pages

> **핵심 리스크**: 메타데이터 누락, OG 이미지 오류, 크롤러 접근 차단

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [ ] | `app/opengraph-image.tsx` | 기본 OG 이미지 생성 | 로고 절대 URL 환경변수 처리 |
| - [ ] | `app/components/seo/JsonLd.tsx` | 구조화 데이터 | Schema.org 타입 정확성 |
| - [ ] | `app/utils/seo.ts` | SEO 유틸 | 메타 태그 생성 함수 완결성 |
| - [ ] | `app/utils/structuredData.ts` | 구조화 데이터 생성 | 체험 상세 JSON-LD 필수 필드 |
| - [ ] | `app/utils/publicMetadata.ts` | 공개 메타데이터 | 언어별 메타 태그 |
| - [ ] | `app/about/page.tsx` | 소개 페이지 | 메타데이터, 모바일 반응형 |
| - [ ] | `app/become-a-host/page.tsx` | 호스트 지원 랜딩 | CTA 버튼 동작, 리디렉션 |
| - [ ] | `app/help/page.tsx` | 고객센터 | 연락처 정보 최신화 |
| - [x] | `app/users/[id]/page.tsx` | 공개 유저 프로필 | ✅ 수정완료: select('*') → 명시적 안전 컬럼만 조회 (phone PII 노출 방지) |
| - [ ] | `app/[...rest]/` | catch-all 라우트 | 404 처리, 언어 프리픽스 처리 |

---

## D-12: Cron & Automation

> **핵심 리스크**: 크론 미인증 접근, 실패 시 재처리 누락

| 상태 | 파일 | 역할 | Codex 점검 포인트 |
|------|------|------|-----------------|
| - [x] | `app/api/cron/cancel-pending/route.ts` | PENDING 예약 자동 취소 | ✅ 수정완료: CRON_SECRET 필수화 (조건부→강제), UPDATE에 .eq('status','PENDING') guard 추가 |
| - [x] | `app/api/cron/complete-trips/route.ts` | 여행 완료 자동 처리 | ✅ 수정완료: CRON_SECRET 필수화, UPDATE에 .in('status', ACTIVE_STATUSES) guard 추가 |
| - [x] | `app/api/cron/experience-translations/route.ts` | 체험 자동 번역 | ✅ 수정완료: CRON_SECRET 필수화. lease/CAS/retry 로직 자체는 정상 (RPC 기반 atomic lease + translation_version guard) |
| - [x] | `app/api/guest/trips/sync-completed/route.ts` | 완료 여행 동기화 | ✅ 수정완료: UPDATE에 .in('status', BOOKING_ACTIVE_STATUS_FOR_CAPACITY) guard 추가 — 취소된 예약 completed 덮어쓰기 방지 |
| - [ ] | `app/utils/experienceTranslation/index.ts` | 번역 로직 | 번역 provider 폴백 처리 |

---

## 🚨 우선 점검 대상 (런칭 전 MUST FIX)

아래 항목은 **이미 버그가 보고된 항목** 또는 **결제/보안 관련 Critical** 이슈로 Codex 1순위 배정:

| 우선순위 | 도메인 | 파일 | 증상 |
|---------|--------|------|------|
| 🔴 P0 | D-04 | `api/payment/nicepay-callback/route.ts` | 서명 검증 구현 여부 미확인 |
| 🔴 P0 | D-04 | `api/bookings/confirm-payment/route.ts` | 무통장 확인 2번 발송 이슈 |
| 🔴 P0 | D-01 | `auth/callback/route.ts` | 로그인 후 자동 로그아웃 이슈 |
| 🟠 P1 | D-07 | `api/notifications/send-email/route.ts` | 호스트 알림에 게스트 이름 오표시 |
| 🟠 P1 | D-03 | `host/dashboard/components/ReservationCard.tsx` | 예약 카드 이름 버그 |
| 🟠 P1 | D-09 | `community/write/PostEditor.tsx` | XSS 취약점 잠재 가능성 |
| 🟡 P2 | D-08 | `api/admin/delete/route.ts` | 유저 삭제 cascade 완결성 |
| 🟡 P2 | D-10 | `lib/supabase.ts` | 레거시 클라이언트 마이그레이션 필요 |

---

## 📋 Codex 작업 지시 템플릿

> 다음 세션에서 Codex에게 전달할 명령 양식

```
[Codex 점검 지시 — Domain: D-XX]

점검 대상 파일:
- path/to/file1.ts
- path/to/file2.ts

점검 포인트:
1. [보안] 서명 검증 구현 여부
2. [로직] 중복 처리 방어 (멱등성)
3. [타입] any 사용 여부 및 타입 안전성
4. [에러처리] try/catch 누락, 에러 로깅

출력 형식:
- 파일별 발견된 결함 목록 (심각도: Critical/High/Medium/Low)
- 수정 제안 코드 스니펫
- 추가 확인이 필요한 연관 파일 목록
```

---

*이 문서는 로컬리 런칭 전 전수 점검을 위한 전략 지도입니다. 점검 완료된 항목은 `- [ ]` → `- [x]`로 업데이트하세요.*
