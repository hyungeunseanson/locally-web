# 로컬리(Locally) app 폴더 코드 분석 보고서

**분석 일자:** 2025-02-17  
**대상:** `app/` 폴더 전체 (약 118개 파일)  
**기준:** `.cursorrules` 규칙 및 프로젝트 목표

---

## 1. 현재 상황 요약

### 1.1 잘 하고 있는 부분 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| **기술 스택** | 준수 | Next.js App Router, TypeScript, Tailwind, Supabase, Lucide 사용 |
| **레이아웃/메인** | 양호 | 루트 레이아웃에 Toast/Language/Notification Provider, Suspense로 UserPresenceTracker·GoogleTranslate 감쌈 |
| **게스트·호스트 분리** | 구현됨 | 헤더에서 "호스트 등록하기 / 게스트 모드로 전환" 버튼, `/host`, `/guest` 경로 분리 |
| **다국어(i18n)** | 구현됨 | LanguageContext(ko/en/ja/zh), GoogleTranslate 보조 버튼, contentHelper 다국어 필드 |
| **토스트 피드백** | 구현됨 | ToastContext + useToast, 호스트 체험 등록 등에서 사용 |
| **디자인 톤** | 대체로 일치 | rounded-xl/2xl/full, shadow-sm/md/lg, slate-900/700, 넉넉한 여백 다수 적용 |
| **일부 useSearchParams** | 방어됨 | search, guest/inbox, host/dashboard, payment 관련 페이지는 Suspense 또는 Content 분리로 감쌈 |

### 1.2 .cursorrules와의 차이·보강 필요 사항 ⚠️

---

## 2. .cursorrules 대비 차이 및 보강 포인트

### 2.1 ⚠️ Next.js 정적 빌드 방어 (useSearchParams)

**규칙:** `useSearchParams` 사용 시 반드시 `<Suspense>`로 감싸거나 mounted 후 클라이언트에서만 실행.

**현재:**

- **Suspense로 보호된 곳:**  
  `search/page.tsx`, `guest/inbox/page.tsx`, `host/dashboard/page.tsx`,  
  `experiences/[id]/payment/page.tsx`, `payment/success/page.tsx`,  
  `experiences/[id]/payment/complete/page.tsx`  
  → 각각 `SearchResults`, `InboxContent`, `DashboardContent`, `PaymentContent`, `SuccessContent`, `PaymentCompleteContent`를 Suspense로 감쌈.

- **보호되지 않은 곳 (보강 필요):**
  1. **`app/admin/dashboard/page.tsx`**  
     페이지 기본 export에서 바로 `useSearchParams()` 호출.  
     → **권장:** `AdminDashboardContent` 같은 내부 컴포넌트에서만 useSearchParams 사용하고, default export에서 `<Suspense><AdminDashboardContent /></Suspense>`로 감싸기.
  2. **`app/admin/dashboard/components/Sidebar.tsx`**  
     컴포넌트 내부에서 `useSearchParams()` 직접 사용.  
     → **권장:** admin layout에서 Sidebar를 `<Suspense fallback={…}><Sidebar /></Suspense>`로 감싸기.
  3. **`app/host/dashboard/InquiryChat.tsx`**  
     `useSearchParams()` 직접 사용.  
     → **권장:** 이 컴포넌트를 사용하는 부모(host/dashboard)가 이미 Suspense 안에 있으므로, 빌드 시 동적 렌더링 이슈가 없다면 유지 가능. 다만 규칙을 엄격히 적용하려면 InquiryChat만 감싼 Suspense를 두는 것도 방법.

**요약:** admin 대시보드 페이지와 admin Sidebar는 Suspense로 한 번 더 감싸는 것이 .cursorrules와 빌드 안정성 측면에서 좋습니다.

---

### 2.2 ⚠️ 에러 처리: console.error만 쓰고 토스트 없는 곳

**규칙:** `console.error`만 쓰지 말고 사용자에게 `toast` 등으로 피드백.

