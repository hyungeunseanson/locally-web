# 📘 Locally-Web Project Bible (GEMINI.md)

**Last Updated:** 2026-02-26
**Version:** 2.13.0 (Host Mobile UX & Admin Access Routing Patch)
**Role:** Single Source of Truth for Gemini CLI & Developers

---

## 1. 📌 프로젝트 정체성 및 기술 스택 (Project Identity)

### 1.1 미션 (Mission)
**Locally**는 단순한 관광이 아닌, 현지인 호스트(Local Host)와 여행자(Guest)를 연결하여 '진짜 로컬 경험'을 제공하는 **C2C 로컬 체험 여행 플랫폼**입니다.

### 1.2 핵심 기술 스택 (Tech Stack)
- **Frontend Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS (No External UI Libs like Shadcn/MUI - **Custom Design System**)
- **Backend / Database:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **State Management:** 
  - Global: Context API (Auth, Toast, Notification, Language)
  - Server State: TanStack Query (Guest/Host areas)
  - Local: React Hooks (`useState`, `useReducer`)
- **Payment:** Toss Payments (Payments Widget SDK) & NicePay (Legacy support)
- **Icons:** Lucide React
- **Date Handling:** date-fns (`ko` locale)
- **Internationalization:** Custom `contentHelper` & `LanguageContext` (ko/en/ja/zh)

---

## 2. 📂 아키텍처 및 디렉토리 구조 (Architecture)

프로젝트는 **도메인 주도 설계(DDD)** 사상을 차용하여 사용자 역할(Role)에 따라 디렉토리를 분리했습니다.

### 2.1 주요 폴더 구조
```bash
/app
├── (domain)
│   ├── admin/       # 관리자 전용 (Dashboard, User Mgmt, Ledger)
│   ├── host/        # 호스트 전용 (Register, Create Exp, Dashboard)
│   ├── guest/       # 게스트 전용 (Trips, Wishlists, Inbox)
│   └── experiences/ # 공개 접근 가능 (상세 페이지, 예약, 결제)
├── api/             # Next.js Route Handlers (Server-side logic: Payment, Auth, Cron)
├── components/      # 재사용 가능한 공통 UI 컴포넌트 (Design System)
├── context/         # 전역 상태 (AuthContext, ToastContext 등)
├── hooks/           # 전역 커스텀 훅 (useChat, useWishlist 등)
├── lib/             # 외부 라이브러리 설정 (supabase.ts)
├── types/           # 전역 타입 정의 (admin.ts, index.ts)
└── utils/           # 유틸리티 함수 (formatters, validators, api-wrappers)
```

### 2.2 Admin 2.0 아키텍처 (최근 리팩토링)
관리자 페이지는 **View와 Logic의 철저한 분리** 원칙을 따릅니다.
- **View (`page.tsx`)**: 레이아웃 렌더링 및 탭 라우팅만 담당.
- **Logic (`hooks/useAdminData.ts`)**: 
  - 데이터 페칭 (Promise.all 병렬 처리)
  - 데이터 조립 (Manual Join for Performance)
  - 실시간 구독 (Supabase Realtime)
  - 서버 액션 호출 (`updateAdminStatus`, `deleteItem`)
- **Type (`types/admin.ts`)**: 관리자 전용 데이터 인터페이스 중앙화.

---

## 3. 🗄️ 데이터베이스 및 보안 (Database & Security)

### 3.1 주요 테이블 (Core Schema)
| 테이블명 | 역할 | 주요 컬럼 및 관계 |
| :--- | :--- | :--- |
| `profiles` | 사용자 기본 정보 | `id` (FK: auth.users), `role` (host/user/admin) |
| `experiences` | 체험 상품 정보 | `host_id`, `status` (active/pending), 다국어 필드 |
| `bookings` | 예약 및 결제 정보 | `status` (PENDING/PAID/confirmed), `amount`, `payment_method` |
| `reviews` | 후기 및 평점 | `experience_id`, `rating`, `content` |
| `host_applications` | 호스트 지원서 | `status` (pending/approved), `bank_account` |
| `inquiries` | 채팅방(문의) | `host_id`, `user_id`, `experience_id` |
| `inquiry_messages` | 채팅 메시지 | `inquiry_id`, `content`, `is_read` |

### 3.2 관리자 전용 테이블 (Admin Exclusive)
| 테이블명 | 역할 | 특징 |
| :--- | :--- | :--- |
| `admin_tasks` | 팀 협업용 업무/투두 | `type` (TODO, DAILY_LOG, MEMO), `metadata` (status) |
| `admin_task_comments` | 투두 내 댓글 스레드 | `task_id` FK, 실시간 연동 |
| `admin_whitelist` | 관리자 접근 허용 이메일 | `users.role` 변경 없이 권한 부여 가능 (보안 정책 적용됨) |
| `audit_logs` | 관리자 활동 로그 | 삭제/수정 이력 추적 |

### 3.3 보안 정책 (RLS Policy)
- **기본 원칙:** `public` 데이터 외에는 `authenticated` 유저만 접근 가능하며, 본인의 데이터만 수정 가능.
- **Admin 권한:**
    - `users` 테이블의 `role = 'admin'` 이거나,
    - `admin_whitelist` 테이블에 이메일이 등록된 경우 모든 테이블 접근 권한 부여.
    - **주의:** `admin_whitelist` RLS는 무한 재귀 방지를 위해 단순화(`true`)하고, 실제 차단은 `AdminLayout.tsx`와 `admin.ts`에서 이중으로 수행.

---

## 4. ✅ 개발 현황 및 완료된 기능 (Development Status)

**전체 진행률: 약 95%** (어드민 채팅 UX 무결성 패치 반영)

### Phase 1: 기반 구축 (Foundation) - ✅ 완료
- [x] Supabase Auth & Profile 시스템
- [x] 상품(Experience) CRUD 및 이미지 업로드
- [x] 메인 검색 및 필터링 (다국어 지원)

### Phase 2: 결제 및 예약 (Commerce) - ✅ 완료
- [x] Toss Payments & NicePay 연동
- [x] 예약 확정/취소 및 환불 프로세스 (트랜잭션 처리)
- [x] 오버부킹 방지 로직

### Phase 3: 관리자 시스템 고도화 (Admin 2.0) - ✅ 완료
- [x] **실시간 채팅 관리 (ChatMonitor) 2.0 고도화:**
  - `1:1 문의` 탭을 기본 화면으로 설정하고, 고객 이메일/전화번호 등 상세 프로필 요약 카드 추가.
  - **스마트 위험 알림:** 실시간 유저↔호스트 모니터링 중 특정 제한 키워드(전화번호, 계좌, 카톡 등) 감지 시 붉은색 경고 배너 및 메세지 하이라이트 노출.
