# Changelog

## 2026-03-28 — Performance Follow-up: Search SubCity, Reservation Safety, BFCache Guard

### Search / Experience Detail
- **Search card location rollback fix**: desktop search card가 다시 `subCity`까지 받을 수 있도록 search projection에 `subCity` 복구
- **BFCache-only availability refresh**: 체험 상세 `pageshow` availability refresh를 BFCache 복귀(`persisted`) 시에만 실행하도록 가드 추가

### ReservationManager Safety
- **Reservation type alignment**: `ReservationManager`의 booking/guest/experience 타입을 실제 select 필드에 맞게 정리하고 정산 계산에 쓰는 금액 필드를 타입에 반영
- **Review lookup fallback**: `guest_reviews` 조회 실패 시 stale `reviewedBookingIds`를 유지하지 않고 안전하게 초기화하도록 보강

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `app/search/searchContract.ts` | search card projection에 `subCity` 복구 |
| `app/host/dashboard/components/ReservationManager.tsx` | reservation query 결과 타입 정합성 보강, guest review lookup 실패 시 fallback 처리 |
| `app/experiences/[id]/ExperienceClient.tsx` | `pageshow` refresh를 BFCache 복귀 시에만 실행하도록 가드 추가 |

---
## 2026-03-28 — Performance Phase 1E: Admin Users Summary Projection Trim

### Users Summary Payload
- **Profiles projection trim**: `/api/admin/users-summary`가 `profiles.select('*')` 대신 UsersTab 리스트/상세 패널/검색에 실제 필요한 기본 필드만 조회하도록 축소
- **Role merge kept**: `users` 테이블의 `role` 병합과 응답 배열 구조는 유지하여 admin users UI 동작 회귀 없이 payload만 경량화

### Admin Data Hook
- **Typed dashboard rows**: `useAdminUsersData`가 admin users summary 응답을 `AdminUserDashboardRow[]`로 직접 다루도록 정리하여 실제 소비 필드와 데이터 계약을 일치시킴

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `app/api/admin/users-summary/route.ts` | wide `profiles.select('*')` 제거, UsersTab 소비 필드 기준 projection 축소 |
| `app/admin/dashboard/hooks/useAdminUsersData.ts` | users state를 `AdminUserDashboardRow[]`로 정리 |

---
## 2026-03-28 — Performance Phase 1D: ReservationManager Payload & Realtime Trim

### Reservation Payload
- **Bookings projection trim**: `ReservationManager`가 예약 카드/게스트 프로필/환불 처리에 실제 필요한 booking, guest, experience 필드만 조회하도록 `bookings` select 축소
- **Guest review scope trim**: `guest_reviews` 조회를 호스트 전체 후기 기준이 아니라, 현재 로드된 reservation booking ID 집합으로 제한

### Realtime Refresh
- **Debounced refresh**: booking realtime burst 시 즉시 목록 전체를 다시 읽지 않고 debounce 후 background refresh 하도록 조정
- **Cached host user lookup**: `auth.getUser()` 결과를 ref에 캐시하여 realtime 이벤트마다 반복적으로 auth 경로를 타지 않도록 조정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `app/host/dashboard/components/ReservationManager.tsx` | booking/guest projection 축소, guest review 조회 범위 축소, realtime refresh debounce 및 host user lookup 캐시 |

---
## 2026-03-28 — Performance Phase 1B: Experience Detail Hot Path

### Experience Detail Server Fetch
- **Metadata projection trim**: `generateMetadata`가 체험 상세 SEO 출력에 필요한 다국어 제목/설명, 대표 이미지, 공개 여부 필드만 조회하도록 `select('*')` 제거
- **Page body projection trim**: 체험 상세 렌더/예약 카드/JSON-LD에 실제 필요한 필드만 조회하도록 상세 페이지 body projection 축소
- **Host profile projection trim**: 호스트 카드/모달에 필요한 프로필 및 공개 호스트 신청서 필드만 조회하도록 projection 축소
- **Parallel detail hydration**: 체험 availability summary와 호스트 프로필 조립을 병렬 실행하여 첫 진입 server fetch 대기 시간 축소

### Availability Refresh
- **Initial summary reuse**: 서버에서 계산한 availability summary 전체를 client initial state로 재사용
- **Duplicate fetch removal**: 체험 상세 첫 진입 직후 실행되던 클라이언트 `no-store` availability 재요청 제거
- **BFCache refresh kept**: `pageshow` 기반 availability refresh는 유지하여 BFCache 복귀 시 최신 슬롯 상태 갱신

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `app/experiences/[id]/page.tsx` | metadata/page body/host profile projection 축소, availability summary 병렬화 |
| `app/experiences/[id]/ExperienceClient.tsx` | 서버 availability summary를 초기 상태로 재사용, 초기 중복 fetch 제거 |

