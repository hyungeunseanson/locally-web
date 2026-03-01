# 맞춤형 동행/통역 서비스 — 역경매 매칭 시스템 구현 계획서

## Context

현재 Locally는 '체험(experiences)' 중심의 공급자 주도 시스템만 운영 중이다. 고객이 직접 통역/동행 서비스를 요청하고, 해당 지역 호스트들이 지원하는 **수요자 중심 역경매 매칭 시스템**을 완전 독립적으로 구축한다.

**핵심 비즈니스 로직:**
- 고객 결제: 시간당 ₩35,000 고정 (최소 4시간)
- 호스트 수익: 시간당 ₩20,000 고정
- 차액(₩15,000/hr)은 플랫폼 마진 → 수수료율 절대 노출 금지
- 플로우: 의뢰 작성 → 호스트 알림 → 호스트 지원 → 고객 선택 → 결제 → 매칭 확정

**절대 제약:** 기존 `experiences` / `bookings` 테이블 및 로직 일절 변경 금지

---

## 1. DB 설계안

### 1.1 `service_requests` (고객 의뢰)

```sql
CREATE TABLE public.service_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  city            TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'JP',
  service_date    DATE NOT NULL,
  start_time      TEXT NOT NULL,
  duration_hours  INTEGER NOT NULL CHECK (duration_hours >= 4),
  languages       TEXT[] NOT NULL DEFAULT '{}',
  guest_count     INTEGER NOT NULL DEFAULT 1 CHECK (guest_count >= 1),

  -- 고정 가격 (수수료 구조 은폐)
  hourly_rate_customer INTEGER NOT NULL DEFAULT 35000,
  hourly_rate_host     INTEGER NOT NULL DEFAULT 20000,
  total_customer_price INTEGER GENERATED ALWAYS AS (hourly_rate_customer * duration_hours) STORED,
  total_host_payout    INTEGER GENERATED ALWAYS AS (hourly_rate_host * duration_hours) STORED,

  -- 라이프사이클
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','matched','paid','confirmed','completed','cancelled','expired')),
  selected_application_id UUID,
  selected_host_id UUID,
  contact_name    TEXT,
  contact_phone   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_sr_user ON public.service_requests(user_id);
CREATE INDEX idx_sr_city_status ON public.service_requests(city, status);
CREATE INDEX idx_sr_status_date ON public.service_requests(status, service_date);
```

**상태 플로우:**
```
open → matched(호스트 선택) → paid(결제 완료) → confirmed → completed
open → cancelled / expired
matched → cancelled(결제 전 취소)
```

### 1.2 `service_applications` (호스트 지원)

```sql
CREATE TABLE public.service_applications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id      UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appeal_message  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','selected','rejected','withdrawn')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_host_per_request UNIQUE (request_id, host_id)
);

CREATE INDEX idx_sa_request ON public.service_applications(request_id);
CREATE INDEX idx_sa_host ON public.service_applications(host_id);
```

### 1.3 `service_bookings` (결제/정산)

```sql
CREATE TABLE public.service_bookings (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL UNIQUE,
  request_id          UUID NOT NULL REFERENCES public.service_requests(id),
  application_id      UUID NOT NULL REFERENCES public.service_applications(id),
  customer_id         UUID NOT NULL REFERENCES auth.users(id),
  host_id             UUID NOT NULL REFERENCES auth.users(id),
  amount              INTEGER NOT NULL,      -- 고객 결제 총액
  tid                 TEXT,                  -- PG 트랜잭션 ID
  status              TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','PAID','confirmed','completed','cancelled','cancellation_requested')),
  payment_method      TEXT DEFAULT 'card',
  host_payout_amount  INTEGER,              -- 호스트 수령액
  platform_revenue    INTEGER,              -- 플랫폼 마진
  payout_status       TEXT DEFAULT 'pending',
  contact_name        TEXT,
  contact_phone       TEXT,
  cancel_reason       TEXT,
  refund_amount       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sb_customer ON public.service_bookings(customer_id);
CREATE INDEX idx_sb_host ON public.service_bookings(host_id);
CREATE INDEX idx_sb_request ON public.service_bookings(request_id);
```