- [x] **실시간 팀 협업 탭 (TeamTab):**
  - Daily Log (업무 일지), Threaded Todo (댓글형 투두), Shared Memo (문서형 메모장).
  - **스마트 알림:** 신규 글/댓글 발생 시 사이드바 및 리스트에 'N' 배지 노출.
  - **팀 미니 채팅 (MiniChatBar):** 대시보드 우측 하단 고정형 실시간 채팅. `admin_task_comments` 테이블의 `task_id`를 가상 시스템 Task(UUID `00000000-0000-0000-0000-000000000000`)에 매핑하여 외래키 제약조건(Foreign Key Violation, 23503) 및 UUID 타입 오류(22P02) 완벽 해결.
- [x] **통합 마스터 장부 (Master Ledger):**
  - 실시간 매출/정산 대시보드.
  - **읽음 확인 로직:** 클릭하지 않은 '입금 대기' 건수만 카운트.
  - **상세 모달:** 결제 수단(무통장/카드) 구분, 정산액(80%) 및 플랫폼 수익 자동 계산.
- [x] **관리자 화이트리스트:** 대시보드 내에서 즉시 관리자 권한 부여/삭제 가능.
- [x] **구조적 리팩토링:** `useAdminData` 훅 분리 및 `maybeSingle()` 도입으로 500/400 에러 차단.

### Phase 4: 시스템 안정화 및 보안 (Stabilization) - ✅ 완료
- [x] **보안 강화 (Security):**
  - NicePay 콜백 위변조 방지 (HMAC 서명 검증).
  - 결제 확정/취소 API 권한 제어 (Admin/Owner Check).
- [x] **성능 최적화 (Performance):**
  - Admin 예약 데이터 페이지네이션 (Lazy Loading) 구현.
  - 이미지 최적화 (AVIF/WebP) 및 폰트 경량화 (Noto Sans KR).
- [x] **SEO & UX:**
  - 다국어 메타데이터 (`alternates`, `hreflang`) 적용.
  - 전역 폰트 시스템(Tailwind CSS Variable) 통합.

### Phase 4.1: 데이터 무결성 및 아키텍처 개선 (Data Integrity & Architecture) - ✅ 완료
- [x] **보안 및 권한 API 패치:**
  - `admin/delete`, `payment/cancel`, `notifications/email` API 등의 무단 호출 방지 및 관리자 예외 처리 로직 추가.
- [x] **정산 로직 및 데이터 정합성 보장:**
  - 결제 취소 시 PG사 결제망 상태 이중 검증(결제 실패 시 DB 저장 방어 로직).
  - 위약금 기반 호스트 정산액(80%) 공식 통일 및 `Earnings.tsx` 수익금 불일치 버그 해결.
- [x] **아키텍처 및 렌더링 최적화:**
  - Server Side Prefetching(`layout.tsx`)을 도입하여 진행 상황의 깜빡임(FOUC) 원천 차단.
  - `LoginModal` 프로필 강제 인서트(유령 계정 방지) 로직을 보안 서버 액션(`syncProfile`)으로 완전 이관.
- [x] **API 우회 차단 및 데이터 라이브 연동:**
  - 클라이언트 DB 접근을 차단하고 `Review` API의 평균 별점 집계 트리거 정상 복구.
  - `ExperienceClient`, `WishlistsPage` 등 프론트엔드 곳곳의 더미 데이터(하드코딩된 별점) 파기 및 실제 DB 데이터 연동.

### Phase 4.2: 백엔드 보안 아키텍처 완성 (V3 Security Patch) - ✅ 완료
- [x] **클라이언트 위변조 원천 차단 (Price Tampering):**
  - 프론트엔드(`payment/page.tsx`)의 결제 대금 계산 및 예약 DB Insert 로직 파기.
  - 철저하게 서버 기반의 권한 통제를 받는 `/api/bookings` 신규 생성 및 적용.
- [x] **알림 스팸 인젝션 (Notification Defacement) 방어:**
  - 프론트엔드 사이드에서의 무분별한 알림(`notifications`) Insert 로직 제거 및 백엔드 은닉.
- [x] **관리자 대시보드 강건성 확보 (Error Handling):**
  - `TeamTab.tsx` 내 모든 비동기 쓰기 함수에 `try-catch` 및 Toast 에러 피드백을 추가하여 침묵 실패(Silent Failure) 현상 영구 해결.

### Phase 4.3: 전역 리팩토링 및 다국어 시스템 안정화 (Global Cleanup) - ✅ 완료
- [x] **잠재적 500 에러 폭탄 제거 (Database Querying):**
  - 백엔드 및 컴포넌트 전반에 존재하던 약 40여 개의 `.single()` 코드를 전부 안전한 `.maybeSingle()` 로 일괄 치환하여 데이터 부재 시의 치명적 크래시를 방지함.
- [x] **잉여 패키지 및 충돌 로직 제거 (Dependency Cleanup):**
  - 빌드 용량을 낭비하고 사설 언어 시스템(`LanguageContext`)과 혼선을 유발하던 `next-intl` 관련 패키지 및 찌꺼기 파일(middleware.ts, locale.ts 등)을 완벽 제초.
- [x] **번역 시스템 무결성 수복 (Localization Fix):**
  - 검색바(`MainSearchBar.tsx`)에서 도시 키값(`city_tokyo`)이 날것으로 들어가는 하드코딩 오류를 번역 함수 `t()`로 감싸어 UI와 DB 연결 정합성을 100% 회복함.

### Phase 4.4: 프리미엄 브랜드 아이덴티티 및 UI 고도화 (Premium Identity & UI Polish) - ✅ 완료
- [x] **고품격 UI/UX 디자인 시스템 결속 (High-End Visual V4):**
  - **토큰 기반 그림자 시스템:** Airbnb 스타일의 다층적이고 부드러운 커스텀 그림자(`shadow-elevation-low`, `medium`, `high`)를 `globals.css` 전역에 구축.
  - **체험 카드(ExperienceCard) 럭셔리 튜닝:** 카드 Hover 시 자연스럽게 떠오르는 Lift 섀도우 컴포넌트 트랜지션 및 썸네일 미세 줌인(`scale-105`) 에셋 추가. 폰트 자간(`tracking-tight`) 최적화.
  - **메인 검색바(MainSearchBar) 인터랙션:** 마우스 오버 시 부드럽게 발광하는 심층 오버레이 섀도우 적용으로 고급스러운 반응성 부여.
- [x] **신규 로고 디자인 및 파비콘 배포:**
  - 기존의 텍스트 로고를 대체하는 "The Local Thread" (호스트와 게스트의 연결을 상징하는 끊어지지 않는 유려한 선) 심볼 로고 도입.
  - 브라우저 탭 및 앱 아이콘(`app/icon.png`) 동기화 완료.
- [x] **정밀한 시각적 비율 보정 (Airbnb Layout Proportions):**
  - 목업 기반(Base 100 계산식)의 로고 심볼과 "Locally" 텍스트 간격, 글씨체 두께 비율(1:1), 텍스트 대비 심볼 크기 우위 비율을 픽셀 단위로 구현.
  - 원본 AI 이미지의 투명 패딩(Padding)을 시각적으로 상쇄하기 위해 컨테이너 크기를 확장하고 텍스트를 축소하는 트릭(`w-[52px] h-[52px]`)으로 에어비앤비 프론트엔드와 완벽하게 동일한 황금 비율 및 시각적 무게 균형 완성.
  - 투명 배경 PNG(블랙/화이트) 알파 브렌딩 에셋 자체 추출 및 배포.

