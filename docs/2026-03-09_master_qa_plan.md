# Locally 런칭 전 마스터 점검 계획 (Master QA Plan)

## 요약
이 계획은 로컬리의 실제 코드베이스 기준으로, 배포 전 점검을 `게스트 -> 호스트 -> 관리자` 3단계로 나눠 순차 수행하기 위한 로드맵이다. 각 단계는 단순 화면 확인이 아니라 `페이지/컴포넌트/훅/API`를 함께 묶어 분석하며, 매 단계마다 반드시 아래 5개 관점으로 결과를 정리한다.

- `취약점 및 에러`: 인증, 권한, 결제 검증, 예외 처리, 콘솔/네트워크 에러
- `비효율성`: 중복 fetch, 과한 state/effect, 느린 렌더, 비싼 쿼리
- `UI/UX 디자인`: 반응형, 카드/레이아웃, 버튼 피드백, 정보 위계
- `텍스트 및 카피`: 번역투, 오타, 어조 불일치, 상태 문구 혼선
- `사용자 경험`: 다음 행동이 불명확한 지점, 막히는 흐름, 전환 혼란

실행 시 각 단계의 산출물은 아래 형식으로 통일한다.

- `Flow Map`: 사용자 흐름, 관련 페이지, 관련 API
- `Issue Log`: 심각도 `P0/P1/P2/P3`, 재현 절차, 영향 범위, 파일 기준
- `Fix Queue`: 즉시 수정 가능 항목 / 구조 개선 필요 항목 분리
- `Regression Watchlist`: 후속 단계에서 다시 확인할 회귀 위험

## 공통 준비

### 점검 전제 조건
- 테스트 계정 6종 확보
  - 신규 게스트
  - 예약 이력 있는 게스트
  - 승인된 호스트
  - `pending/revision/rejected` 상태 호스트
  - 관리자 화이트리스트 계정
  - 서비스 매칭 데이터가 있는 고객/호스트 계정
- 결제 환경
  - 일반 체험 NicePay sandbox
  - 서비스 매칭 NicePay sandbox
  - 무통장 입금 경로 확인용 환경변수
- 데이터 준비
  - 활성 체험 / 매진 직전 체험 / private enabled 체험
  - 다가오는 예약 / 지난 예약 / 취소 요청 / 환불 케이스
  - 서비스 요청 `pending_payment/open/matched/cancelled`
- 뷰포트 기준
  - 모바일 `390x844`
  - 태블릿 `768x1024`
  - 데스크탑 `1440px+`
- 언어 기준
  - 한국어는 전체 정밀 점검
  - 영어/일본어/중국어는 핵심 플로우 스모크 점검

### 공통 점검 방식
1. 라우트 기준으로 화면 진입점 확인
2. 각 화면의 fetch/API 경로 추적
3. 정상 흐름 확인
4. 실패 흐름과 예외 흐름 확인
5. 모바일/데스크탑 비교
6. 카피/상태 문구/토스트/빈 상태 문구 점검
7. 단계 종료 시 이슈 목록과 수정 우선순위 확정

## 1단계: 게스트 사이드 전체 플로우 및 코드 분석

### 1-1. 점검 범위
핵심 대상 페이지와 진입점

- 홈/탐색
  - `app/page.tsx`
  - `app/components/HomePageClient.tsx`
  - `app/components/SiteHeader.tsx`
  - `app/search/page.tsx`
- 체험 상세/예약/결제
  - `app/experiences/[id]/page.tsx`
  - `app/experiences/[id]/ExperienceClient.tsx`
  - `app/experiences/[id]/payment/page.tsx`
  - `app/experiences/[id]/payment/complete/page.tsx`
  - `app/api/bookings/route.ts`
  - `app/api/payment/nicepay-callback/route.ts`
  - `app/api/payment/cancel/route.ts`
- 여행 관리/영수증/리뷰
  - `app/guest/trips/page.tsx`
  - `app/guest/trips/hooks/useGuestTrips.ts`
  - `app/guest/trips/components/TripCard.tsx`
  - `app/guest/trips/components/PastTripCard.tsx`
- 메시지
  - `app/guest/inbox/page.tsx`
  - `app/hooks/useChat.ts`
  - `app/api/inquiries/thread/route.ts`
  - `app/api/inquiries/message/route.ts`