### 1.4 `create_service_booking_atomic` (원자적 예약 RPC)

기존 `create_booking_atomic` 패턴 준수. 핵심 로직:
- `service_requests` 행 `FOR UPDATE` 잠금
- status = 'matched' 검증
- 고객 소유권 + 선택 호스트 일치 검증
- `SVC-` 접두사 주문번호 생성
- `service_bookings` 삽입 후 `(order_id, amount, host_payout)` 반환

### 1.5 RLS 정책 (요약)

| 테이블 | SELECT | INSERT | UPDATE |
|--------|--------|--------|--------|
| `service_requests` | 본인 의뢰 + open 상태 전체 + 선택된 호스트 | 인증 사용자 본인 | 의뢰 소유자만 |
| `service_applications` | 본인 지원 + 해당 의뢰 소유자 | 승인된 호스트만 | 호스트 본인만 |
| `service_bookings` | 고객 또는 호스트 당사자 | 서버(service_role)만 | 서버만 |

---

## 2. UI/UX 라우팅 계획

### 2.1 새 라우트 구조

```
/app/services/
├── page.tsx                        # 잡보드 (호스트: 열린 의뢰 탐색)
├── request/page.tsx                # 고객: 서비스 의뢰 작성 폼
├── my/page.tsx                     # 고객: 내 서비스 의뢰 목록
├── [requestId]/
│   ├── page.tsx                    # 의뢰 상세 (고객→지원자 확인 / 호스트→의뢰 상세)
│   ├── apply/page.tsx              # 호스트: 지원(어필) 작성
│   └── payment/
│       ├── page.tsx                # 고객: 결제 페이지
│       └── complete/page.tsx       # 결제 완료

/app/api/services/
├── requests/route.ts               # POST: 의뢰 생성 / GET: 의뢰 목록
├── applications/route.ts           # POST: 호스트 지원
├── select-host/route.ts            # POST: 호스트 선택
├── bookings/route.ts               # POST: 원자적 예약 생성
├── payment/nicepay-callback/route.ts  # POST: 결제 검증 (별도 엔드포인트)
└── cancel/route.ts                 # POST: 취소/환불
```

### 2.2 네비게이션 통합

#### 호스트 대시보드에 새 탭 추가
- **파일:** `app/host/dashboard/page.tsx`
- `inquiries`와 `earnings` 사이에 `service-jobs` 탭 추가
- 아이콘: `Briefcase` (lucide-react)
- 새 컴포넌트: `ServiceJobsTab` → 서브탭 3개: "열린 의뢰" / "내 지원" / "진행중 서비스"

#### 호스트 모바일 메뉴 항목 추가
- **파일:** `app/components/mobile/MobileHostMenu.tsx`
- 메뉴 그룹에 "서비스 매칭" 항목 추가 → `/host/dashboard?tab=service-jobs`

#### BottomTabNavigation 경로 허용
- **파일:** `app/components/mobile/BottomTabNavigation.tsx`
- `isHostNavPath`에 `pathname?.startsWith('/services')` 조건 추가 → 호스트가 잡보드 탐색 시 하단 탭 유지
- 기존 5개 탭 구성은 변경하지 않음

#### 홈 서비스 탭 연동
- **파일:** `app/constants.ts` → `LOCALLY_SERVICES` 배열 끝에 5번째 항목 추가:
  ```typescript
  { id: 5, title: '현지인 동행/통역 맞춤 의뢰', price: 35000, image: '...', desc: '원하는 일정에 맞는 현지인 호스트를 직접 매칭받으세요.' }
  ```
- **파일:** `app/components/ServiceCard.tsx` 또는 `HomePageClient.tsx`
  - 기존 4개 카드 UI/배열 일절 변경 금지
  - 5번째 카드(`id: 5`) 클릭 시 `/services/request`로 라우팅 연결
  - 기존 ServiceCard 동일 디자인 유지

### 2.3 주요 화면 상세

