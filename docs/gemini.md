# Locally-Web Project Guide (GEMINI.md)

**Last Updated:** 2026-03-02 (v3.9.2 무통장 입금 백엔드 연동)
**Version:** 3.9.2 (Bank Transfer Backend for Service Requests)
**Purpose:** 코드 계획/구현 시 참조하는 단일 운영 기준 문서

---

## 1. 프로젝트 미션

Locally는 현지인 호스트(Local Host)와 여행자(Guest)를 연결하는 C2C 로컬 체험 여행 플랫폼이다.

---

## 2. 아키텍처 원칙

### 2.1 Admin 구조
- `page.tsx`: 뷰/탭 라우팅 (탭: APPROVALS/USERS/LEDGER/SALES/SERVICE_REQUESTS/ANALYTICS/CHATS/LOGS/TEAM)
- `hooks/useAdminData.ts`: 체험/bookings 데이터 페칭 (변경 금지)
- `hooks/useServiceAdminData.ts`: service_bookings 전용 독립 훅 (v3.9.0 신설)
- `components/ServiceAdminTab.tsx`: 맞춤 의뢰 관리 탭 — 전체 의뢰 / 정산 대기 / 취소·환불 내역 (v3.9.0 신설)
- `types/admin.ts`: 관리자 전용 타입 중앙화 (`AdminServiceBooking` 포함)
- `/api/admin/service-cancel`: 관리자 강제 취소/환불 API (NicePay error-safe)
- `/api/admin/service-confirm-payment`: 무통장 입금 확인 API (PENDING→PAID + request→open, v3.9.2)
- `/api/services/payment/mark-bank`: 무통장 선택 시 payment_method='bank' 저장 (v3.9.2)

원칙:
- Admin page는 비대화하지 않고, 로직은 `hooks/`로 분리한다.
- 복잡 Join은 Raw fetch + JS 조립(Manual Join)을 기본으로 한다.
- service_bookings와 bookings는 완전히 별도 데이터 소스 — 훅/컴포넌트를 분리 유지한다.
- 수수료율(%) Admin UI 어디에도 노출 금지 — 금액(amount)만 표시한다.

---

## 3. 데이터/보안 기준

### 3.1 핵심 테이블 (요약)
| 분류 | 테이블 | 비고 |
| :--- | :--- | :--- |
| 사용자/권한 | `profiles`, `admin_whitelist` | `profiles.role` 기반, whitelist 예외 허용 |
| 상품/예약/결제 | `experiences`, `bookings` | 예약 상태는 서버 검증 기준 |
| 소통/리뷰 | `inquiries`, `inquiry_messages`, `reviews` | 채팅/리뷰 연동 |
| 운영 | `admin_tasks`, `admin_task_comments`, `audit_logs` | 협업/로그 |
| 커뮤니티 | `community_posts`, `community_comments`, `community_likes` | RLS: SELECT USING(true), INSERT/UPDATE/DELETE는 auth 필수 |

### 3.2 권한 원칙
- 기본: 인증 사용자 + 본인 데이터 범위
- 관리자: `profiles.role='admin'` 또는 `admin_whitelist` 매칭
- 민감 API는 반드시 서버에서 권한 확인 후 처리
- **[팀 알림 아키텍처 결정]** `/api/admin/notify-team`의 수신자 수집은 `admin_whitelist` 단일 소스만 사용한다. `users.role='admin'`을 병행 소스로 쓰면 whitelist에서 삭제된 관리자에게 계속 발송되는 버그 발생. 팀원 추가/제거는 반드시 `admin_whitelist` 테이블만 통해 관리한다.

### 3.3 결제/정합성 원칙
- 결제 확정/취소는 서버 검증 경로를 단일 소스로 유지
- PG 응답 성공 확인 후 DB 상태 변경
- 클라이언트 직접 결제 상태 변경 금지
- **[이메일 결합도 무관찰 원칙]** 결제 콜백(`route.ts`) 라우트 내부에서는 절대 `nodemailer`나 서버 사이드 UI 렌더링(`@react-email`)을 돌리지 않는다. 결제가 확정되면 무조건 `200 OK`를 내어주고, 이메일은 비동기 Fetch(`api/notifications/send-email`)로 백그라운드로 넘긴다.