### Phase 4.5: 전역 시스템 무결성 및 `.single()` 제거 (Global System Integrity) - ✅ 완료
- [x] **Zero-Disruption API 안전성 확보:**
  - `app/api/` 및 `app/actions/` 하위 시스템의 불안정한 쿼리 호출 지점 약 40곳에서 `.single()` 체이닝을 적발, `.maybeSingle()` 로 완전히 걷어내어 500 Network 에러를 원천 차단했습니다.
- [x] **보안/권한 검증 로직 강건성 추가:**
  - `admin/delete`, `payment/cancel`, `notifications/email` 에서 인증/인가 누락을 보충하고 스팸 봇 무단 통신을 방어했습니다.

### Phase 4.6: 모바일 네이티브 UX 최적화 (Mobile Web Native UX Optimization) - ✅ 완료
- [x] **모바일 네비게이션 앱 라이크 변환:**
  - 스마트폰(모바일 뷰포트)에서 상단 헤더를 숨기고 화면 하단에 `BottomTabNavigation.tsx` (바텀 탭 5구)를 고정 배치하여 네이티브 앱 같은 拇指(엄지) 닿기 편한 UX/UI 구축.
- [x] **세로 뷰 가로 스크롤(Snap-x) 및 거대 타이포그래피:**
  - 메인 디스커버 페이지의 요소들을 스와이프로 부드럽게 넘기는 가로 스크롤 지원.
  - 서브 페이지(Inbox, Trips, Profile) 진입 시 Airbnb 스타일의 `tracking-tight text-[32px]` 거대 타이포그래피 적용.
- [x] 상세 페이지 및 목록 밀도(Dense) 최적화:
  - 모바일 진입 시 사진 벤토 그리드(Bento Grid) 및 일정 타임라인 UI 등 모바일 최적화 컴포넌트로 자동 분기 (`md:hidden`).
  - 우측 예약 카드가 밀려 내려가는 것을 막기 위해 하단 플로팅 예약 바(`StickyActionSheet`) 전격 적용.
  - 메시지함, 마이페이지의 박스 보더를 없애고 Edge-to-edge 스타일의 네이티브 리스트 스킨 구현.

### Phase 4.7: 데이터 심층 분석 컴포넌트 고도화 (Analytics Dashboard) - ✅ 완료
- [x] **프론트엔드 데이터 트래킹 엔진 심기:** 
  - 검색 트렌드(`search_logs`) 및 예약 퍼널(노출, 클릭, 결제 대기) 로그 트래킹 코드 통합.
- [x] **4대 핵심 지표 모달 (Drill-down):** 
  - 활성 체험 상태값, 플랫폼 순수익 파이프라인, 구매 전환율 퍼널 바(Bar), 고객 재구매율 분포 상세 조회 모달 연결.
- [x] **차트/리스트 영역 [전체 보기] 무한 스크롤:** 
  - 게스트 인구통계, 실시간 인기 트렌드 리스트, 매출 견인 Top 5 체험 랭킹, 호스트 에코시스템(국적/언어/유입경로) 정보를 대형 드롭다운 리스트 모달로 확장 구축.
- [x] **직접 라우팅 (Deep linking) 연동:** 
  - 통계 내의 슈퍼 호스트 유망주 및 위험 호스트(Risk) 카드 클릭 시 대상 유저의 상세 프로필(`/users/[id]`) 페이지 즉시 열람 연동.

### Phase 4.8: 안전 정책 및 호스트 교육 시스템 (Safety Policies & Education) - ✅ 완료
- [x] **게스트 결제 전 의무화:** 결제 직전 오프라인 우회 결제 금지, 연락처 무단 교환 금지, 안전 가이드라인 등 3대 필수 정책 동의 락(Lock) 추가.
- [x] **호스트 9단계 등록 서약:** 지원서 제출 전 '필수 교육 수료 및 서약' 단계를 신설하여 플랫폼 페널티 및 안전 매뉴얼 강제 정독 로직 구현.
- [x] **대시보드 가이드라인 상시 배치:** 승인 대기 중이거나 활동 중인 모든 호스트가 사이드바 및 대기 화면에서 '호스트 파트너 가이드라인'을 열람할 수 있도록 전용 탭 개설.

### Phase 4.9: 팀 협업 아키텍처 전면 개편 (Team Collaboration Overhaul) - ✅ 완료
- [x] **2-Tab Split 구조 및 Markdown Memo:** 
  - `TeamTab.tsx`를 두 개의 독립적인 뷰(Todo & Daily Log / Team Knowledge Docs)로 분리하여 거대해진 UI 밀도를 극복.
  - 외부 라이브러리 추가 없이 `react-markdown` 및 `remark-gfm`을 활용해 코드 블록, 인용구, 마크다운 문법이 원활하게 지원되는 전사적 '팀 메모장' 시스템 구축.
- [x] **Team Chat (전역 팀 채팅) 개편:**
  - 기존 우측 하단의 작은 MiniChatBar를 우측에 고정된 아코디언/드로워 형태의 대형 `GlobalTeamChat`으로 확장.
  - 전역 팀 채팅 명칭을 심플하고 직관적인 'Team Chat'으로 변경.
- [x] **럭셔리 다크 테마 일치화 (UI Polish):**
  - 사이드바 배경 및 채팅방 톤앤매너를 시크한 블랙(`bg-black`) 및 무채색 계열(`bg-slate-900`)로 톤다운하여 플랫폼의 메인 브랜드 아이덴티티 완전 결속.
  - 랜딩 페이지(`HomeHero`) 및 메인 검색바의 기존 붉은색 버튼을 블랙 테마로 수정 적용.

### Phase 4.10: 실시간 팀 알림 아키텍처 및 N 뱃지 고도화 (Notification Mastery) - ✅ 완료
- [x] **백엔드 이메일 브로드캐스팅 (`api/admin/notify-team`):**
  - NodeMailer를 활용하여 시스템 내 `Admin` Role 이메일과 `admin_whitelist` 이메일을 통합 조회, 한 번에 전송해주는 전용 알림 API 신규 개설.
- [x] **전역 알림 핑(Ping) 자동 연동:**
  - Team Workspace 내 신규 메모, 할 일 등록, 덧글 작성 및 Team Chat 메시지 발송 시 비동기 핑으로 팀 전체에 이메일 자동 발송 처리. (단, 과다 발송 방지를 위해 업무 일지(Daily Log)는 제외)
- [x] **'N' 배지 매핑 및 가시성 표준화:**
  - `Sidebar.tsx` 카운트를 전체 Task(Memo 포함)로 확장하여 정확도를 높이고, 흩어져 있던 알림 배지 UI를 `w-4 h-4 bg-rose-500` 스펙의 붉은색 원형 마크 'N'으로 모두 통일.

