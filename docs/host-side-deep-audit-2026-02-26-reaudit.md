# 호스트 사이드 재심층 감사 보고서 (Re-Audit)

- 작성일: 2026-02-26
- 기준 문서: `docs/gemini.md` (v2.11.0)
- 비교 대상: `docs/host-side-deep-audit-2026-02-26.md`
- 범위: `app/host/**`, `app/components/mobile/MobileHostMenu.tsx`, `app/components/mobile/BottomTabNavigation.tsx`, `app/hooks/useChat.ts`, 호스트 데이터에 직접 영향 주는 예약/결제 API

---

## 1) 재감사 결론 요약

- 기존 보고서의 핵심 이슈 18건은 **현 코드 기준 대부분 그대로 유효**합니다.
- 추가로, 운영 리스크가 큰 신규 이슈 4건을 확인했습니다.
- lint 재검증 결과: **114건 (error 72, warning 42)**

---

## 2) 기존 보고서와의 비교 (Validity Check)

### 2.1 기존 High 7건

모두 재현 확인됨.

- H-01 모바일 수익 집계 스코프 누락: `app/components/mobile/MobileHostMenu.tsx:42`
- H-02 모바일 메뉴 무한 로딩 가능성: `app/components/mobile/MobileHostMenu.tsx:25`
- H-03 예약 Realtime 전역 구독: `app/host/dashboard/components/ReservationManager.tsx:119`
- H-04 문의함 뒤로가기 루프: `app/host/dashboard/InquiryChat.tsx:33`, `app/host/dashboard/InquiryChat.tsx:165`
- H-05 예약 상태값 불일치(`paid`): `app/host/experiences/[id]/dates/page.tsx:47`, `app/host/experiences/[id]/dates/page.tsx:148`
- H-06 체험 수정 권한 스코프 누락: `app/host/experiences/[id]/edit/page.tsx:29`, `app/host/experiences/[id]/edit/page.tsx:98`
- H-07 높이 이중 고정: `app/host/dashboard/page.tsx:238`, `app/host/dashboard/components/ReservationManager.tsx:234`

### 2.2 기존 Medium/Low

기존 Medium/Low도 대부분 유효.
특히 아래는 그대로 재현됨.

- 정산 집계 상태 범위 문제: `app/host/dashboard/Earnings.tsx:55`
- 리뷰 스키마 불일치 가능성(`reviews.host_id`): `app/components/mobile/MobileHostMenu.tsx:54`
- fallback 아바타 누락: `app/host/dashboard/InquiryChat.tsx:51` + `public/default-avatar.png` 부재
- New 배지-필터 불일치: `app/host/dashboard/components/ReservationManager.tsx:215`, `app/host/dashboard/components/ReservationManager.tsx:263`
- 비로그인 시 로딩 해제 누락: `app/host/dashboard/MyExperiences.tsx:29`
- 생성/수정 이미지 버킷 불일치: `app/host/create/page.tsx:134`, `app/host/experiences/[id]/edit/page.tsx:118`
- 콜백 전달 대비 카드 UI 미사용: `app/host/dashboard/components/ReservationManager.tsx:329`, `app/host/dashboard/components/ReservationCard.tsx:26`

---

## 3) 신규 발견 이슈 (이번 재감사 추가)

### N-01 (High) 체험 수정 페이지 에러 시 로딩 영구 고착

- 증상: 조회 에러 시 `return`으로 빠져 `setLoading(false)`가 실행되지 않음
- 근거: `app/host/experiences/[id]/edit/page.tsx:30`, `app/host/experiences/[id]/edit/page.tsx:57`
- 영향: 특정 오류 상황에서 수정 화면이 무한 로딩 상태

### N-02 (High, Host-impacting) 레거시 결제 성공 페이지의 클라이언트 직접 상태 변경

- 증상: 클라이언트에서 `bookings.status = confirmed` 직접 업데이트 수행
- 근거: `app/payment/success/page.tsx:26`, `app/payment/success/page.tsx:28`
- 영향: 결제 검증 플로우를 우회한 예약 확정 데이터가 호스트 예약 대시보드에 반영될 수 있음
- 비고: 호스트 화면 무결성에 직접 영향

### N-03 (Medium) 호스트 재지원 시 승인 상태/역할 회귀 가능성

- 증상: 제출 payload가 `status: pending`, profile 업데이트가 `role: host_pending`으로 고정
- 근거: `app/host/register/page.tsx:153`, `app/host/register/page.tsx:172`
- 영향: 승인 호스트가 재제출 시 상태 회귀(권한/접근 플로우 혼선) 가능

### N-04 (Medium) 채팅 Realtime 중복 억제 로직으로 이벤트 유실 가능

- 증상: 전역 채널 + 500ms 단일 타임스탬프 억제로 근접 다중 이벤트 손실 가능
- 근거: `app/hooks/useChat.ts:284`, `app/hooks/useChat.ts:291`
- 영향: 빠르게 연속 도착하는 메시지에서 목록/읽음 상태 갱신 누락 가능

---

## 4) 추가/수정/개선 권고안

## 4.1 추가할 것 (Add)

1. `BookingStatus` 상수/타입 단일화 모듈 추가 (`PENDING/PAID/confirmed/completed/cancelled/...`)
2. 호스트 소유권 검증 유틸 추가 (`hostScope(experience_id, user_id)`)
3. `public/default-avatar.png` 추가 또는 안전한 기본 이미지 컴포넌트 도입
4. 호스트 영역 Realtime 이벤트 필터 가드 추가(이벤트 payload 단계에서 host ownership 확인)

## 4.2 수정할 것 (Modify)

1. `MobileHostMenu` 수익 집계에 host 스코프 조인 필수 적용
2. `MobileHostMenu`/`MyExperiences` 비로그인 early return 전 `setLoading(false)` 보장
3. `dates/page.tsx` 상태 필터를 `paid -> PAID`로 정정
4. `edit/page.tsx` 조회/수정 쿼리에 `host_id = currentUser.id` 조건 병행
5. `edit/page.tsx` 조회 실패 경로에서 `setLoading(false)` 실행 보장
6. `ReservationManager` Realtime 구독을 host 범위로 제한 + 오탐 알림 발송 차단
7. `InquiryChat` 뒤로가기 시 URL `guestId` 파라미터 제거
8. 레거시 `app/payment/success/page.tsx`의 직접 상태 업데이트 제거(서버 검증 경로만 허용)

## 4.3 개선할 것 (Improve)

1. 호스트 핵심 경로 E2E 추가
- 예약 생성(PENDING) -> 입금확정(PAID/confirmed) -> 취소/정산 분기
2. Realtime 부하/중복 테스트 추가
- 다중 메시지 burst, 다중 탭 동시 접속
3. lint 게이트 강화
- host 경로에서 `no-explicit-any`, `react-hooks/exhaustive-deps` 우선 정리
4. 운영 문서 동기화
- `docs/gemini.md`의 상태값 표와 실제 코드 상태값 집계를 동일한 상수로 관리

---

## 5) 우선순위 실행 순서 (권장)

1. P0: N-02, H-01, H-03, H-05, H-06, N-01
2. P1: H-04, M-01, M-02, M-03, M-04, N-03
3. P2: M-07, M-08, N-04
4. P3: Lint/타입 정리, 문서/테스트 강화

---

## 6) 재감사 메모

- 이번 재감사는 “수정 없는 진단” 기준으로 수행했습니다.
- 실제 코드 수정 단계에서는 `docs/gemini.md` 규칙(특히 `.maybeSingle()`, Realtime 정리, 핀셋 수정)을 그대로 적용하는 것이 안전합니다.