### 3.4 프로필 동기화 원칙 (v3.21.0+)
- `auth.users`에 레코드가 생성되는 즉시 `profiles` 테이블에 1:1로 레코드가 보장되어야 한다.
- 클라이언트 혹은 애플리케이션 레벨의 수동 Upsert(`syncProfile.ts`) 로직은 절대 사용하지 않는다. (FK Constraint Violation 방지)
- 동기화는 100% DB 레벨의 Postgres Trigger (`on_auth_user_created`)가 담당한다.

---

## 4. 현재 상태 요약

- 결제/보안: NicePay 서명 검증, 결제 확정/취소 API 권한 검증 반영
- 데이터 무결성: 클라이언트 직접 DB 쓰기 제거, 서버 중심 예약/정산 흐름 통합, Postgres Trigger 프로필 100% 일치 동기화.
- Admin 맞춤 의뢰 관리 통합(v3.9.0): `service_bookings` 테이블 결제 흐름을 Admin이 통제할 수 있도록 별도 탭 `SERVICE_REQUESTS`를 신설하고, `useServiceAdminData.ts` 독립 훅·`ServiceAdminTab.tsx` 3-서브탭 컴포넌트·`/api/admin/service-cancel` 강제 취소 API를 추가. NicePay cancel 실패 시 DB 상태 미변경(에러 안전) 보장. `SalesTab` KPI에 service_bookings GMV/정산액 합산(수수료율 % 미노출). 기존 체험(`bookings`) 탭·`useAdminData.ts`는 전혀 변경하지 않음.
- 맞춤 의뢰 결제 무통장 입금 추가(v3.9.1): `/services/[requestId]/payment`에 결제 수단 선택 UI(카드 결제 / 무통장 입금)를 추가. 무통장 선택 시 IMP 호출 없이 계좌번호 안내 후 `/payment/complete?method=bank`로 직접 이동. 계좌 정보는 `NEXT_PUBLIC_BANK_ACCOUNT`/`NEXT_PUBLIC_BANK_NAME` 환경변수로 관리.
- 맞춤 의뢰 무통장 백엔드 연동(v3.9.2): 무통장 선택 시 `/api/services/payment/mark-bank` 호출로 `service_bookings.payment_method='bank'` 저장(service_role 전용 쓰기 → 서버 API 경유). Admin `ServiceAdminTab`에 "결제수단" 컬럼(🏛️ 무통장/💳 카드) 및 PENDING+무통장 행에 "💰 입금 확인" 버튼 추가 → `/api/admin/service-confirm-payment` 호출 → PENDING→PAID, pending_payment→open + 호스트 알림 + 감사 로그.

비고: 상세 변경 로그(파일 단위 픽셀 조정, 과거 패치 서술)는 `docs/CHANGELOG.md` 또는 커밋 이력에서 확인한다.

---

## 5. 필수 개발 규칙

### 5.1 DO
1. Supabase 단건 조회는 기본적으로 `.maybeSingle()`을 우선 사용한다.
2. Admin 복잡 Join은 Raw fetch + JS 조립(현행 `useAdminData` 패턴)으로 처리한다.
3. Realtime 구독은 `useEffect` cleanup에서 채널/리스너를 반드시 해제한다.
4. SSR/CSR 불일치가 생길 수 있는 `window`, `localStorage`, `Date` 접근은 `useEffect` 또는 client guard로 분리한다.
5. 실패 처리 시 로그만 남기지 말고 사용자 피드백(Toast)을 제공한다.
6. 수정 전 연관 컴포넌트/훅/API 흐름을 교차 검증하고, 핀셋 수정(최소 변경)을 우선한다.
7. **[SSR Join 분리 원칙]** `page.tsx` 서버 컴포넌트에서 여러 테이블을 join하는 단일 Supabase 쿼리는 쓰지 않는다. join 에러 시 `data=null`이 되어 `notFound()`가 호출되는 문제가 있음. 대신 ① 핵심 테이블 단독 조회 → ② 보조 테이블 별도 조회 패턴으로 분리한다.

### 5.2 DON'T
- 외부 UI 라이브러리 임의 추가 금지
- Admin 페이지에 비즈니스 로직 과적재 금지
- 모바일 수정 시 데스크탑 스타일 회귀 유발 금지
- `text-[Npx]` 단독 사용 금지 (항상 `md:` 데스크탑 값 병기)
- 반응형 분기가 필요한 UI를 `md:hidden` / `hidden md:*` 없이 혼용 금지

---

## 6. 반응형/레이아웃 규칙