### Phase 4.11: 에어비앤비 스타일 모바일 홈화면 픽셀퍼펙트 리디자인 (Mobile Airbnb UX V1) - ✅ 완료

> **2026-02-24** | 수정 파일: `HomeHero.tsx`, `HomePageClient.tsx`, `MobileSearchModal.tsx`

- [x] **홈화면 검색 캡슐 고도화:**
  - `sticky top-0` 고정 — 스크롤 시 검색바 + 아이콘 탭 항상 노출.
  - 에어비앤비 스타일의 큰 둥근 캡슐(`rounded-full`) + 정교한 `box-shadow` 적용.
  - 스크롤 시 아이콘 탭 → 텍스트 탭 (`justify-evenly`) 자동 전환.
- [x] **아이콘 탭 인터랙션:**
  - 아이콘 52px → 60px → 64px 점진적 확대.
  - 탭 클릭 시 `active:scale-[0.90]` 바운스 애니메이션.
  - 선택됨=`font-bold` 검정, 미선택=`font-normal` 회색으로 명확한 시각적 차이.
- [x] **MobileSearchModal 전면 재작성:**
  - 아이콘 탭 좌측 → **중앙 정렬** (`flex-1 justify-center`).
  - `backdrop-blur(8px)` + 슬라이드업 전환 애니메이션 (`translateY 20px → 0`).
  - 핑크 그라데이션 검색 버튼: `linear-gradient(#E61E4D → #D70466)`.
- [x] **HomePageClient 다중 섹션:**
  - '인기 체험' / '신규 등록된 체험' / 언어별 체험(`한국어·일본어·영어·중국어`) 자동 분류.
  - `languages` 필드 기반 동적 필터링.

### Phase 4.12: 에어비앤비 최종 디테일 리파인 (Mobile Airbnb UX V2) - ✅ 완료

> **2026-02-25** | 수정 파일: `HomeHero.tsx`, `ExperienceCard.tsx`, `HomePageClient.tsx`, `MobileSearchModal.tsx`
> Git 커밋: `997e6c2`

- [x] **배경색 통일:** 홈 + 모달 전체 `#EDEDED` 단일 컬러로 통합 (에어비앤비 warm gray 재현).
- [x] **검색바 세밀 조정:**
  - 위치를 위로 이동 (`pt-8px`), 텍스트 13px 축소, `py-14px`로 컴팩트화.
- [x] **아이콘 탭 최종 픽셀 보정:**
  - 아이콘↔텍스트 간격 `mb-0` (완전 밀착).
  - 탭 사이 간격 `gap-56px → gap-40px` 좁힘.
- [x] **NEW 배지 리포지셔닝:**
  - 위치: `-top-1.5 -right-1` → `top-0 -right-2.5` (아이콘 대각 상단 정확히 배치).
  - 크기: `text-[7px] px-5` → `text-[8px] px-6` 약 30% 확대.
- [x] **구분선 그라데이션 자연화:**
  - `h-6px rgba(0,0,0,0.06)` (바처럼 보이는 문제) → `h-8px rgba(0,0,0,0.04)→transparent` 자연스러운 명암 페이드.
- [x] **ExperienceCard 모바일 폰트 축소:**
  - `md:` 반응형으로 분기: 모바일 12/11px, 데스크탑 15px 유지.
- [x] **섹션 헤더 15px:** 기존 18px → 15px.
- [x] **여행지 검색 풀스크린 구현:**
  - 위치 패널의 검색 input 클릭 시 → 에어비앤비 스타일 풀스크린 전환.
  - `← ArrowLeft` 뒤로가기 + **최근 검색** (최근 도시 2개) + **추천 여행지** (6개, 이모지+설명) 섹션.
  - [x] `autoFocus` 적용으로 즉시 타이핑 가능.

### Phase 4.14: 전역 모바일/데스크탑 충돌 전수 감사 및 수정 (Mobile-Desktop Collision Full Audit) - ✅ 완료

> **2026-02-26** | 수정 파일: `ToastContext.tsx`, `NotificationContext.tsx`, `GoogleTranslate.tsx`, `dates/page.tsx`, `HostProfileModal.tsx`, `ExperienceClient.tsx`, `StickyActionSheet.tsx`, `HomePageClient.tsx`, `BottomTabNavigation.tsx`, `HostProfileSection.tsx`, `ExpMainContent.tsx`, `experiences/[id]/page.tsx`

- [x] **전역 Fixed 요소 BottomTabNavigation 가림 현상 수정:**
  - `ToastContext`: `fixed bottom-6` → `bottom-[80px] md:bottom-6` (모바일에서 바텀탭에 가려지던 토스트 메시지 수정).
  - `NotificationContext`: `fixed bottom-6 right-6` → `bottom-[80px] md:bottom-6 right-4 md:right-6` (알림 토스트 동일 수정).
  - `GoogleTranslate`: `fixed bottom-10 right-10` → `bottom-[80px] md:bottom-10 right-4 md:right-10` (번역 버튼 가림 수정).
- [x] **pb-20 누락 페이지 보완:** `host/experiences/[id]/dates/page.tsx` 최상위 div에 `pb-20 md:pb-0` 추가 (저장 버튼 BottomTabNavigation 가림 수정).
- [x] **z-index 충돌 수정:**
  - `HostProfileModal`: `z-[100]` → `z-[150]` (BottomTabNavigation과 동일 z-index로 인한 가림 해결).
  - `ExperienceClient` 갤러리 오버레이: `z-[100]` → `z-[150]` (동일 문제 수정).
  - `StickyActionSheet`: `z-[100]` → `z-[105]`, 내부 padding `calc(env(safe-area-inset-bottom,0px)+72px)` 확장 (BottomTabNavigation 위로 예약 UI 노출).
- [x] **HomePageClient 이중 하단 여백 수정:** `md:hidden pb-28` → `pb-4` (ClientMainWrapper의 `pb-20`과 중첩되어 발생하던 192px 과다 공백 수정).
- [x] **BottomTabNavigation 미정의 클래스 제거:** `pb-safe` (Tailwind에 정의되지 않은 무의미 클래스) 제거. Safe Area는 인라인 `style`에서 올바르게 처리되고 있음.
- [x] **HostProfileModal 더미 데이터 제거 및 실제 데이터 연동:**
  - `experiences/[id]/page.tsx`: `profile.created_at` 기반 `joined_year` 계산 추가.
  - `ExpMainContent.tsx` → `HostProfileSection.tsx` props 체인에 `joinedYear` 추가.
  - `HostProfileModal.tsx`: 하드코딩된 `156`, `4.98`, `7년` → `host.reviewCount`, `host.rating`, `host.joinedYear` props 연동 (값 없을 시 `-` 표시).
  - `HostProfileSection.tsx`: "경력 7년" 하드코딩 → `joinedYear` prop 기반 동적 표시.

### Phase 4.13: 어드민 모바일 UX 고도화 및 버그 잔상 제거 (Mobile Admin Polish V4-V5) - ✅ 완료