---
## 2026-03-28 — Performance Phase 1A: Search Hot Path

### Search API
- **Projection split**: 검색 결과 카드 렌더에 필요한 필드와 텍스트 검색/유형 필터에만 필요한 필드를 분리하여, 위치/언어 기반 기본 검색에서는 더 작은 projection으로 조회
- **Conditional availability query**: 날짜/시간 필터가 없는 경우 `experience_availability` 조회를 생략하고, 텍스트/유형 필터를 먼저 적용한 뒤 필요한 경험 ID에 대해서만 availability를 조회하도록 순서 조정

### Search Result Cards
- **Mobile search cards**: 모바일 검색 결과 카드 이미지를 raw `<img>`에서 `next/image`로 교체하여 hot path 이미지 최적화 적용

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `searchContract.ts` | 카드용 projection과 텍스트 필터용 projection 분리 |
| `app/api/search/experiences/route.ts` | conditional availability query, availability 이전의 텍스트/유형 필터 적용 |
| `app/search/page.tsx` | 모바일 검색 결과 카드 이미지 `next/image` 전환 |

---
## 2026-03-28 — Mobile UX P0 Follow-up: Search i18n & Back Labels

### Search i18n cleanup
- **MobileSearchModal**: 추천 여행지/최근 검색/언어 표시/날짜 요약의 남은 하드코딩 문구를 정리하고, 모바일 close/back 접근성 라벨을 i18n 처리
- **Search Page (mobile)**: 모바일 검색 헤더/섹션 외에 검색 실패 토스트, 로딩 fallback, 필터 시트 close 라벨까지 i18n 정리

### Accessibility / small fixes
- **Mobile Back Buttons**: `button_back` 키를 실제로 추가하고, 남아 있던 모바일 back `aria-label` 하드코딩을 커뮤니티 포함 공통 i18n으로 교체
- **ReservationCard**: 한국어 `res_card_today` 값을 `"Today"`에서 `"오늘"`로 수정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `LanguageContext.tsx` | `button_back`, 모바일 검색 표시용 키, `search_results_load_error` 추가 및 `res_card_today` ko 값 수정 |
| `MobileSearchModal.tsx` | 모바일 검색 모달 하드코딩 문구 제거, locale-aware 날짜 포맷, close/back aria-label i18n 처리 |
| `search/page.tsx` | 모바일 검색 헤더/섹션/언어 라벨 정리, 검색 실패/로딩/시트 close 라벨 i18n 처리 |
| `BackButton.tsx` | 커뮤니티 모바일 back aria-label i18n 처리 |
| `PostEditor.tsx` | 커뮤니티 글쓰기 모바일 back aria-label i18n 처리 |

---
## 2026-03-28 — Mobile UX Phase 3: Host Dashboard & Modals Polish

### Host Dashboard
- **ServiceJobsTab**: 모바일 화면에서 카드 내의 위치/날짜/시간 정보의 `gap` 속성을 확장하여 (`gap-x-3 gap-y-0.5` → `gap-x-3 gap-y-1.5`) 시각적 안정성 및 가독성 개선
- **Host Dashboard Header**: 모바일 뒤로가기 버튼의 `aria-label` 하드코딩 문구 제거 및 i18n(`t('button_back') || 'Back'`) 처리 
- **ReservationCard**: 호스트 취소 안내 박스의 운영 검토 요청 사유 하드코딩 문구 제거 및 다국어 지원 (`res_review_req_min_participants`, `res_review_req_host_unavailable` 등)
- **GuestProfileModal**: 모바일 화면 스크롤 영역 하단에 Safe Area 설정(`pb-[calc(1.5rem+env(safe-area-inset-bottom))]`)을 추가하여 콘텐츠 잘림 방지

### Modals / Bottom Sheets
- **LoginModal**: 모바일 UI 대응으로 로그인 모드의 콘텐츠에도 `max-h-[76dvh] md:max-h-[80vh] overflow-y-auto` 스크롤 기능 추가하여 작은 기기(작은 폰, 키보드 노출 상태)에서 화면 하단이 넘치는 문제(overflow) 개선, safe-area 여백 활용
- **LoginModal**: 회원가입 시 "6자 이상 입력해주세요" 하드코딩을 i18n (`password_min_hint`) 처리

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `LanguageContext.tsx` | 예약 카드 문구 및 비밀번호 힌트 i18n 키 6개 맵핑 |
| `ServiceJobsTab.tsx` | 모바일 flex gap 속성 여백 추가 |
| `GuestProfileModal.tsx` | 본문 스크롤 컨테이너 안전 영역(safe-area) padding bottom 보강 |
| `page.tsx` (호스트 대시보드) | 모바일 뒤로가기 버튼 aria-label i18n 연동 |
| `ReservationCard.tsx` | 취소 검토 안내 다국어 i18n 연동 |
| `LoginModal.tsx` | 모바일 max height 대응 및 안전 영역 padding bottom 보강, 비밀번호 안내 i18n 연동 |