### 6.1 핵심 원칙
1. `md:` 없는 기존 클래스는 기존 웹 스타일에 영향을 주므로 직접 치환하지 않는다.
2. 모바일 변경은 `text-[10px] md:text-sm`처럼 모바일 우선 + 데스크탑 보존 방식으로 적용한다.
3. `fixed/absolute/inset/z-*` 변경 시 `md:static`, `md:inset-auto` 등 리셋을 함께 둔다.
4. 데스크탑/모바일 분기가 필요한 UI는 `md:hidden` / `hidden md:*` 패턴으로 구조를 분리한다.
5. BottomTabNavigation과 겹치는 고정 UI는 모바일에서 `bottom-[80px] md:bottom-*` 패턴을 기본으로 점검한다.

### 6.2 Breakpoint 기준
| 접두사 없음 | `md:` | `lg:` |
| --- | --- | --- |
| 모바일 (< 768px) | 태블릿 + 데스크탑 (≥ 768px) | 대형 화면 (≥ 1024px) |

### 6.3 z-index 기준
- `z-[9999]`: 최상위 전역 모달/토스트
- `z-[200]`: 일반 모달
- `z-[150]`: 상세/갤러리 오버레이
- `z-[105]`: 예약 플로팅/모바일 상위 고정 요소
- `z-[100]`: BottomTabNavigation 기준 레이어
- `z-[80]`: Admin Sidebar

---

## 7. 백로그

- 지도 기반 검색 (국내/해외 지도 분기)
- 메시징 기능 확장 (미디어, 읽음 상태 등)
- Admin 권한 세분화(RBAC)
- 정산/운영 자동화 강화

---

## 8. 문서 운영 규칙

- 이 문서는 "현재 유효한 구현 기준"만 유지한다. 과거 완료 작업·이력 서술은 작성하지 않는다.
- 중복/과장/과거 상세 로그는 누적하지 않는다.
- **[영구 규칙 1]** gemini.md는 DB 스키마 변경·신규 API 추가·아키텍처 결정 등 **핵심 시스템 골격 변경** 시에만 업데이트한다. UI 픽셀 조정·스타일 수정·컴포넌트 리파인은 gemini.md 업데이트 대상이 아니다.
- **[영구 규칙 2]** 과거 완료된 버그 수정·UI/UX 조정·패치 내역은 반드시 `docs/CHANGELOG.md`에만 기록한다. gemini.md에 과거형(~수정, ~추가, ~변경) 서술을 쌓지 않는다.
- 대규모 변경 시 이 문서에는 결정사항만 요약하고, 상세 이력은 `docs/CHANGELOG.md` 또는 커밋에 남긴다.
- 모바일 전용 경로(`'/host/menu'` 등)는 데스크탑 전환/네비게이션의 기본 목적지로 사용하지 않는다.
- 폰트 검증은 개발 캐시(`.next/dev`) 단독 결과를 기준으로 판단하지 않고, `.next` 정리 후 `webpack build` 산출물로 최종 확인한다.

---

## 9. 현재 연결 점검 메모

- 호스트 지원서의 `email`은 `host_applications.email` 전용 필드다. 관리자 검토용으로는 보이지만, 실제 로그인 계정 이메일(`auth`/`profiles.email`)과 동기화되지 않는다.
- 호스트 지원서 언어는 `host_applications.language_levels`(JSON) + `languages`(문자열 배열) 이중 구조로 저장한다. 관리자 상세에서는 `언어 + Lv.n`으로 보여주고, 리스트 요약은 `languages` 기준으로 표시한다.
- 호스트 지원서의 `language_cert`는 입력/저장을 유지하며, 관리자 상세에서만 텍스트로 노출한다.
- 호스트 지원서 상태의 `idCardType`은 로컬 상태만 존재하고, 렌더/저장/조회 경로가 없다.
- 체험 등록의 `spots`는 생성 시 저장되지만 현재 런타임 읽기 경로가 없다.
- 체험 언어는 `experiences.language_levels`(JSON) + `languages`(문자열 배열) 이중 구조로 저장한다. 공개 상세는 기존 Lightbulb 언어 안내 위치에서 `한국어 Lv.5 · 영어 Lv.4` 형식의 한 줄 요약을 우선 노출한다.
- 체험의 `exclusions`는 생성/수정 화면 모두에서 직접 입력 가능하며, 상세 화면에서는 `포함 사항 / 불포함 사항 / 준비물`을 분리 노출한다.
- 체험의 `is_private_enabled` / `private_price`는 생성뿐 아니라 호스트 대시보드의 체험 수정 화면에서도 실제 편집/저장 가능해야 한다.
- 체험 상세 UI는 `rules.preparation_level`을 더 이상 표기하지 않고, `활동 강도`는 `rules.activity_level`만 노출한다.

