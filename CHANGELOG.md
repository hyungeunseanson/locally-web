# Changelog

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

### 제외 항목 (다음 Phase)
- 모바일 푸터 구현
- LoginModal 바텀시트화
- MobileSearchModal / 검색 바텀시트 전체 i18n
- 호스트 대시보드 하위 탭 전체 재설계
- 디자인 토큰 정리