---
## 2026-03-28 — Mobile UX Phase 2: i18n & Modal Polish

### i18n — MobileSearchModal (전체 UI 라벨)
- 패널 헤딩 "위치/날짜/진행 언어" → `t('label_destination')`, `t('label_date')`, `t('label_progress_language')`
- 접힌 패널 placeholder "여행지 추가/날짜 추가/언어 선택" → 기존 i18n 키 활용
- "여행지 검색" → `t('search_placeholder')`, "선택" → `t('mobile_search_select')`
- "최근 검색/추천 여행지" → `t('mobile_recent_searches')`, `t('mobile_recommended_places')`
- "직접 입력한 위치/체험 검색어" → `t('mobile_search_custom_input')` (신규 키)
- "일치하는 추천 항목이 없어요." → `t('mobile_search_no_match')` (신규 키)
- 날짜 포맷 "월/일" → i18n 키 기반 동적 포맷
- 섹션 라벨 폰트 `9px → 10px`

### i18n — 검색 화면 바텀시트/필터
- 필터 칩 "유형/시간대" → `t('search_filter_type')`, `t('search_filter_time_slot')`
- 바텀시트 제목 "체험 유형/시간대/필터" → i18n 키 적용
- TIME_OPTIONS (오전/오후/저녁 + 설명) → 신규 i18n 키 6개
- TYPE_OPTIONS (맛집 탐방 ~ 원데이 클래스) → 신규 i18n 키 11개
- "전체 해제/결과 보기" → `t('search_filter_clear_all')`, `t('search_filter_show_results')`
- `formatShortDate` 날짜 포맷 i18n 적용

### 신규 i18n 키 (4개 언어: ko/en/ja/zh)
총 27개 키 추가: `mobile_search_select`, `mobile_add_destination`, `mobile_search_custom_input`, `mobile_search_no_match`, `search_filter_type`, `search_filter_time_slot`, `search_filter_experience_type`, `search_filter_show_results`, `search_filter_clear_all`, `search_time_*` (6), `search_type_*` (11)

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `LanguageContext.tsx` | 27개 i18n 키 추가 (ko/en/ja/zh) |
| `MobileSearchModal.tsx` | 모든 하드코딩 UI 라벨 i18n 교체, 섹션 라벨 폰트 크기 개선 |
| `search/page.tsx` | 바텀시트/필터/서브 헤딩 i18n 교체 |

### 제외 항목 (다음 Phase)
- 모바일 푸터 구현
- LoginModal 바텀시트화
- 호스트 대시보드 하위 탭 전체 재설계
- 디자인 토큰 정리

---

## 2026-03-28 — Mobile UX Phase 1: Pinpoint Polish

### Typography
- **BottomTabNavigation**: 탭 라벨 폰트 크기 `10px → 11px` (접근성 최소 가독 기준 충족)
- **Account (모바일 프로필 카드)**: 통계 라벨 `8px → 10px`, 단위 `9px → 10px`

### Spacing & Layout
- **Host Dashboard**: 모바일 좌우 여백 `px-3 → px-4` (다른 모바일 화면과 일치)
- **체험 상세 헤더**: `safe-area-inset-top`이 header height에 미반영되던 문제 수정 → 노치폰에서 컨텐츠 겹침 방지

### Touch Targets
- **홈 섹션 화살표**: 터치 영역 `26×26px → 36×36px`, SVG 아이콘 `10→12px`
- **검색 필터 칩**: 높이 `h-7 (28px) → h-8 (32px)` 터치 편의성 개선

### i18n (Internationalization)
- **Account 모바일 헤더**: "프로필" → `t('nav_profile')` (기존 키 활용)
- **Account 프로필 카드**: "로컬리 회원" → `t('locally_member')`
- **Account 통계**: "Locally를 통한 여행/후기/로컬리와 함께한 시간" + 단위 "회/개/개월/년" → 기존 i18n 키 활용

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `BottomTabNavigation.tsx` | 라벨 폰트 크기 |
| `account/page.tsx` | 통계 폰트 크기, 하드코딩 i18n 교체 |
| `host/dashboard/page.tsx` | 모바일 여백 정리 |
| `ExperienceClient.tsx` | safe-area 반영 |
| `HomePageClient.tsx` | 섹션 화살표 터치 영역 |
| `search/page.tsx` | 필터 칩 터치 높이 |