> **2026-02-25** | 수정 파일: `Sidebar.tsx`, `GlobalTeamChat.tsx`, `TeamTab.tsx`, `layout.tsx`, `ChatMonitor.tsx`, `AuditLogTab.tsx`, `AnalyticsTab.tsx`, `MasterLedgerTab.tsx`, `UsersTab.tsx` (Admin)

- [x] **GlobalTeamChat 플로팅 캡슐(Pill) 디자인:**
  - 하단의 밋밋한 사각 버튼을 중앙 정렬된 둥근 모서리 플로팅 캡슐 형태로 개편.
  - 가로폭 확장(`px-8`) 및 위치 하향(`bottom-3`)으로 클릭 가시성 및 디자인 밸런스 확보.
- [x] **'N' 배지 부활(좀비 배지) 버그 해결:**
  - 단순 클릭 이벤트 방식에서 `localStorage` 타임스탬프(`global_chat_last_viewed`) 비교 방식으로 로직 고도화.
  - 사용자가 마지막으로 채팅을 확인한 시간 이후의 새 메시지만 배지를 띄우도록 설계하여 중복 알림 이슈 완벽 해결.
- [x] **어드민 레이아웃 하단 블랙박스(심연) 박멸:**
  - 루트 레이아웃(`app/layout.tsx`)의 전역 모바일 패딩(`pb-20`)이 어드민 뷰와 겹쳐 오버스크롤 시 검은 여백이 생기던 문제 해결.
  - `ClientMainWrapper`를 신설하여 `/admin` 경로 진입 시 하단 여백을 원천 소거하는 조건부 렌더링 적용.
- [x] **시각적 정보 밀집도 및 오버레이/마스터-디테일 패턴 전면 적용:**
  - **사이드바(Sidebar):** 슬라이드 너비 축소(`w-72` -> `w-60`), 폰트(`xs`) 및 아이콘(`16px`) 사이즈 하향. 하단 **'Online Now' 실시간 연동** 및 현재 로그인된 **관리자 프로필(이메일) 동적 바인딩** 완료.
  - **채팅 모니터링(`ChatMonitor`):** 좌측 리스트 뷰와 우측 대화창을 모바일에서는 화면을 덮는 형태(Master-Detail 오버레이)로 전환. 채팅창 진입 시 배경이 비치거나 UI가 우측으로 밀리던 현상을 `absolute z-[100] fixed` 구조로 완전 해결.
  - **팀 메모장(`TeamTab`):** 할 일/메모 네비게이션을 상하에서 탭으로 변경하고 마크다운 폰트를 `11px` 로 하향하여 모바일 톤앤메너 일치화.
  - **마스터 장부(`MasterLedgerTab`):** 모바일에서 거대했던 캘린더 UI를 컴팩트한 상단 버튼형으로 교체(`AnalyticsTab` 스타일). 예약 상세 내역을 풀스크린 오버레이(`z-[100]`)로 전환하여 정보 가독성 극대화.
  - **통계 및 로그(`AnalyticsTab`, `AuditLogTab`):** 모바일 여백 최소화 및 리스트 그리드 재배치. 활동 로그(`AuditLog`)의 **타임스탬프를 두 줄(날짜/시간)로 분리**하여 좁은 화면에서의 가독성 200% 상향.
  - **공통 레이아웃 보정:** `UsersTab` 리스트 및 상세 패널 텍스트 밀집도 튜닝. 모바일 전역에서 불필요한 공백을 걷어내고(`Dashboard page.tsx p-2 md:p-6`) 콘텐츠 중심의 UI/UX 완성.

### Phase 4.15: 모바일 UX 무결성 패치 (Nav/Localization/iOS) - ✅ 완료

> **2026-02-26** | 수정 파일: `BottomTabNavigation.tsx`, `ServiceCard.tsx`, `HomePageClient.tsx`, `MobileSearchModal.tsx`, `MainSearchBar.tsx`, `LanguageContext.tsx`, `HomeHero.tsx`, `host/create/page.tsx`, `host/experiences/[id]/page.tsx`, `host/experiences/[id]/edit/page.tsx`

- [x] **호스트 바텀 탭 활성 상태 오작동 해결:**
  - `BottomTabNavigation`이 `?tab=` 쿼리 기준으로 정확히 활성 탭을 표시하도록 수정하여, `/host/dashboard`에서 모든 탭이 동시에 활성화되던 버그 해결.
- [x] **바텀 탭 노출 범위 정교화 (충돌 방지):**
  - `/admin`, 인증 페이지, 결제 플로우, 호스트 생성/수정 등 비내비게이션 화면에서 하단 탭을 자동 숨김 처리하여 주요 CTA 가림 현상 차단.
- [x] **모바일 ServiceCard 가독성 보정:**
  - 모바일에서 오버레이 텍스트/가격의 폰트 및 패딩을 축소하고 `md:` 분기 유지로 데스크탑 비주얼 보존.
- [x] **홈/검색 다국어 무결성 보강:**
  - `HomePageClient` 언어별 섹션 제목 및 서비스 섹션 타이틀을 `LanguageContext` 기반으로 번역 처리.
  - `MobileSearchModal`/`MainSearchBar`의 언어 선택, 최근 검색, 추천 여행지 등 핵심 라벨을 다국어 키로 통일.
- [x] **iOS Safari 안정성 보강:**
  - 모바일 검색 모달 전체 컨테이너를 `h-[100dvh]`로 보정하고, 호스트 생성 페이지 하단 액션바에 Safe Area 패딩을 추가하여 하단 홈 인디케이터/브라우저 UI 충돌 완화.
- [x] **데스크탑 여백 회귀 방지:**
  - `host/experiences/[id]`, `host/experiences/[id]/edit`에 `pb-20 md:pb-0` 적용으로 모바일 여백 유지 + 데스크탑 과다 여백 제거.

### Phase 4.16: 어드민 채팅 사용성/가시성 패치 (Admin Chat Usability) - ✅ 완료

> **2026-02-26** | 수정 파일: `ChatMonitor.tsx`, `GlobalTeamChat.tsx`, `ManagementTab.tsx`

- [x] **메시지 모니터링 채팅창 높이/가시성 개선 (모바일+데스크탑):**
  - `ChatMonitor` 전체 레이아웃 높이를 뷰포트 기준으로 재조정하여 우측 채팅 입력 영역이 한 화면 안에 안정적으로 노출되도록 보정.
  - 목록/대화 패널 비율을 조정하여 데스크탑에서 우측 채팅창이 과도하게 커 보이던 문제를 완화.
- [x] **모바일 뒤로가기 복구 (메시지 모니터링):**
  - 모바일 채팅 상세 헤더의 뒤로가기 동작을 `clearSelected` 기반으로 교체하여 목록 복귀 실패 이슈 해결.
- [x] **Team Chat 최신 메시지 우선 가시화:**
  - `GlobalTeamChat` 초기 로딩 정렬을 오름차순으로 통일하고, 오픈 시 자동 스크롤이 항상 최하단(최신 메시지)으로 이동하도록 로직 보강.
  - 데스크탑/모바일 스크롤 컨테이너를 분리해 환경별 스크롤 타겟 누락(오래된 메시지부터 보이던 현상) 해결.