#### A. 의뢰 작성 폼 (`/services/request`)
- 기존 결제 페이지(`/experiences/[id]/payment/page.tsx`) 레이아웃 패턴 준수
- 필드: 제목, 도시, 날짜, 시작 시간, 이용 시간(최소 4h), 인원, 필요 언어, 상세 설명, 연락처
- 가격 표시: `시간당 ₩35,000 × N시간 = 총 ₩X` (고정, 내역 없음)

#### B. 의뢰 상세 (`/services/[requestId]`)
- 고객 뷰: 의뢰 요약 + 지원자 카드 리스트(아바타, 이름, 언어, 어필, 평점) + "이 호스트 선택" CTA
- 호스트 뷰: 의뢰 상세 + "지원하기" CTA (또는 "지원 완료" 상태 표시)

#### C. 호스트 지원 폼 (`/services/[requestId]/apply`)
- 의뢰 요약 (읽기 전용)
- 어필 메시지 textarea
- 예상 수입 표시: `₩20,000 × N시간 = ₩X`

#### D. 결제 페이지 (`/services/[requestId]/payment`)
- 기존 NicePay 결제 페이지와 동일 구조 (IMP.init → request_pay → callback)
- **별도 callback 엔드포인트** 사용: `/api/services/payment/nicepay-callback`
- 기존 결제 callback 로직 절대 수정하지 않음

#### E. ServiceJobsTab (호스트 대시보드)
- `ReservationManager` 패턴 준수
- 서브탭: "열린 의뢰" (도시/언어 필터) | "내 지원" (상태별 분류) | "진행중 서비스"

---

## 3. 알림 및 결제 연동 플로우

### 3.1 알림 — 기존 시스템 재활용

**수정 파일:** `app/utils/notification.ts` → `NotificationType`에 추가:
```typescript
| 'service_request_new'         // 호스트에게: 내 지역 새 의뢰
| 'service_application_new'     // 고객에게: 새 지원자
| 'service_host_selected'       // 호스트에게: 선택됨
| 'service_host_rejected'       // 호스트에게: 미선택
| 'service_payment_confirmed'   // 양측: 결제 확정
| 'service_cancelled'           // 양측: 취소
```

**알림 발송 시점:**

| 이벤트 | 수신자 | 링크 |
|--------|--------|------|
| 의뢰 생성 | 해당 도시 승인 호스트 전체 (다중 발송) | `/services/[id]` |
| 호스트 지원 | 의뢰 소유 고객 | `/services/[id]` |
| 호스트 선택 | 선택된 호스트 | `/services/[id]` |
| 호스트 미선택 | 나머지 지원 호스트 | `/services` |
| 결제 확정 | 호스트 + 고객 | 각각 대시보드/내 의뢰 |
| 취소 | 상대방 | 관련 링크 |

**호스트 대상 판정:** `host_applications` (status='approved') + `experiences` (city 매칭) 기준으로 해당 도시 활동 호스트 필터 → `sendNotification({ recipient_ids: [...] })` 기존 다중 발송 패턴 재사용

### 3.2 결제 — 기존 NicePay 플로우 복제

```
1. 고객이 호스트 선택 → service_requests.status = 'matched'
2. 결제 페이지 진입 → /services/[requestId]/payment
3. POST /api/services/bookings → create_service_booking_atomic RPC
   → (order_id, amount) 반환
4. IMP.request_pay({ pg:'nice_v2', merchant_uid: orderid, amount })
5. POST /api/services/payment/nicepay-callback
   → 서명 검증 + 금액 검증 → service_bookings.status='PAID'
   → service_requests.status='paid'
   → 양측 알림 + 이메일
6. 완료 페이지 → /services/[requestId]/payment/complete
```

정산 계산은 예약 생성 시 확정 (테이블 generated column 기반):
- `host_payout_amount = 20,000 × hours`
- `platform_revenue = (35,000 - 20,000) × hours`

### 3.3 Supabase Realtime (선택적)

`NotificationContext`가 이미 `notifications` 테이블 INSERT를 감지 → 신규 알림 타입도 자동 반영. 추가 Realtime 채널 불필요.

---

## 4. 새 파일 목록