---

## 10. 서비스 매칭 시스템 (역경매, v3.3.0)

### 10.1 개요

고객이 맞춤 동행/통역 서비스를 의뢰하면 해당 지역 호스트들이 지원하고, 고객이 선택 후 결제하는 **역경매 매칭 플로우**. 기존 `experiences` / `bookings` 테이블/로직과 **완전 독립**.

**가격 구조 (수수료율 절대 노출 금지):**
- 고객 결제: ₩35,000/hr × duration_hours (최소 4시간)
- 호스트 수익: ₩20,000/hr × duration_hours
- 플랫폼 마진: ₩15,000/hr (비공개)

### 10.2 DB 테이블 (Supabase)

| 테이블 | 용도 |
|--------|------|
| `service_requests` | 고객 의뢰. `total_customer_price`, `total_host_payout`은 GENERATED ALWAYS 컬럼 |
| `service_applications` | 호스트 지원. UNIQUE(request_id, host_id) |
| `service_bookings` | 결제/정산. `SVC-` 접두사 주문번호. service_role 전용 쓰기 |

**마이그레이션 파일:** `supabase_service_matching_migration.sql` (초기), `supabase_service_matching_v2_escrow_migration.sql` (v2 에스크로)

**상태 플로우 (v2 에스크로):**
```
service_requests: pending_payment → (결제) → open → (호스트 선택) → matched → completed
                  pending_payment → cancelled (결제 포기)
                  open → cancelled (결제 후 호스트 미선택 상태에서 취소 + PG 환불)
                  matched → cancelled (관리자 검토)
service_bookings: PENDING → (결제) → PAID → cancelled / cancellation_requested
```

### 10.3 라우팅

**고객:**
- `/services/request` — 의뢰 작성 폼 (₩35,000/hr 고정 표시)
- `/services/my` — 내 의뢰 목록
- `/services/[requestId]` — 의뢰 상세 (지원자 선택 포함)
- `/services/[requestId]/payment` — NicePay 결제 (기존 결제 callback과 완전 분리)
- `/services/[requestId]/payment/complete` — 결제 완료

**호스트:**
- `/services` — 잡보드 (열린 의뢰 목록)
- `/services/[requestId]/apply` — 지원 폼 (₩20,000/hr 예상 수입 표시, 비율 미노출)
- 호스트 대시보드 `?tab=service-jobs` — ServiceJobsTab (열린 의뢰 / 내 지원 / 진행중)

### 10.4 API 라우트

| 엔드포인트 | 용도 |
|------------|------|
| `POST /api/services/requests` | 의뢰 생성(pending_payment) + 에스크로 예약 사전 생성(PENDING, host_id=null) |
| `GET /api/services/requests?mode=board\|my` | 의뢰 목록 조회 (board: open만) |
| `POST /api/services/applications` | 호스트 지원 (중복/재지원 처리) |
| `POST /api/services/select-host` | 고객의 호스트 선택 → matched + 기존 예약에 host_id/application_id 채워넣기 |
| `POST /api/services/payment/nicepay-callback` | 결제 확정 → request.status: open 전환 + 호스트 전체 알림 |
| `POST /api/services/cancel` | PENDING: DB 취소 / open+PAID: NicePay PG 전액환불 / matched: 관리자 검토 |

### 10.5 타입 & 상수

- `app/types/service.ts` — ServiceRequest, ServiceApplication, ServiceBooking 등
- `app/constants/serviceStatus.ts` — 상태 유틸 함수 (`isOpenServiceRequest`, `getServiceRequestStatusLabel` 등)
- `app/utils/notification.ts` — NotificationType에 `service_request_new`, `service_application_new`, `service_host_selected`, `service_host_rejected`, `service_payment_confirmed`, `service_cancelled` 추가

### 10.6 네비게이션 연동

- **홈 서비스 탭:** `LOCALLY_SERVICES` 5번째 항목(id=5) → 클릭 시 `/services/intro` 라우팅
- **호스트 대시보드:** `service-jobs` 탭 추가 (Briefcase 아이콘) → ServiceJobsTab 렌더
- **MobileHostMenu:** "서비스 매칭" 메뉴 항목 추가 → `/host/dashboard?tab=service-jobs`
- **BottomTabNavigation:** `isHostNavPath`에 `/services` 경로 추가 (호스트 잡보드 탐색 시 탭바 유지)

