# 🤖 Locally — AI 개발 현황 (Antigravity 작업 로그)

> 이 파일은 AI 어시스턴트(Antigravity)가 수행한 작업을 기록합니다.
> 기존 `issue.md` / `issue_gemini.md` 는 결제 시스템 보안 감사 문서로 별도 유지됩니다.

---

## 📅 작업 세션 현황

---

### 🗓️ 2026-02-22 — 모바일 UX 기초 최적화

**목표:** 에어비앤비 앱 스타일의 모바일 웹 경험 구축

**주요 작업:**
- 하단 탭 네비게이션 구현 (검색/위시리스트/여행/메시지/프로필)
- 타이포그래피 및 레이아웃 최적화 (모바일 전용)
- 체험 목록 가로 스냅 스크롤 구현
- 북마크/예약 관련 하단 액션시트 스티키 구현

**수정 파일:**
- `app/components/HomeHero.tsx`
- `app/components/HomePageClient.tsx`

---

### 🗓️ 2026-02-23 ~ 2026-02-24 — 어드민 & 팀 기능

**목표:** 팀 협업 워크스페이스 알림/채팅 시스템

**주요 작업:**
- `TeamTab.tsx` — 불필요 번역 롤백, MiniChatBar 통합
- `GlobalTeamChat.tsx` — 실시간 미니 채팅 바 구현
- 팀 알림 시스템: 이메일 알림(Memo/Comment/Message/Todo), 사이드바 배지 (`teamNewCount`)
- 'N' 뱃지: DailyLog/Todo/Memo/Chat 전반에 빨간 'N' 뱃지 표시
- `Sidebar.tsx` — 팀 새 항목 카운트 배지 반영
- `admin/layout.tsx` — 모바일 레이아웃 최적화

---

### 🗓️ 2026-02-24 — 모바일 홈화면 1차 픽셀퍼펙트 리디자인

**목표:** 에어비앤비 UI 스크린샷 기준 픽셀 단위 재현

**주요 작업:**

#### HomeHero.tsx (모바일 섹션 전면 재작성)
- 검색 캡슐: `0.5px solid #DDDDDD` + `box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)`
- 검색 캡슐 — **sticky top-0** 고정 (스크롤 시 유지)
- 아이콘 탭: 52px → 60px → 64px 점진적 확대
- 스크롤 시 아이콘 탭 → 텍스트 탭 (justify-evenly) 전환
- 탭 선택: 선택=bold/검정, 미선택=normal/회색 명확한 차이
- `active:scale-[0.90]` 바운스 인터랙션

#### MobileSearchModal.tsx (전면 재작성)
- 배경: `backdrop-blur(8px)` + `#EDEDED` 통일
- 아이콘 탭 **중앙 정렬** (`flex-1 justify-center`)
- 슬라이드업 전환 애니메이션 (`translateY 20px → 0`)
- 위치 패널: 검색 입력 클릭 시 **전체화면 여행지 검색**으로 전환
- 여행지 검색 화면: 최근검색 + 추천여행지 섹션 (에모지 아이콘 + 설명)
- 핑크 그라데이션 검색 버튼: `linear-gradient(#E61E4D → #D70466)`
- 패널 폰트 전면 축소: 제목 15px / 본문 13px / 라벨 10px

#### HomePageClient.tsx — 다중 섹션 추가
- `인기 체험` / `신규 등록된 체험` / `한국어·일본어·영어·중국어로 진행되는 체험`
- `languages` 필드 기반 자동 분류
- 섹션 헤더 15px, 26px 화살표 원형 버튼

#### ExperienceCard.tsx — 모바일 폰트 축소
- 12px/11px (모바일 전용 `md:` 반응형, 데스크탑 유지)

---

### 🗓️ 2026-02-24 ~ 2026-02-25 — 모바일 홈화면 2차 디테일 리파인

**목표:** 에어비앤비 첨부 이미지 4장 기준 픽셀 단위 비교 수정

