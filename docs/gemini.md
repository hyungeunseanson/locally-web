# 📘 Locally-Web Project Bible (GEMINI.md)

**Last Updated:** 2026-02-22
**Version:** 2.4.1 (Complete Refactoring & Translation System Fix)
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

**전체 진행률: 약 85%** (시스템 안정화 및 최적화 완료)

### Phase 1: 기반 구축 (Foundation) - ✅ 완료
- [x] Supabase Auth & Profile 시스템
- [x] 상품(Experience) CRUD 및 이미지 업로드
- [x] 메인 검색 및 필터링 (다국어 지원)

### Phase 2: 결제 및 예약 (Commerce) - ✅ 완료
- [x] Toss Payments & NicePay 연동
- [x] 예약 확정/취소 및 환불 프로세스 (트랜잭션 처리)
- [x] 오버부킹 방지 로직

### Phase 3: 관리자 시스템 고도화 (Admin 2.0) - ✅ 완료
- [x] **실시간 팀 협업 탭 (TeamTab):**
  - Daily Log (업무 일지), Threaded Todo (댓글형 투두), Shared Memo (문서형 메모장).
  - **스마트 알림:** 신규 글/댓글 발생 시 사이드바 및 리스트에 'N' 배지 노출.
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
- [x] **상세 페이지 및 목록 밀도(Dense) 최적화:**
  - 모바일 진입 시 사진 벤토 그리드(Bento Grid) 및 일정 타임라인 UI 등 모바일 최적화 컴포넌트로 자동 분기 (`md:hidden`).
  - 우측 예약 카드가 밀려 내려가는 것을 막기 위해 하단 플로팅 예약 바(`StickyActionSheet`) 전격 적용.
  - 메시지함, 마이페이지의 박스 보더를 없애고 Edge-to-edge 스타일의 네이티브 리스트 스킨 구현.

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
7. **핀셋 수정 (Pinpoint Editing):**
    - 요구사항을 반영할 때 컴포넌트 전체를 불필요하게 리팩토링하거나 갈아엎지 말 것. 목적을 달성할 수 있는 '최소한의 코드 라인'만 정확하게 찾아내어 수정/추가하는 핀셋 방식을 엄수할 것. (기존 코드는 최대한 건드리지 않음)
7. **보수적인 상태 관리 및 의존성 수정:**
    - 기존에 정의된 useState, useEffect의 의존성 배열(Dependency Array), Props 구조를 건드릴 때는 극도로 신중하게 접근할 것. 구조 변경이 불가피하다면, 변경 전 기존 기능이 완벽히 호환되는지 먼저 검토할 것.

### 5.2 금지 사항 (DON'Ts)
- **임의 UI 라이브러리 추가 금지:** Tailwind CSS 기반의 커스텀 디자인 시스템을 유지할 것.
- **직접적인 `window` 객체 접근 주의:** SSR 환경을 고려하여 방어 코드 없이 사용하지 말 것.
- **Admin Page 비대화 금지:** 로직은 `hooks/`로 분리하고, 페이지는 뷰 역할만 할 것.

---

## 6. 🚀 향후 로드맵 (Future Roadmap)

### Phase 5: 글로벌 및 확장 (Next Steps)
- [ ] **SEO & i18n:** 다국어 지원 아키텍처 개편 (`next-intl` 도입 검토).
- [ ] **지도 서비스:** 국내(카카오맵) 및 해외(구글맵) 분기 처리 및 지도 기반 검색 구현.
- [ ] **메시징 고도화:** 현재의 단순 채팅을 넘어선 미디어 전송, 읽음 확인 등이 포함된 실시간 채팅 시스템.

### Phase 6: 운영 효율화 (Enterprise Admin)
- [ ] **RBAC 심화:** 슈퍼 관리자, 일반 관리자, 재무 담당자 등으로 권한 세분화.
- [ ] **데이터 분석:** 매출 추이, 인기 상품 등을 시각화하는 차트 대시보드 구현.
- [ ] **정산 자동화:** 정산 내역 엑셀 다운로드를 넘어선 자동 정산 스케줄러 구현.