- 마이페이지/위시리스트/알림
  - `app/account/page.tsx`
  - `app/guest/wishlists/page.tsx`
  - `app/notifications/page.tsx`
- 맞춤 의뢰 guest 플로우
  - `app/services/intro/page.tsx`
  - `app/services/request/page.tsx`
  - `app/services/my/page.tsx`
  - `app/services/[requestId]/page.tsx`
  - `app/services/[requestId]/payment/page.tsx`
  - `app/api/services/requests/route.ts`
  - `app/api/services/payment/nicepay-callback/route.ts`
  - `app/api/services/cancel/route.ts`

### 1-2. 점검할 핵심 플로우
1. 홈 진입 -> 검색 -> 체험 상세 진입
2. 체험 상세 -> 날짜/시간/인원 선택 -> 결제 진입
3. 카드 결제 / 무통장 결제 -> 완료 페이지 -> 여행 내역 반영
4. 예약 후 알림/메시지/영수증/취소 요청 진입
5. 지난 여행 -> 리뷰 작성 흐름
6. 게스트 프로필 수정 및 공개 정보 확인
7. 위시리스트 저장/해제
8. 맞춤 의뢰 등록 -> 결제 -> 내 의뢰 -> 상세 확인
9. 맞춤 의뢰에서 호스트 지원 수신 후 다음 행동 인지 가능 여부
10. 로그인 없는 상태에서 보호 페이지 진입 시 리다이렉션/복귀 흐름

### 1-3. 5대 관점 체크리스트
#### 취약점 및 에러
- 로그인 없는 예약/결제/메시지 진입 차단이 일관적인가
- 예약 생성 API가 클라이언트 조작 값이 아니라 서버 검증값을 기준으로 처리하는가
- NicePay 콜백에서 금액/서명/중복 승인 방지가 충분한가
- 메시지 API가 본인 스레드 외 접근을 막는가
- `service request` 취소/선택/결제 완료 후 상태 꼬임이 없는가
- 실패 시 토스트만 뜨고 실제 화면 상태는 갱신되지 않는 구간이 없는가
- 콘솔 에러, hydration 경고, 이미지/네트워크 실패가 방치되는가

#### 비효율성
- 검색 화면에서 필터 변경 시 fetch/렌더가 과도하게 반복되는가
- 상세/결제/계정 페이지에서 `useEffect` 체인이 불필요하게 많은가
- 알림/메시지/여행 목록이 중복 조회되는가
- 홈/검색/상세 카드 이미지가 비효율적으로 로드되는가
- 서비스 요청 목록과 일반 예약 목록이 함께 있을 때 초기 로딩 체감이 나빠지는가

#### UI/UX 디자인
- 모바일 상세 페이지의 sticky action sheet, 날짜 선택, CTA 위치가 자연스러운가
- 결제 입력 폼이 모바일에서 답답하거나 스크롤이 끊기지 않는가
- 여행 카드와 서비스 요청 카드의 정보 위계가 일관적인가
- 메시지 화면 모바일 리스트/대화 전환이 갑작스럽지 않은가
- 마이페이지 버튼, 모달, 프로필 이미지 업로드 UI가 앱처럼 반응하는가

#### 텍스트 및 카피
- 예약/취소/환불/결제 상태 문구가 사용자 언어로 명확한가
- 서비스 요청 카피가 일반 예약 카피와 톤 충돌이 없는가
- 토스트/에러 메시지가 원인과 다음 행동을 알려주는가
- 한국어 기준 번역투/과한 직역/용어 혼용이 없는가
- 영문/일문/중문 핵심 버튼 라벨 길이가 UI를 깨지 않는가

#### 사용자 경험
- 검색 후 필터 리셋, 뒤로가기, 상세 복귀 흐름이 자연스러운가
- 예약 완료 후 사용자가 어디서 내 예약/메시지/영수증을 보는지 명확한가
- 취소 요청 후 상태 변화와 다음 안내가 충분한가
- 메시지 첫 문의와 기존 문의 진입 규칙이 직관적인가
- 맞춤 의뢰 결제 후 “이제 무엇이 일어나는지”가 충분히 설명되는가