**현재:** 아래 파일들에서 에러 시 `console.error`만 있고 `showToast`(또는 유사) 호출이 없음.

- `app/hooks/useChat.ts` (2곳)
- `app/host/dashboard/components/ReservationManager.tsx`
- `app/host/experiences/[id]/dates/page.tsx` (2곳)
- `app/experiences/[id]/payment/page.tsx` (2곳)
- `app/host/create/page.tsx` (업로드 에러, 제출 에러)
- `app/search/page.tsx` (검색 에러)
- `app/guest/inbox/page.tsx`
- `app/guest/wishlists/page.tsx` (2곳)
- `app/notifications/page.tsx`
- `app/account/page.tsx`
- `app/help/page.tsx`
- `app/host/dashboard/page.tsx`, `Earnings.tsx`, `HostReviews.tsx`, `ProfileEditor.tsx`
- `app/host/register/page.tsx`
- `app/experiences/[id]/components/ReviewSection.tsx`, `components/ReviewModal.tsx`
- `app/payment/success/page.tsx` (확정 처리 오류)
- `app/experiences/[id]/payment/complete/page.tsx` (예약 조회 실패)
- `app/admin/dashboard/page.tsx`, `DetailsPanel.tsx`, `AnalyticsTab.tsx`, `SettlementTab.tsx`

**권장:**  
- 사용자 액션이 실패했을 때 (예: 저장, 삭제, 로딩 실패) 해당 화면에서 `useToast()`를 쓰고 `showToast('메시지', 'error')` 추가.  
- API/서버 라우트는 로깅만 할지, 클라이언트에 에러 메시지를 넘겨 토스트를 띄울지 정책을 정한 뒤 일관되게 적용.

---

### 2.3 ⚠️ "바이브" / 사용자 친화 문구

**규칙:** "데이터 없음" 같은 개발자 용어보다 사용자 친화적 문구 (예: "등록된 체험이 없어요. 새로운 여행을 찾아보세요!").

**현재:**

- **적용된 예:**  
  `guest/wishlists/page.tsx`: "아직 찜한 체험이 없어요", "마음에 드는 체험을 찾아 하트를 눌러보세요!"  
  → 규칙에 잘 맞음.

- **보강 권장:**
  - **`app/page.tsx`** (메인 빈 결과):  
    현재 "검색 결과가 없습니다."  
    → 예: "이 조건에 맞는 체험이 없어요. 날짜나 지역을 바꿔보거나 전체 목록을 둘러보세요!"
  - **`app/search/page.tsx`** (검색 빈 결과):  
    현재 "검색 결과가 없습니다.", "다른 날짜나 키워드로 검색해보세요."  
    → 두 번째 문장은 이미 친절함. 첫 문장만 "이 조건에 맞는 체험이 없어요" 등으로 통일해도 좋음.
  - **`app/components/EmptyState.tsx`** 기본값:  
    "일치하는 데이터가 없습니다.", "조건을 변경하거나 필터를 초기화해보세요."  
    → 사용처에 따라 "등록된 체험이 없어요" 등 더 친근한 문구로 오버라이드하거나, 기본 subtitle을 조금 더 말걸기 좋게 수정 가능.
  - **`app/admin/dashboard/components/AnalyticsTab.tsx`**  
    "데이터 없음" (텍스트)  
    → 관리자용이라 완화 가능하지만, 규칙을 넓게 적용하면 "표시할 데이터가 없어요" 정도로 변경 가능.

---

### 2.4 ⚠️ 주석·설명 언어 (한국어)

**규칙:** 주석·설명·UI 텍스트는 한국어 기본.

**현재:**  
일부 파일에 영어 주석이 일부 있음 (예: `// Fetch data`, `// Handle error` 등).  
전체 비중은 낮지만, .cursorrules에 맞추려면 새로 쓰는 주석은 한국어로, 기존 영어 주석은 점진적으로 한국어로 바꾸면 좋습니다.