- [x] **Team Chat 노출 범위 제한:**
  - 전역 마운트 상태는 유지하되, 실제 렌더를 `/admin/dashboard?tab=TEAM`일 때만 노출되도록 제한하여 Team Workspace 컨텍스트 외 노출 차단.
- [x] **승인관리 탭 모바일 타이포 밀도 보정:**
  - `승인 관리 / 호스트 지원서 / 체험 등록` 헤더 및 버튼 텍스트를 모바일에서 축소(`md:` 분기 유지)하여 버튼 크기 대비 폰트 과대 노출 해소.

### Phase 4.17: 호스트 사이드 무결성 재감사 및 핀셋 패치 (Host Integrity Re-Audit) - ✅ 완료

> **2026-02-26** | 수정 파일: `MobileHostMenu.tsx`, `ReservationManager.tsx`, `ReservationCard.tsx`, `host/dashboard/page.tsx`, `host/dashboard/InquiryChat.tsx`, `host/dashboard/MyExperiences.tsx`, `host/dashboard/Earnings.tsx`, `host/experiences/[id]/dates/page.tsx`, `host/experiences/[id]/edit/page.tsx`, `host/experiences/[id]/page.tsx`, `host/register/page.tsx`, `payment/success/page.tsx`, `useChat.ts`, `constants/bookingStatus.ts`
> 산출물: `docs/host-side-deep-audit-2026-02-26-reaudit.md`

- [x] **호스트 수익/리뷰 집계 스코프 정합성 복구 (H-01, M-02):**
  - `MobileHostMenu`의 월 수익 집계를 `bookings -> experiences!inner(host_id)` 기준으로 제한하고 상태 필터를 확정 상태(`PAID/confirmed/completed`)로 통일.
  - 리뷰 집계를 `reviews.host_id` 직접 참조 방식에서 `reviews -> experiences!inner(host_id)` 기반으로 교체하여 스키마 의존성 리스크 제거.
  - 비로그인 조기 반환 경로에서 `setLoading(false)`를 보장하여 로딩 고착 제거.
- [x] **호스트 예약 Realtime 범위 오탐 차단 + 뱃지 정렬 일치화 (H-03, M-04):**
  - `ReservationManager` 초기 로딩 시 호스트 소유 `experience.id` 집합을 확보하고, `bookings` Realtime payload의 `experience_id`를 교차 검증해 타 호스트 이벤트 수신을 차단.
  - `hasNew` 계산 로직을 실제 탭 필터 함수와 동일한 기준(`isReservationInTab`)으로 통일해 탭 뱃지와 목록 체감 불일치 해소.
- [x] **모바일/데스크탑 예약 레이아웃 이중 고정 해소 (H-07):**
  - `dashboard/page.tsx`의 부모 고정 높이(`h-[500px] md:h-[750px]`)를 제거하고, `ReservationManager` 내부 컨테이너를 `h-full + min-h` 구조로 정리하여 중첩 스크롤 부작용 완화.
- [x] **문의함 모바일 뒤로가기 루프 복구 + fallback 404 제거 (H-04, M-03):**
  - `InquiryChat`에서 뒤로가기 시 `clearSelected()` 후 `guestId` 쿼리를 제거(`router.replace(...?tab=inquiries)`)해 자동 재진입 루프 차단.
  - 아바타 기본 경로를 실제 존재 자산으로 교체해 `/default-avatar.png` 404 반복 요청 제거.
- [x] **예약 상태값 단일화 및 일정 보호 로직 정정 (H-05):**
  - `host/experiences/[id]/dates/page.tsx`의 활성 예약 판정에서 소문자 `paid`를 제거하고 확정 상태 집합을 공통 상수(`BOOKING_CONFIRMED_STATUSES`)로 통일.
  - 공통 상태 상수 모듈(`app/constants/bookingStatus.ts`)을 추가해 예약 상태 매직 문자열 분산 리스크를 축소.
- [x] **체험 수정 권한 스코프 및 로딩 무한 대기 차단 (H-06, N-01):**
  - `edit/page.tsx` 조회/수정 쿼리에 `host_id = currentUser.id`를 강제 적용해 소유권 누락 리스크 차단.
  - 조회 실패 경로에서 `finally` 기반 `setLoading(false)`를 보장해 무한 로딩 고착 해결.
  - 이미지 업로드 버킷을 생성 플로우와 동일한 `experiences`로 통일하여 운영 경로 일원화.
- [x] **정산 지표에 미확정 상태 혼입 제거 (M-01):**
  - `Earnings.tsx` 집계 대상을 `PAID/confirmed/completed/cancelled`로 제한하고, 취소 건은 `host_payout_amount` 존재 시에만 유효 집계하도록 유지.
- [x] **예약 카드 기능 누락 복구 (M-08):**
  - `ReservationCard`에서 게스트 아바타/이름 영역을 프로필 모달 트리거로 연결.
  - 취소요청 카드에 “취소 사유 문의” 액션을 추가해 상위 매니저에서 전달하던 `onCancelQuery` 경로를 실제 동작시킴.
- [x] **호스트 재지원 시 상태/권한 회귀 방어 (N-03):**
  - `host/register/page.tsx`에서 기존 신청 상태가 `approved`인 재제출은 `pending`으로 강등하지 않고 `approved` 유지.
  - `profiles.role` 업데이트 시 기존 `host/admin`는 보존하고, 그 외에만 `host_pending`으로 설정하도록 분기.
- [x] **레거시 결제 성공 페이지 우회 확정 제거 (N-02):**
  - `payment/success/page.tsx`에서 클라이언트 직접 `bookings.status = confirmed` 업데이트 로직을 삭제하고, 주문 상태 조회 전용 화면으로 전환.
  - 결제 확정은 기존 서버 검증 경로(`nicepay-callback`, `confirm-payment`)를 단일 소스로 유지.
- [x] **채팅 Realtime 중복 억제 로직 개선 (N-04):**
  - 전역 시간 기반(500ms) 중복 억제 로직을 메시지 ID 기반 이벤트 키(Set) 방식으로 교체해 근접 다중 메시지 유실 가능성을 완화.
  - 채널명을 `chat-realtime-updates-${currentUser.id}`로 분리해 세션 간 충돌 가능성 축소.
- [x] **기본 품질 리포트 업데이트:**
  - 호스트 영역 재감사 문서(`host-side-deep-audit-2026-02-26-reaudit.md`)를 작성하여 기존 진단서와 유효성 비교, 신규 리스크, 우선순위 패치 계획을 아카이빙.

### Phase 4.18: 호스트 모바일 UX/권한 노출 라우팅 패치 (Host Mobile UX & Admin Access) - ✅ 완료