### 1-4. 1단계 산출물
- 게스트 플로우 맵
- `P0/P1/P2/P3` 이슈 리스트
- 결제/메시지/마이페이지 회귀 위험 목록
- 게스트 기준 즉시 수정 우선순위 Top 10

## 2단계: 호스트 사이드 전체 플로우 및 코드 분석

### 2-1. 점검 범위
핵심 대상 페이지와 진입점

- 호스트 진입/지원/상태별 접근
  - `app/become-a-host/page.tsx`
  - `app/host/register/page.tsx`
  - `app/host/menu/page.tsx`
  - `app/host/dashboard/page.tsx`
- 체험 등록/수정/일정
  - `app/host/create/page.tsx`
  - `app/host/create/components/ExperienceFormSteps.tsx`
  - `app/host/experiences/[id]/edit/page.tsx`
  - `app/host/experiences/[id]/dates/page.tsx`
- 예약 관리/게스트 대응
  - `app/host/dashboard/components/ReservationManager.tsx`
  - `app/host/dashboard/components/ReservationCard.tsx`
  - `app/host/dashboard/components/GuestProfileModal.tsx`
  - `app/host/dashboard/components/GuestReviewModal.tsx`
- 체험 관리/문의/정산/후기/프로필
  - `app/host/dashboard/MyExperiences.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/components/GuidelinesTab.tsx`
- 맞춤 의뢰 호스트 플로우
  - `app/services/page.tsx`
  - `app/services/[requestId]/apply/page.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/api/services/applications/route.ts`
  - `app/api/services/start-chat/route.ts`

### 2-2. 점검할 핵심 플로우
1. 호스트 지원서 작성/재제출
2. `pending/revision/rejected/approved` 상태별 대시보드 접근 제어
3. 체험 등록 1~7단계 완료 및 업로드/검증 흐름
4. 체험 수정 후 공개 상세 반영 확인
5. 일정 추가/삭제와 확정 예약 충돌 처리
6. 예약 관리에서 다가오는 일정/지난 일정/취소 환불/메시지/캘린더 액션
7. 문의 응답과 게스트 프로필 확인
8. 정산/수익 수치의 상태별 집계 정확성
9. 후기 확인과 게스트 리뷰 작성 유도 흐름
10. 맞춤 의뢰 지원 -> 선택 대기 -> 진행중 상태 흐름

### 2-3. 5대 관점 체크리스트
#### 취약점 및 에러
- 승인 전 호스트가 접근하면 안 되는 탭에 들어갈 수 없는가
- 체험 수정/삭제/API 호출이 본인 체험만 허용되는가
- 일정 삭제 시 확정 예약 보호가 서버 기준으로 되는가
- 예약 취소/환불 승인 액션이 UI 상태와 DB 상태를 일치시키는가
- 프로필/정산 계좌/신분증 파일 경로가 노출되지 않는가
- 서비스 지원에서 자기 의뢰 지원, 마감 의뢰 지원이 차단되는가

#### 비효율성
- 대시보드 탭 전환 시 데이터 전체를 매번 다시 불러오는가
- 예약 카드/체험 카드 리스트가 모바일에서 과렌더링 되는가
- 이미지 업로드와 폼 단계 이동이 불필요하게 무거운가
- 문의/정산/리뷰 탭이 한 페이지에 몰려 성능 병목을 만드는가
- 서비스 잡 보드가 polling/realtime 없이 stale 상태가 오래 유지되는가

#### UI/UX 디자인
- 모바일 대시보드 카드 정보 위계가 데스크탑과 단절되지 않는가
- 체험 등록 단계의 입력 폼 밀도와 버튼 위치가 안정적인가
- 일정 관리 달력/시간표 UI가 작은 화면에서도 오조작 없이 동작하는가
- 예약 관리 CTA가 아이콘만으로 축소되지 않는가
- 프로필 편집, 파일 업로드, 정산 정보 입력 영역이 신뢰감 있게 보이는가

#### 텍스트 및 카피
- 호스트 안내 문구가 `신청/심사/승인/가이드라인` 단계와 맞는가
- 정산/예약/취소 상태 라벨이 실제 의미와 일치하는가
- 수정 요청 사유, 거절 사유, 경고 카피가 지나치게 딱딱하거나 불친절하지 않은가
- 체험 등록 폼 라벨이 여행 호스트 문맥에 맞는가
- 서비스 의뢰 지원 카피가 일반 체험 호스팅 카피와 충돌하지 않는가