---

### 2.5 ⚠️ className 가독성

**규칙:** Tailwind `className`이 너무 길면 줄바꿈·정리.

**현재:**  
`app/components/HomeHero.tsx` 등 일부에서 한 줄에 매우 긴 className이 있음.  
예:

```tsx
className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md h-12 px-2 cursor-pointer z-[100] transition-all duration-300 ease-in-out ${isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'}`}
```

**권장:**  
여러 줄로 나누거나, 공통 스타일을 변수/클래스로 묶어서 가독성 확보.

---

### 2.6 🐛 버그 가능성: ExperienceCard 다국어

**위치:** `app/components/ExperienceCard.tsx`

- `const { language } = useLanguage();` 로 꺼내 쓰고 있음.
- `LanguageContext`는 `lang`을 제공함 (`lang`, `setLang`, `t`).
- 따라서 `language`는 `undefined`이고, `getContent(data, 'title', language)`에 `undefined`가 전달됨.
- `contentHelper.getContent`는 `!lang`이면 한국어 필드를 반환하므로, **현재는 항상 한국어만 나와서** 다국어 전환이 카드에서 동작하지 않을 가능성이 큼.

**수정 제안:**  
`const { lang } = useLanguage();` 로 바꾸고,  
`getContent(data, 'title', lang)` / `getContent(data, 'category', lang)` 처럼 `lang`을 넘기기.

---

### 2.7 기타 정리 권장

- **중복/임시 파일:**  
  `app/page copy.txt`, `app/help/page copy.txt`, `app/host/experiences/[id]/dates/page copy.txt`  
  → 백업이나 참고용이면 docs 등으로 옮기고, app 라우트에서는 제거하는 것이 좋음.
- **관리자 대시보드:**  
  `console.log` 디버깅 로그 일부 있음 (예: 예약 데이터 로드 완료).  
  → 배포 시 제거하거나 `process.env.NODE_ENV === 'development'` 조건으로 감싸기.

---

## 3. 구조·아키텍처 요약

- **라우팅:**  
  `/`(메인), `/search`, `/experiences/[id]`, `/guest/*`, `/host/*`, `/admin/*`, `/account`, `/notifications`, `/help`, `/payment/*` 등으로 역할이 잘 나뉘어 있음.
- **공통 UI:**  
  `SiteHeader`(모드 전환·언어·알림·메뉴), `SiteFooter`, `GoogleTranslate`, 메인 검색바·히어로는 `HomeHero` 등으로 재사용.
- **상태·부가 기능:**  
  LanguageContext, ToastContext, NotificationContext, useWishlist, useExperienceFilter, useChat 등으로 관심사가 나뉘어 있음.
- **데이터:**  
  Supabase 클라이언트(utils/supabase), 서버용(server), API Routes(결제·리뷰·알림 등) 사용.
- **디자인:**  
  전반적으로 rounded, shadow, slate 계열, 넉넉한 여백을 사용해 .cursorrules의 "에어비앤비 스타일"과 맞춤.  
  (일부 색상·여백은 페이지별로만 조정하면 됨.)

---

## 4. 우선순위별 액션 제안

| 우선순위 | 항목 | 액션 |
|----------|------|------|
| 1 (높음) | ExperienceCard 다국어 | `language` → `lang` 수정 |
| 1 | useSearchParams 방어 | admin dashboard 페이지·Sidebar를 Suspense로 감싸기 |
| 2 | 에러 피드백 | 자주 쓰는 플로우(예약/결제/저장/삭제)에 toast 추가 |
| 2 | 빈 결과 문구 | 메인/검색/EmptyState 기본 문구 사용자 친화적으로 조정 |
| 3 | 가독성 | 긴 className 줄바꿈·정리, 새 주석 한국어로 통일 |

이 순서로 적용하면 .cursorrules와의 정합성을 높이면서도 사용자 경험과 유지보수성이 함께 좋아질 것입니다.
