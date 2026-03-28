# Changelog

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