#### 사용자 경험
- 승인 전 호스트가 무엇을 해야 하는지 명확한가
- 체험 등록 후 다음 단계가 `일정 관리`인지 `공개 확인`인지 분명한가
- 예약이 들어왔을 때 호스트가 즉시 `누가/언제/무엇/무슨 상태`인지 파악 가능한가
- 취소 요청/환불 요청 처리 흐름이 막히지 않는가
- 맞춤 의뢰 지원 후 대기 상태와 선택 이후 행동이 분명한가

### 2-4. 2단계 산출물
- 호스트 온보딩/운영 플로우 맵
- 모바일 대시보드/등록폼 UX 문제 목록
- 정산/예약/서비스 매칭 상태 전이 이슈 목록
- 호스트 우선 개선 항목 Top 10

## 3단계: 관리자 사이드 전체 플로우 및 코드 분석

### 3-1. 점검 범위
핵심 대상 페이지와 진입점

- 관리자 대시보드/사이드바/탭 구조
  - `app/admin/dashboard/page.tsx`
  - `app/admin/dashboard/components/Sidebar.tsx`
- 승인/유저/운영 탭
  - `app/admin/dashboard/components/ManagementTab.tsx`
  - `app/admin/dashboard/components/UsersTab.tsx`
  - `app/admin/dashboard/components/ChatMonitor.tsx`
  - `app/admin/dashboard/components/TeamTab.tsx`
- 정산/매출/분석
  - `app/admin/dashboard/components/MasterLedgerTab.tsx`
  - `app/admin/dashboard/components/SalesTab.tsx`
  - `app/admin/dashboard/components/AnalyticsTab.tsx`
- 서비스 매칭 관리
  - `app/admin/dashboard/components/ServiceAdminTab.tsx`
  - `app/admin/dashboard/hooks/useAdminData.ts`
  - `app/admin/dashboard/hooks/useServiceAdminData.ts`
- 관리자 API
  - `app/api/admin/bookings/route.ts`
  - `app/api/admin/host-applications/route.ts`
  - `app/api/admin/service-bookings/route.ts`
  - `app/api/admin/service-confirm-payment/route.ts`
  - `app/api/admin/service-cancel/route.ts`
  - `app/api/admin/sidebar-counts/route.ts`
  - `app/api/admin/team-counts/route.ts`
  - `app/api/admin/notify-team/route.ts`

### 3-2. 점검할 핵심 플로우
1. 관리자 로그인 및 탭 복원
2. 호스트 승인/보완/거절 처리
3. 유저 조회/삭제/상태 확인
4. 예약 원장과 미열람 예약 카운트 반영
5. 매출/정산 수치 검증
6. 서비스 요청 탭에서 무통장 입금 확인, 취소/환불 처리
7. CS 채팅 모니터링 및 관리자 선개입 흐름
8. 팀 워크스페이스 알림/카운트/실시간 반영
9. 분석 탭 지표와 실데이터 정합성
10. 권한 없는 사용자의 admin 진입 차단

### 3-3. 5대 관점 체크리스트
#### 취약점 및 에러
- 화이트리스트/role 체크가 우회되지 않는가
- 관리자 API가 서비스 키/RLS 우회 사용 시도에도 최소 권한 원칙을 지키는가
- 승인/거절/삭제 액션의 감사 흔적과 실패 처리 가시성이 충분한가
- 서비스 무통장 입금 확인/강제 환불이 중복 실행되지 않는가
- 팀 알림 수신 대상이 `admin_whitelist` 단일 소스를 따르는가
- 민감 정보가 테이블/상세 패널/console에 과다 노출되지 않는가

#### 비효율성
- `useAdminData`와 `useServiceAdminData`가 중복 호출/무거운 join을 유발하지 않는가
- 탭별로 필요 없는 데이터까지 전부 선로딩하는가
- 실시간 채널이 정리되지 않아 누수되는가
- 사이드바 카운트/팀 카운트 polling이 과도한가
- 대량 데이터에서 정렬/필터링이 브라우저에 과도하게 몰리는가