### 10.7 주요 제약사항

- 수수료 비율(₩15,000/hr) 어디에도 노출 금지 — Generated 컬럼 기반으로 UI에서 계산 불필요
- 기존 `/api/payment/nicepay-callback` 수정 금지 — 서비스 결제는 `/api/services/payment/nicepay-callback` 전용
- 기존 `experiences` / `bookings` 테이블/API 변경 금지
- 주문번호 `SVC-` 접두사: 기존 예약과 충돌 방지 + callback 라우팅 가드

---

## 11. 에스크로 선결제 시스템 (v3.8.0+)

### 11.1 배경 — 노쇼 문제 해결

**v2 에스크로 플로우:** 의뢰 등록 → **즉시 결제(에스크로)** → open 공개 → 호스트 지원 → 선택 → 확정
- 고객 결제 완료 후 잡보드 공개 → 호스트 선택 → 이미 결제된 금액으로 바로 확정

### 11.2 DB 변경사항 (v3.8.0)

- **`service_requests.status`:** `pending_payment` 상태 추가 (결제 전 잡보드 미노출)
- **`service_bookings.host_id`:** NOT NULL → nullable (에스크로 단계에서 호스트 미정)
- **`service_bookings.application_id`:** NOT NULL → nullable (호스트 선택 후 채워짐)
- **마이그레이션:** `supabase_service_matching_v2_escrow_migration.sql` 실행 필요

### 11.3 결제 플로우

**카드 결제:**
```
1. 고객: /services/request → 폼 작성
2. POST /api/services/requests
   → service_requests INSERT (status=pending_payment)
   → service_bookings INSERT (status=PENDING, host_id=null, application_id=null)
   → 반환: { requestId, orderId, amount }
3. 프론트: /services/${requestId}/payment 리다이렉트
4. 결제 페이지: DB에서 PENDING 예약 조회 (request_id + customer_id)
5. [카드] IMP.request_pay() → NicePay 결제
6. POST /api/services/payment/nicepay-callback
   → service_bookings.status = PAID
   → service_requests.status = open
   → 승인 호스트 전체 알림 발송
7. 잡보드(/services): open 의뢰만 표시
8. 호스트: 지원서 제출 → 고객이 선택
9. POST /api/services/select-host
   → service_requests.status = matched
   → service_bookings.host_id, application_id 채워넣기
10. 매칭 확정 — 별도 결제 불필요
```

**무통장 입금 (v3.9.2 완성):**
```
1~4. 동일
5. [무통장] POST /api/services/payment/mark-bank
   → service_bookings.payment_method = 'bank' (service_role 경유)
6. /payment/complete?orderId=...&method=bank 리다이렉트
   → "입금 대기 중" UI + 계좌번호 재표시
   → service_bookings: PENDING 유지 / service_requests: pending_payment 유지
7. Admin: ServiceAdminTab → "💰 입금 확인" 버튼
   → POST /api/admin/service-confirm-payment
   → service_bookings: PENDING → PAID
   → service_requests: pending_payment → open (잡보드 공개)
   → 호스트 전체 알림 + 고객 알림 + 감사 로그
```

**결제 수단 환경 변수:**
- `NEXT_PUBLIC_BANK_ACCOUNT`: 무통장 입금 계좌번호
- `NEXT_PUBLIC_BANK_NAME`: 은행명 (기본: 카카오뱅크)

### 11.4 취소/환불 로직

| 예약 상태 | 의뢰 상태 | 처리 방식 |
|-----------|-----------|-----------|
| PENDING | pending_payment | DB 취소만 (PG 미결제) |
| PAID | open | NicePay PG 전액 환불 + DB 취소 |
| PAID | matched / confirmed | cancellation_requested (관리자 검토) |

### 11.5 주의사항

- `isPendingPaymentServiceRequest` 유틸 사용 — raw 문자열 비교 금지
- 잡보드 GET API: `status='open'` 필터 고정 — `pending_payment` 절대 노출 금지
- IMP 클라이언트 콜백 시 `signData`/`ediDate` 비어있을 수 있음 → 비어있으면 서명 검증 건너뜀 (금액 검증으로 대체)
- 기존 `/api/payment/nicepay-callback` 및 `experiences/bookings` 로직 일절 미변경
