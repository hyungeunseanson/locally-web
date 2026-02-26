# 호스트 사이드 심층 점검 보고서 (수정 없음)

- 작성일: 2026-02-26
- 대상: Host 영역 모바일/데스크탑 UX·UI, 데이터, 기능 로직
- 원칙: 코드 수정 없이 현 상태 리스크 식별 및 우선순위 제시

## 1) 점검 범위

### 주요 점검 파일
- `app/host/dashboard/page.tsx`
- `app/host/dashboard/components/ReservationManager.tsx`
- `app/host/dashboard/components/ReservationCard.tsx`
- `app/host/dashboard/InquiryChat.tsx`
- `app/hooks/useChat.ts`
- `app/host/dashboard/Earnings.tsx`
- `app/host/dashboard/MyExperiences.tsx`
- `app/host/dashboard/HostReviews.tsx`
- `app/host/dashboard/components/ProfileEditor.tsx`
- `app/host/dashboard/components/GuestProfileModal.tsx`
- `app/host/dashboard/components/GuestReviewModal.tsx`
- `app/components/mobile/MobileHostMenu.tsx`
- `app/components/mobile/BottomTabNavigation.tsx`
- `app/host/create/page.tsx`
- `app/host/create/components/ExperienceFormSteps.tsx`
- `app/host/register/page.tsx`
- `app/host/register/components/HostRegisterForm.tsx`
- `app/host/experiences/[id]/edit/page.tsx`
- `app/host/experiences/[id]/dates/page.tsx`
- `app/host/experiences/[id]/page.tsx`

### 보조 검증
- `npm run -s lint app/host app/components/mobile/MobileHostMenu.tsx app/hooks/useChat.ts`
- 결과: 112건 (error 72, warning 40)

## 2) 총평

핵심 기능은 전반적으로 동작하지만, 실제 운영 시 영향을 크게 줄 수 있는 이슈가 다수 존재합니다.
특히 **호스트 데이터 범위 누락(수익 계산), 실시간 이벤트 범위 누락, 모바일 채팅 뒤로가기 루프, 예약 상태값 불일치**는 우선 수정이 필요합니다.

---

## 3) 우선순위 이슈 (High)

### H-01. 모바일 호스트 수익 카드가 타 호스트 데이터까지 집계될 위험
- 증상: 월 수익 집계 쿼리에 호스트 필터 없음
- 근거: `app/components/mobile/MobileHostMenu.tsx:42`~`app/components/mobile/MobileHostMenu.tsx:46`
- 영향: 모바일 메뉴 수익 카드가 플랫폼 전체/타인 데이터로 오염될 수 있음

### H-02. 모바일 호스트 메뉴 무한 로딩 가능성
- 증상: 비로그인 시 `return` 후 `setLoading(false)` 미실행
- 근거: `app/components/mobile/MobileHostMenu.tsx:24`~`app/components/mobile/MobileHostMenu.tsx:26`, `app/components/mobile/MobileHostMenu.tsx:61`
- 영향: 로딩 스피너 고착

### H-03. 호스트 대시보드 실시간 예약 이벤트가 전체 bookings를 구독
- 증상: realtime 구독이 호스트 스코프 없이 모든 bookings 이벤트 수신
- 근거: `app/host/dashboard/components/ReservationManager.tsx:118`~`app/host/dashboard/components/ReservationManager.tsx:120`, `app/host/dashboard/components/ReservationManager.tsx:126`~`app/host/dashboard/components/ReservationManager.tsx:145`
- 영향: 타 호스트 이벤트에도 토스트/알림 노출 가능

### H-04. 모바일 문의함 뒤로가기 무력화 루프 가능
- 증상: `guestId` 파라미터 기반 자동 오픈 useEffect + 뒤로가기에서 파라미터 유지
- 근거: `app/host/dashboard/InquiryChat.tsx:33`~`app/host/dashboard/InquiryChat.tsx:43`, `app/host/dashboard/InquiryChat.tsx:163`~`app/host/dashboard/InquiryChat.tsx:166`
- 영향: 모바일에서 채팅 목록으로 복귀해도 다시 방 자동 진입

### H-05. 일정관리 예약 보호 로직의 상태값 불일치 (`paid` vs `PAID`)
- 증상: 활성 예약 체크에서 소문자 `paid` 사용
- 근거: `app/host/experiences/[id]/dates/page.tsx:47`, `app/host/experiences/[id]/dates/page.tsx:148`
- 교차 근거: 실제 예약 생성은 `PENDING`/`PAID` 체계 사용 (`app/api/bookings/route.ts:56`, `app/api/bookings/route.ts:81`)
- 영향: 예약 있는 슬롯이 빈 슬롯처럼 처리될 가능성

### H-06. 체험 수정 페이지 권한 스코프 확인 미흡
- 증상: 조회/수정이 `id` 조건만 사용
- 근거: `app/host/experiences/[id]/edit/page.tsx:29`, `app/host/experiences/[id]/edit/page.tsx:98`
- 영향: RLS 설정이 느슨할 경우 타 호스트 체험 수정 리스크

### H-07. 데스크탑/모바일 예약 화면 높이 이중 고정으로 가시성 저하
- 증상: 부모 고정 높이 + 자식 `h-[80vh]` 동시 적용
- 근거: `app/host/dashboard/page.tsx:238`, `app/host/dashboard/components/ReservationManager.tsx:234`
- 영향: 일부 뷰포트에서 리스트/입력 영역 과도 스크롤, 정보 한눈 가시성 저하

---

## 4) 중간 우선순위 이슈 (Medium)