| 파일 | 용도 |
|------|------|
| `app/types/service.ts` | ServiceRequest, ServiceApplication, ServiceBooking 타입 |
| `app/constants/serviceStatus.ts` | 서비스 상태 상수 + 유틸 함수 |
| `app/services/page.tsx` | 잡보드 (호스트용 열린 의뢰 목록) |
| `app/services/request/page.tsx` | 의뢰 작성 폼 |
| `app/services/my/page.tsx` | 내 의뢰 목록 |
| `app/services/[requestId]/page.tsx` | 의뢰 상세 |
| `app/services/[requestId]/apply/page.tsx` | 호스트 지원 폼 |
| `app/services/[requestId]/payment/page.tsx` | 결제 페이지 |
| `app/services/[requestId]/payment/complete/page.tsx` | 결제 완료 |
| `app/host/dashboard/components/ServiceJobsTab.tsx` | 호스트 대시보드 탭 |
| `app/api/services/requests/route.ts` | 의뢰 CRUD API |
| `app/api/services/applications/route.ts` | 지원 API |
| `app/api/services/select-host/route.ts` | 호스트 선택 API |
| `app/api/services/bookings/route.ts` | 원자적 예약 생성 API |
| `app/api/services/payment/nicepay-callback/route.ts` | 결제 검증 API |
| `app/api/services/cancel/route.ts` | 취소/환불 API |
| `supabase_service_matching_migration.sql` | DB 마이그레이션 (3 테이블 + RPC + RLS) |

## 5. 기존 파일 수정 목록 (핀셋 수정)

| 파일 | 변경 내용 |
|------|-----------|
| `app/utils/notification.ts` | NotificationType 유니온에 6개 타입 추가 |
| `app/host/dashboard/page.tsx` | 사이드바/콘텐츠에 `service-jobs` 탭 추가 |
| `app/components/mobile/MobileHostMenu.tsx` | "서비스 매칭" 메뉴 항목 추가 |
| `app/components/mobile/BottomTabNavigation.tsx` | `isHostNavPath`에 `/services` 경로 추가 |
| `app/constants.ts` | `LOCALLY_SERVICES` 배열에 5번째 항목 추가 |
| `app/components/HomePageClient.tsx` | 5번째 서비스 카드 클릭 시 `/services/request` 라우팅 연결 |
| `app/context/LanguageContext.tsx` | `svc_*` 번역 키 추가 (ko/en/ja/zh) |

---

## 6. 구현 순서

1. **DB 마이그레이션** — 테이블 3개 + RPC + RLS + 인덱스
2. **타입/상수** — `service.ts`, `serviceStatus.ts`, NotificationType 확장
3. **API 라우트** — 6개 엔드포인트 (의뢰→지원→선택→예약→결제→취소)
4. **고객 UI** — 의뢰 폼 → 내 의뢰 → 상세(지원자 확인/선택) → 결제
5. **호스트 UI** — 잡보드 → 지원 폼 → 대시보드 ServiceJobsTab
6. **i18n + 네비게이션 통합** — 번역 키 추가, 홈 서비스 탭 연동
7. **검증** — 전체 플로우 E2E 테스트

## 7. 검증 방법

1. **DB**: Supabase SQL Editor에서 마이그레이션 실행 → 테이블/RLS/RPC 정상 생성 확인
2. **의뢰 생성**: 게스트 로그인 → `/services/request` → 폼 제출 → `service_requests` 행 생성 확인
3. **호스트 알림**: 해당 도시 호스트에게 `notifications` INSERT 확인
4. **호스트 지원**: 호스트 로그인 → 잡보드 → 의뢰 클릭 → 어필 작성 → `service_applications` 행 생성 확인
5. **호스트 선택**: 고객이 지원자 선택 → `service_requests.status = 'matched'` 확인
6. **결제**: NicePay 테스트 모드 결제 → callback 서명/금액 검증 → `service_bookings.status = 'PAID'` 확인
7. **모바일/데스크탑**: 반응형 레이아웃 회귀 없음 확인 (기존 체험 흐름 정상 동작)
8. **빌드**: `npx next build` 타입 에러/빌드 에러 0 확인