**주요 변경 내역:**

| 항목 | 이전 | 최종 |
|---|---|---|
| 배경색 | `#FFFFFF` 흰색 | **`#EDEDED`** 통일 (홈 + 모달 동일) |
| 검색바 텍스트 | 16px → 14px | **13px**, `justify-center` 중앙정렬 |
| 검색바 위치 | `pt-16px` | **`pt-8px`** 위로 이동 |
| 아이콘 크기 | 52px → 60px | **64px** |
| 아이콘↔텍스트 간격 | mb-6px → mb-3px | **mb-0** 완전 밀착 |
| 탭 간격 | gap-56px | **gap-40px** |
| NEW 배지 위치 | -top-1.5 -right-1 | **top-0 -right-2.5** 대각 상단 |
| NEW 배지 크기 | 7px px-5 | **8px px-6** (~30% 확대) |
| 그라데이션 구분선 | h-6px (진한 바처럼 보임) | **h-8px 자연스러운 명암** `0.04→transparent` |
| 섹션 헤더 | 22px → 18px | **15px** |
| 카드 텍스트 | 15px (고정) | **12/11px 모바일 전용** |
| 모달 탭 정렬 | 좌측 정렬 | **`flex-1 justify-center` 중앙** |
| 모달 배경 | 흰색 blur | **`#EDEDED`** 통일 |
| 모달 autoFocus | 켜짐 (키보드 올라옴) | **꺼짐** (전체화면 먼저 보임) |
| 여행지 검색 | 없음 | **풀스크린** (최근검색 + 추천여행지) |

---

## 📁 주요 수정 파일 목록

| 파일 | 내용 |
|---|---|
| `app/components/HomeHero.tsx` | 모바일 검색캡슐/아이콘탭/배경/sticky 전체 |
| `app/components/HomePageClient.tsx` | 모바일 다중섹션, 섹션 헤더 크기 |
| `app/components/ExperienceCard.tsx` | 모바일 폰트 반응형 축소 |
| `app/components/mobile/MobileSearchModal.tsx` | 검색 모달 전면 재작성 |
| `app/admin/` 관련 | 팀 알림, 채팅, 어드민 레이아웃 |

---

## 🏗️ 기술 스택 메모

- **프레임워크:** Next.js 15 (App Router)
- **스타일링:** Tailwind CSS v3
- **DB:** Supabase
- **배포:** Vercel
- **결제:** NicePay
- **언어:** TypeScript / React

---

## ⚠️ 알려진 이슈 (To-Do)

> 별도 파일 참조:
> - `issue.md` — 결제 시스템 종합 감사 (18개 이슈)
> - `issue_gemini.md` — 결제 시스템 심층 검토 (Gemini CLI)

### 추가 필요 작업 (모바일 UI)

- [ ] ExperienceCard 심장(하트) 버튼 크기 모바일 최적화
- [ ] 서비스 카드(ServiceCard) 모바일 폰트도 동일하게 축소
- [ ] 언어 섹션 제목 번역 처리 (`한국어로 진행되는 체험` → LanguageContext 기반)
- [ ] 검색 결과 화면 모바일 레이아웃 최적화
- [ ] 스크롤 시 sticky 헤더가 완전히 숨겨지는지 iOS Safari 검증

---

## 📝 Git 커밋 로그 (AI 작업분)

```
997e6c2  refactor: 에어비앤비 픽셀퍼펙트 모바일 홈화면 최종 리파인
         - HomeHero: #EDEDED 배경, 13px 검색바, 64px 아이콘 mb-0 간격
         - HomeHero: NEW 배지 30% 확대 + 대각선 상단, 8px 자연스러운 그라데이션
         - ExperienceCard: 모바일 폰트 12/11px (데스크탑 유지)
         - HomePageClient: 15px 섹션 헤더, 다중 언어별 섹션
         - MobileSearchModal: 중앙정렬 탭, #EDEDED 배경, 여행지 검색 풀스크린
```
