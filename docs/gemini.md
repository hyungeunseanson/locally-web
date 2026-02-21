# 📘 Locally-Web Project Bible (GEMINI.md)

**Last Updated:** 2026-02-21
**Version:** 2.2.0 (Admin 2.0 Refactoring & Whitelist & Ledger v2 Complete)
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

**전체 진행률: 약 70%** (관리자 시스템 고도화 완료)

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

### Phase 4: 글로벌 및 확장 (Next Steps)
- [ ] **SEO & i18n:** 다국어 지원 아키텍처 개편 (`next-intl` 도입 검토).
- [ ] **지도 서비스:** 국내(카카오맵) 및 해외(구글맵) 분기 처리 및 지도 기반 검색 구현.
- [ ] **메시징 고도화:** 현재의 단순 채팅을 넘어선 미디어 전송, 읽음 확인 등이 포함된 실시간 채팅 시스템.

### Phase 5: 운영 효율화 (Enterprise Admin)
- [ ] **RBAC 심화:** 슈퍼 관리자, 일반 관리자, 재무 담당자 등으로 권한 세분화.
- [ ] **데이터 분석:** 매출 추이, 인기 상품 등을 시각화하는 차트 대시보드 구현.
- [ ] **정산 자동화:** 정산 내역 엑셀 다운로드를 넘어선 자동 정산 스케줄러 구현.