> **2026-02-26** | 수정 파일: `SiteFooter.tsx`, `SiteHeader.tsx`, `account/page.tsx`, `AuditLogTab.tsx`, `BottomTabNavigation.tsx`, `MobileHostMenu.tsx`, `host/dashboard/Earnings.tsx`, `help/page.tsx`, `host/help/page.tsx`, `host/dashboard/page.tsx`, `host/dashboard/InquiryChat.tsx`, `guest/inbox/page.tsx`, `host/dashboard/components/ProfileEditor.tsx`

- [x] **푸터 Admin 링크 제거 (전역 노출 축소):**
  - `SiteFooter`의 지원 섹션에서 `Admin` 링크를 제거해 공개 푸터를 통한 관리자 경로 노출을 차단.
- [x] **프로필 메뉴 Admin 조건부 노출 (Whitelist 기준):**
  - `SiteHeader` 드롭다운과 모바일 `account` 메뉴에서 `admin_whitelist.email` 매칭 사용자에게만 `Admin` 메뉴를 렌더링하도록 분기 적용.
- [x] **Admin Audit Logs 하단 홈 복귀 CTA 추가:**
  - `AuditLogTab` 하단 안내영역에 `/` 이동 버튼을 추가해 어드민 콘솔에서 일반 웹 홈으로 즉시 복귀 가능하도록 UX 보완.
- [x] **호스트 모드 Help 진입 시 게스트 전환 체감 제거:**
  - `host/help/page.tsx` 라우트 신설 및 `help/page.tsx`의 경로 기반 초기 탭(`host`) 동기화 처리.
  - 호스트 측 Help 진입 링크(`MobileHostMenu`, `Earnings`, `SiteHeader`)를 `/host/help`로 통일.
  - `BottomTabNavigation`에 `/host/help`를 호스트 내비게이션 허용 경로로 추가.
- [x] **모바일 채팅 패널 고정 높이화 (호스트/게스트):**
  - `InquiryChat`, `guest/inbox`의 모바일 채팅창을 `fixed` 패널로 전환하여 메시지 수와 무관하게 높이를 일정하게 유지.
  - 하단 입력 바를 `BottomTabNavigation` 위(`safe-area + 탭 높이`)에 고정 배치해 입력창 가림/들쭉날쭉 높이 문제를 해소.
- [x] **호스트 대시보드 모바일 뒤로가기 추가:**
  - `host/dashboard/page.tsx`에 모바일 전용 상단 뒤로가기 버튼을 도입해 각 탭에서 하단 메뉴 의존 없이 직관적 복귀 동선을 제공.
- [x] **호스트 프로필 설정 탭 모바일 타이포/레이아웃 최적화:**
  - `ProfileEditor`의 `공개 프로필/비공개 정보` 영역에서 모바일 텍스트 크기, 패딩, 섹션 밀도를 축소하고 `md:` 분기 유지로 데스크탑 레이아웃 영향 없이 가독성 개선.
- [x] **게스트 메시지함 모바일 뒤로가기 안정화:**
  - 모바일 채팅 화면 뒤로가기 시 `clearSelected + router.replace('/guest/inbox')`로 상태/URL을 정리하여 채팅 선택 상태 잔존 리스크를 축소.

---

## 5. 🚧 핵심 개발 규칙 (Development Rules)

### 5.1 반드시 지켜야 할 코딩 수칙 (DOs)
1.  **안전한 쿼리 사용 (Crucial):**
    - `.single()` 대신 반드시 **`.maybeSingle()`**을 사용하여 데이터 부재 시 500 에러를 방지할 것.
2.  **어드민 데이터 조립 원칙:**
    - Supabase의 복잡한 Join 쿼리는 400 Bad Request의 원인이 되므로, **Raw Data 페칭 후 JS Map을 활용한 Manual Join**을 수행할 것. (현재 `useAdminData.ts` 방식 유지)
3.  **실시간 기능 (Realtime):**
    - `supabase.channel` 사용 시, 반드시 `useEffect`의 `return` 문에서 `.removeChannel()` 및 이벤트 리스너 제거(`removeEventListener`)를 수행할 것.
4.  **Hydration Error 방지:**
    - `localStorage`, `Date` 등을 다룰 때는 반드시 `useEffect` 내부나 `isClient` 플래그를 사용하여 서버/클라이언트 렌더링 불일치를 막을 것.
5.  **에러 핸들링:**
    - 사용자 액션 실패 시 `console.error`에 그치지 말고 `useToast`를 통해 UI 피드백을 제공할 것.
6. **사전 교차 검증 (Pre-Analysis & Double Check):**
    - 코드를 수정하거나 기능을 추가하기 전, 반드시 연관된 컴포넌트, Hook, API 파일의 전체 흐름을 최소 2회 이상 정독하고 꼼꼼히 분석할 것. 섣부른 수정으로 기존 데이터 로직이 꼬이거나 예상치 못한 부작용(Side-effect)이 발생하는 것을 철저히 방지해야 함.
7. **무결성 유지 원칙 (Zero-Disruption Policy):**
    - 새로운 기능을 덧붙일 때, 기존에 정상 작동하던 기능, 세밀한 UI/UX 디자인(Tailwind 클래스 등), 애니메이션 로직이 단 1%라도 누락되거나 변형되어서는 안 됨. 항상 '보존'을 최우선으로 두고 확장할 것.
8. **핀셋 수정 (Pinpoint Editing):**
    - 요구사항을 반영할 때 컴포넌트 전체를 불필요하게 리팩토링하거나 갈아엎지 말 것. 목적을 달성할 수 있는 '최소한의 코드 라인'만 정확하게 찾아내어 수정/추가하는 핀셋 방식을 엄수할 것. (기존 코드는 최대한 건드리지 않음)
9. **보수적인 상태 관리 및 의존성 수정:**
    - 기존에 정의된 useState, useEffect의 의존성 배열(Dependency Array), Props 구조를 건드릴 때는 극도로 신중하게 접근할 것. 구조 변경이 불가피하다면, 변경 전 기존 기능이 완벽히 호환되는지 먼저 검토할 것.

### 5.2 금지 사항 (DON'Ts)
- **임의 UI 라이브러리 추가 금지:** Tailwind CSS 기반의 커스텀 디자인 시스템을 유지할 것.
- **직접적인 `window` 객체 접근 주의:** SSR 환경을 고려하여 방어 코드 없이 사용하지 말 것.
- **Admin Page 비대화 금지:** 로직은 `hooks/`로 분리하고, 페이지는 뷰 역할만 할 것.
- **🚫 모바일 수정 시 데스크탑 스타일 건드리기 절대 금지:** "모바일만 바꿔"라는 요청을 받았을 때, `md:` 접두사 없는 기존 Tailwind 클래스(데스크탑 스타일)를 절대 변경하거나 삭제하지 말 것. 모바일 전용 추가는 반드시 `text-[10px] md:text-sm` 형식으로 모바일값 먼저, 데스크탑값 `md:` 뒤에 붙이는 방식만 허용.
- **🚫 고정 픽셀 폰트 사이즈 단독 사용 금지:** `text-[10px]`, `text-[8px]` 등 고정 픽셀 크기를 단독으로 쓰면 데스크탑에서도 작게 보임. 반드시 `text-[10px] md:text-sm` 처럼 md: 데스크탑 대응 클래스를 함께 명시할 것.
- **🚫 `hidden md:flex` / `md:hidden` 블록 외부에서 반응형 미구분 스타일 사용 금지:** 데스크탑/모바일 분기가 필요한 레이아웃은 반드시 `hidden md:flex`(데스크탑 전용) + `md:hidden`(모바일 전용) 패턴으로 구분하여 작성할 것.
- **🚫 `fixed`, `absolute`, `z-[100]`, `inset-0` 등 position 속성 수정 시 극도 주의:** 이 속성들은 데스크탑/모바일 레이아웃 모두에 영향을 미침. 반드시 `md:static`, `md:relative` 등의 리셋 클래스를 함께 부착하여 데스크탑 영향도를 명시적으로 차단할 것.

