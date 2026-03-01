# Locally-Web CHANGELOG

> 과거 완료된 버그 수정, UI/UX 조정, 패치 내역을 보관하는 이력 문서.
> 새로운 기능/아키텍처 결정은 `gemini.md`에 기록한다.

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