#### UI/UX 디자인
- 모바일 admin 사이드바/오버레이가 실사용 가능한 수준인지
- 승인/정산/서비스 요청 테이블이 정보 밀도와 조작성을 모두 만족하는지
- 상세 패널과 리스트 패널 간 초점 이동이 자연스러운지
- 숫자/KPI 카드의 강조 우선순위가 실제 운영 중요도와 맞는지
- 경고/확정/실행 버튼이 위험도를 충분히 드러내는지

#### 텍스트 및 카피
- 운영 용어가 일관적인가
  - 승인/보완/거절
  - 정산 대기/입금 확인/취소 환불
  - 서비스 요청/일반 예약
- 관리자 액션 확인 문구가 오작동을 줄이도록 충분히 구체적인가
- 테이블 상태 라벨이 데이터 실제 상태와 어긋나지 않는가
- 운영자 전용 화면인데도 애매한 사용자향 카피가 섞여 있지 않은가

#### 사용자 경험
- 운영자가 `무엇부터 봐야 하는지`가 사이드바와 카운트로 명확한가
- 미답변 CS, 입금 대기, 신규 승인 요청이 우선순위대로 드러나는가
- 상세 패널에서 실행한 액션 결과가 리스트와 즉시 동기화되는가
- 탭 이동 후 복귀 시 컨텍스트가 유지되는가
- 서비스 요청과 일반 예약이 혼동되지 않는가

### 3-4. 3단계 산출물
- 관리자 운영 플로우 맵
- 권한/정산/서비스 요청 리스크 목록
- 운영 관점 P0/P1 이슈 정리
- 런칭 전 관리자 필수 보완 항목 Top 10

## 단계 공통 테스트 케이스 및 시나리오

### 핵심 시나리오
1. 비로그인 사용자가 보호 페이지에 직접 진입
2. 로그인 만료 상태에서 결제/메시지/저장 액션 수행
3. 일반 예약 카드 결제 성공/실패/중복 콜백
4. 일반 예약 무통장 흐름
5. 서비스 의뢰 결제 성공/실패/무통장/취소
6. 예약 후 메시지 시작, 기존 문의 재진입, 잘못된 쿼리 파라미터 진입
7. 모바일에서 탭/버튼 연타 시 중복 액션 여부
8. 빈 상태, 로딩 상태, 에러 상태, 데이터 없는 상태
9. 한국어/영어 핵심 플로우 문구 길이 차이에 따른 UI 깨짐
10. 모바일과 데스크탑 간 정보 위계 일관성

### 이슈 분류 기준
- `P0`: 결제/권한/데이터 손상/개인정보 유출/서비스 중단
- `P1`: 핵심 플로우 차단, 잘못된 상태 전이, 심각한 UX 혼선
- `P2`: 기능은 되지만 신뢰감 저하, 반응형/카피/피드백 미흡
- `P3`: 경미한 문구/스타일/잔여 최적화

## 공개 API / 인터페이스 / 타입 변경
- 계획 단계에서는 코드 수정, API 변경, 타입 변경 없음
- 산출물은 코드 변경이 아니라 QA 문서와 이슈 목록
- 실제 분석 단계에서 구조 변경이 필요해지면 별도 제안서로 분리
  - API 변경안
  - 타입 변경안
  - 마이그레이션 필요 여부
  - 회귀 영향 범위

## 가정 및 기본값
- 게스트/호스트/관리자 점검에는 `일반 체험 예약`과 `서비스 매칭`을 모두 포함한다
- 커뮤니티/도움말/회사 소개 페이지는 핵심 거래 플로우는 아니므로 스모크 수준으로만 포함한다
- 현재 코드베이스에는 별도 `사이트 설정` 관리자 화면이 확인되지 않았다
  - 따라서 3단계에서는 구현된 admin 탭 우선 점검
  - 운영 설정 관련 항목은 환경변수, 상수, 알림/이메일/카운트 경로의 갭 점검으로 대체
- 1차 분석은 한국어 기준으로 깊게 수행하고, 다국어는 핵심 플로우 스모크 검증으로 제한한다
- 각 단계는 이전 단계의 회귀 위험을 carry-over 항목으로 넘긴다
- 계획 승인 후 실제 분석은 1단계 게스트 사이드부터 시작한다