### 5.3 📐 모바일/데스크탑 분리 개발 규칙 (Responsive Implementation Rules)

> **이 규칙은 과거 반복된 "모바일만 바꿨는데 웹사이트가 망가졌다" 이슈 재발 방지를 위해 신설되었습니다.**  
> **모바일 수정 요청 시 반드시 이 체크리스트를 따를 것.**

#### ✅ 수정 전 필수 체크리스트

1. **수정 대상 클래스에 `md:` 접두사가 없는가?** → 데스크탑 스타일이므로 **수정 금지**. 모바일 값만 앞에 추가하는 형태로 처리.
   ```
   // ❌ 잘못된 방식 — 데스크탑 스타일을 직접 수정
   <p className="text-[8px]">  ← 원래 text-sm이었던 클래스를 text-[8px]로 대체
   
   // ✅ 올바른 방식 — 모바일 값을 앞에 추가, 데스크탑 값 유지
   <p className="text-[8px] md:text-sm">
   ```

2. **고정 픽셀 폰트(`text-[Npx]`) 단독 사용인가?** → 반드시 `md:text-sm` 등 데스크탑 대응 클래스 병기.

3. **`fixed`, `inset-0`, `w-[100vw]`, `h-[100vh]`를 추가했는가?** → 반드시 `md:static md:inset-auto md:w-auto md:h-auto`로 데스크탑 리셋 클래스 함께 추가.

4. **모바일 전용 컴포넌트 블록인가?** → `md:hidden` 블록 내부 또는 `md:flex` 블록으로 완전 분리하여 데스크탑에 영향 없음을 보장.

5. **`overflow-hidden`, `min-h-0`, `h-screen` 등 레이아웃 구조 클래스를 건드렸는가?** → 부모-자식 구조 전체에 영향. 반드시 부모 컴포넌트까지 포함해 확인.

#### 📌 Tailwind 반응형 Breakpoint 기준 (이 프로젝트 기준)

| 접두사 없음 | `md:` | `lg:` |
|---|---|---|
| 모바일 (< 768px) | 태블릿 + 데스크탑 (≥ 768px) | 대형 화면 (≥ 1024px) |
| **기존 웹사이트 스타일과 동일** | **건드리면 웹사이트 영향** | **건드리면 대형 화면 영향** |

> **핵심 원칙:** `md:` 접두사가 없는 클래스 = 현재 웹사이트(데스크탑 포함) 스타일. 절대로 무단 변경 금지.

#### 🔁 모바일 전용 수정 표준 패턴

```tsx
// 패턴 1: 폰트 크기 (모바일 small + 데스크탑 normal)
<p className="text-[10px] md:text-sm">

// 패턴 2: 여백 (모바일 tight + 데스크탑 spacious)
<div className="p-2 md:p-6">

// 패턴 3: 레이아웃 분기 (모바일 카드 + 데스크탑 테이블)
<div className="block md:hidden"> {/* 모바일 전용 */}
<table className="hidden md:table"> {/* 데스크탑 전용 */}

// 패턴 4: 오버레이 (모바일 풀스크린 + 데스크탑 패널)
<div className="fixed inset-0 z-[100] md:static md:inset-auto md:z-0 md:w-auto md:h-auto">

// 패턴 5: fixed 요소의 모바일 위치 (BottomTabNavigation 높이 회피)
<div className="fixed bottom-[80px] md:bottom-6 ...">  // 토스트, 알림 등
```

#### 📌 Z-Index 표준 레이어 맵 (전체 프로젝트 기준)

| z-index | 컴포넌트 | 비고 |
|---------|---------|------|
| `z-[9999]` | HostModeTransition, Toast, SiteFooter 모달 | 최상위 |
| `z-[9990]` | GlobalTeamChat 슬라이드업 드로어 | 어드민 모바일 |
| `z-[9989]` | GlobalTeamChat 플로팅 버튼 | 어드민 모바일 |
| `z-[200]` | MobileSearchModal, MobileProfileView, LoginModal, ReviewModal | 일반 모달 |
| `z-[210]` | MobileSearchModal 하단 고정 바 | 모달 내부 |
| `z-[150]` | HostProfileModal, ExperienceClient 갤러리 | 체험 상세 |
| `z-[105]` | StickyActionSheet | 체험 예약 플로팅 바 |
| `z-[100]` | BottomTabNavigation, ChatMonitor Detail | 하단 탭 / 어드민 오버레이 |
| `z-[80]` | 어드민 Sidebar 드로어 | |
| `z-[70]` | 어드민 Sidebar 딤 배경 | |
| `z-[60]` | 어드민 모바일 헤더 | |
| `z-50` | SiteHeader(데스크탑), GlobalTeamChat 데스크탑 패널 | |
| `z-40` | HomeHero 모바일 sticky 헤더 | |
| `z-10` | 테이블 sticky 헤더, 모달 내부 헤더 | |

> **규칙:** `BottomTabNavigation = z-[100]`. 그 위에 떠야 하는 모바일 요소는 반드시 `z-[105]` 이상 사용. 단, `md:` 리셋을 반드시 병행할 것.

---

## 6. 🚀 향후 로드맵 (Future Roadmap)

### Phase 5: 글로벌 및 확장 (Next Steps)
- [ ] **SEO & i18n:** 다국어 지원 아키텍처 개편 (`next-intl` 도입 검토).
- [ ] **지도 서비스:** 국내(카카오맵) 및 해외(구글맵) 분기 처리 및 지도 기반 검색 구현.
- [ ] **메시징 고도화:** 현재의 단순 채팅을 넘어선 미디어 전송, 읽음 확인 등이 포함된 실시간 채팅 시스템.
- [ ] **모바일 추가 최적화:** 호스트 등록 폼(stepper) 간격 미세 튜닝, iOS Safari 실기기 QA 자동화.

### Phase 6: 운영 효율화 (Enterprise Admin)
- [ ] **RBAC 심화:** 슈퍼 관리자, 일반 관리자, 재무 담당자 등으로 권한 세분화.
- [ ] **데이터 분석:** 매출 추이, 인기 상품 등을 시각화하는 차트 대시보드 구현.
- [ ] **정산 자동화:** 정산 내역 엑셀 다운로드를 넘어선 자동 정산 스케줄러 구현.