### M-01. 정산 집계에 확정 전 상태 포함 가능
- 증상: `declined`, `cancellation_requested`만 제외
- 근거: `app/host/dashboard/Earnings.tsx:55`~`app/host/dashboard/Earnings.tsx:56`
- 영향: `PENDING` 등 미확정 건이 정산 지표에 포함될 수 있음

### M-02. 모바일 호스트 메뉴 리뷰 집계 쿼리 스키마 불일치 가능성
- 증상: `reviews.host_id` 직접 조건 사용
- 근거: `app/components/mobile/MobileHostMenu.tsx:53`~`app/components/mobile/MobileHostMenu.tsx:55`
- 교차 근거: 후기 저장 API는 `reviews`에 `host_id`를 쓰지 않고 `experience_id` 중심 (`app/api/reviews/route.ts:50`~`app/api/reviews/route.ts:53`)
- 영향: 리뷰 요약 0건 고정/오집계 가능

### M-03. 문의함 아바타 fallback 경로 누락
- 증상: `/default-avatar.png` 사용하지만 정적 파일 부재
- 근거: `app/host/dashboard/InquiryChat.tsx:51`, `public/` 내 해당 파일 없음
- 영향: 이미지 404 반복 요청

### M-04. 예약 카드의 예정 탭 New 배지 판정이 필터와 불일치
- 증상: 예정 탭 필터는 `PENDING` 포함, New 배지는 `PAID/confirmed`만 판정
- 근거: `app/host/dashboard/components/ReservationManager.tsx:215`, `app/host/dashboard/components/ReservationManager.tsx:263`
- 영향: 탭 배지와 실제 목록 체감 불일치

### M-05. 내 체험 목록에서 비로그인 시 로딩 해제 누락
- 증상: 사용자 없으면 조기 return
- 근거: `app/host/dashboard/MyExperiences.tsx:28`~`app/host/dashboard/MyExperiences.tsx:29`, `app/host/dashboard/MyExperiences.tsx:38`
- 영향: 로딩 고착 가능

### M-06. 체험 상세 페이지가 현재 데이터 모델과 불일치
- 증상: 이미지 `image_url`, 위치 `location`, 상태 텍스트를 정적 처리
- 근거: `app/host/experiences/[id]/page.tsx:86`, `app/host/experiences/[id]/page.tsx:97`, `app/host/experiences/[id]/page.tsx:130`
- 영향: 실제 데이터와 다른 화면 표시

### M-07. 이미지 업로드 버킷 불일치
- 증상: 생성은 `experiences` 버킷, 수정은 `images` 버킷 사용
- 근거: `app/host/create/page.tsx:134`, `app/host/experiences/[id]/edit/page.tsx:118`
- 영향: 정책/권한/관리 경로 분산으로 운영 리스크 증가

### M-08. 예약 카드에서 게스트 프로필/취소문의 동작 경로가 사실상 비활성
- 증상: 매니저는 콜백 전달하지만 카드 내 호출 UI 없음
- 근거: `app/host/dashboard/components/ReservationManager.tsx:329`, `app/host/dashboard/components/ReservationManager.tsx:333`, `app/host/dashboard/components/ReservationCard.tsx:26`
- 영향: 설계 의도 대비 기능 누락

---

## 5) 낮은 우선순위 이슈 (Low)

### L-01. 이미지 정책/접근성 품질
- 다수 컴포넌트가 `<img>` 사용 및 일부 `alt` 누락
- lint 근거 다수 (`@next/next/no-img-element`, `jsx-a11y/alt-text`)

### L-02. 국제화 일관성 부족
- 호스트 영역에 하드코딩 한국어 텍스트 다수
- 예: `app/host/dashboard/page.tsx:164`, `app/host/dashboard/page.tsx:206`, `app/host/dashboard/components/ReservationCard.tsx:64`, `app/host/dashboard/components/ReservationCard.tsx:165`, `app/host/dashboard/components/ReservationCard.tsx:197`

### L-03. 문구/로직 불일치
- 생성 2단계 문구는 최대 5장, 실제 로직은 최대 10장
- 근거: `app/host/create/components/ExperienceFormSteps.tsx:104`, `app/host/create/page.tsx:87`

---

## 6) lint 기반 구조 리스크 요약

- `any` 타입 과다 사용: 도메인 모델 안정성 저하 및 회귀 위험 증가
- Hook dependency 경고 다수: 상태 동기화/실시간 갱신 타이밍 불안정 가능
- 핵심 참고:
  - `app/host/dashboard/MyExperiences.tsx:24` (함수 선언/사용 순서 관련 리스크 경고)
  - `app/hooks/useChat.ts:110`, `app/hooks/useChat.ts:314`
  - `app/host/dashboard/components/ReservationManager.tsx:112`, `app/host/dashboard/components/ReservationManager.tsx:150`

---

## 7) 권장 수정 우선순위 (실행 순서 제안)

1. H-01, H-03, H-05, H-06 (데이터/권한/실시간 범위)
2. H-04, H-07 (모바일 뒤로가기/레이아웃 가시성)
3. M-01, M-02, M-03, M-04 (정산/리뷰/채팅 정확도)
4. M-06, M-07, M-08 (도메인 일관성 및 누락 기능)
5. L-01, L-02, L-03 + lint 에러 정리

---

## 8) 결론

현재 호스트 사이드는 사용 가능 상태이나, 운영 데이터 신뢰성과 모바일 UX 완성도 관점에서 우선 보완이 필요한 구간이 명확합니다.
본 문서는 **수정 없이 진단 결과만 기록**한 심층 보고서입니다.
