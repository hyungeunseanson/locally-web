# Locally-Web Project Guide (GEMINI.md)

**Last Updated:** 2026-02-26  
**Version:** 3.2.0 (Mobile UI & Profile Sync)  
**Purpose:** 코드 계획/구현 시 참조하는 단일 운영 기준 문서

---

## 1. 프로젝트 개요

### 1.1 미션
Locally는 현지인 호스트(Local Host)와 여행자(Guest)를 연결하는 C2C 로컬 체험 여행 플랫폼이다.

### 1.2 핵심 기술 스택
- Frontend: Next.js 14+ (App Router), TypeScript (strict)
- Styling: Tailwind CSS (커스텀 디자인 시스템, 외부 UI 라이브러리 미사용)
- Backend: Supabase (PostgreSQL/Auth/Realtime/Storage)
- State:
  - Global: Context API (Auth/Toast/Notification/Language)
  - Server State: TanStack Query (Guest/Host)
  - Local: React Hooks
- Payment: Toss Payments, NicePay
- Date/i18n: date-fns(ko), LanguageContext + contentHelper (ko/en/ja/zh)

---

## 2. 아키텍처 원칙

### 2.1 디렉토리 구조
```bash
/app
├── admin/
├── host/
├── guest/
├── experiences/
├── api/
├── components/
├── context/
├── hooks/
├── lib/
├── types/
└── utils/
```

### 2.2 Admin 구조
- `page.tsx`: 뷰/탭 라우팅
- `hooks/useAdminData.ts`: 데이터 페칭/조립/실시간/액션 호출
- `types/admin.ts`: 관리자 전용 타입 중앙화

원칙:
- Admin page는 비대화하지 않고, 로직은 `hooks/`로 분리한다.
- 복잡 Join은 Raw fetch + JS 조립(Manual Join)을 기본으로 한다.

---

## 3. 데이터/보안 기준

### 3.1 핵심 테이블 (요약)
| 분류 | 테이블 | 비고 |
| :--- | :--- | :--- |
| 사용자/권한 | `profiles`, `admin_whitelist` | `profiles.role` 기반, whitelist 예외 허용 |
| 상품/예약/결제 | `experiences`, `bookings` | 예약 상태는 서버 검증 기준 | 
| 소통/리뷰 | `inquiries`, `inquiry_messages`, `reviews` | 채팅/리뷰 연동 |
| 운영 | `admin_tasks`, `admin_task_comments`, `audit_logs` | 협업/로그 |

### 3.2 권한 원칙
- 기본: 인증 사용자 + 본인 데이터 범위
- 관리자: `profiles.role='admin'` 또는 `admin_whitelist` 매칭
- 민감 API는 반드시 서버에서 권한 확인 후 처리

### 3.3 결제/정합성 원칙
- 결제 확정/취소는 서버 검증 경로를 단일 소스로 유지
- PG 응답 성공 확인 후 DB 상태 변경
- 클라이언트 직접 결제 상태 변경 금지

---

## 4. 현재 상태 요약 (핵심만)

- 결제/보안: NicePay 서명 검증, 결제 확정/취소 API 권한 검증 반영
- 데이터 무결성: 클라이언트 직접 DB 쓰기 제거, 서버 중심 예약/정산 흐름 통합
- 안정성: 광범위한 `.single()` -> `.maybeSingle()` 전환
- 모바일 UX: BottomTabNavigation 충돌/가림/z-index/뒤로가기 이슈 정리
- 모바일 정보/커뮤니티/뉴스/공지 레이아웃 최적화 및 게스트 프로필(모바일/데스크탑) 기준 정렬
- Admin: Team Chat 가시성/알림 배지/모바일 디테일 화면 안정화
- Host: 권한 스코프, 예약/수익 집계 기준, Realtime 범위 검증 정리

비고: 상세 변경 로그(파일 단위 픽셀 조정, 과거 패치 서술)는 별도 커밋 이력/문서에서 확인한다.

---

## 5. 필수 개발 규칙

### 5.1 DO
1. Supabase 단건 조회는 기본적으로 `.maybeSingle()`을 우선 사용한다.
2. Admin 복잡 Join은 Raw fetch + JS 조립(현행 `useAdminData` 패턴)으로 처리한다.
3. Realtime 구독은 `useEffect` cleanup에서 채널/리스너를 반드시 해제한다.
4. SSR/CSR 불일치가 생길 수 있는 `window`, `localStorage`, `Date` 접근은 `useEffect` 또는 client guard로 분리한다.
5. 실패 처리 시 로그만 남기지 말고 사용자 피드백(Toast)을 제공한다.
6. 수정 전 연관 컴포넌트/훅/API 흐름을 교차 검증하고, 핀셋 수정(최소 변경)을 우선한다.

### 5.2 DON'T
- 외부 UI 라이브러리 임의 추가 금지
- Admin 페이지에 비즈니스 로직 과적재 금지
- 모바일 수정 시 데스크탑 스타일 회귀 유발 금지
- `text-[Npx]` 단독 사용 금지 (항상 `md:` 데스크탑 값 병기)
- 반응형 분기가 필요한 UI를 `md:hidden` / `hidden md:*` 없이 혼용 금지

---

## 6. 반응형/레이아웃 규칙

### 6.1 핵심 원칙
1. `md:` 없는 기존 클래스는 기존 웹 스타일에 영향을 주므로 직접 치환하지 않는다.
2. 모바일 변경은 `text-[10px] md:text-sm`처럼 모바일 우선 + 데스크탑 보존 방식으로 적용한다.
3. `fixed/absolute/inset/z-*` 변경 시 `md:static`, `md:inset-auto` 등 리셋을 함께 둔다.
4. 데스크탑/모바일 분기가 필요한 UI는 `md:hidden` / `hidden md:*` 패턴으로 구조를 분리한다.
5. BottomTabNavigation과 겹치는 고정 UI는 모바일에서 `bottom-[80px] md:bottom-*` 패턴을 기본으로 점검한다.

### 6.2 Breakpoint 기준
| 접두사 없음 | `md:` | `lg:` |
| --- | --- | --- |
| 모바일 (< 768px) | 태블릿 + 데스크탑 (≥ 768px) | 대형 화면 (≥ 1024px) |

### 6.3 z-index 기준 (요약)
- `z-[9999]`: 최상위 전역 모달/토스트
- `z-[200]`: 일반 모달
- `z-[150]`: 상세/갤러리 오버레이
- `z-[105]`: 예약 플로팅/모바일 상위 고정 요소
- `z-[100]`: BottomTabNavigation 기준 레이어
- `z-[80]`: Admin Sidebar

---

## 7. 백로그 (유지)

- 지도 기반 검색 (국내/해외 지도 분기)
- 메시징 기능 확장 (미디어, 읽음 상태 등)
- Admin 권한 세분화(RBAC)
- 정산/운영 자동화 강화

---

## 8. 문서 운영 규칙

- 이 문서는 “현재 유효한 구현 기준”만 유지한다.
- 중복/과장/과거 상세 로그는 누적하지 않는다.
- 대규모 변경 시 이 문서에는 결정사항만 요약하고, 상세 이력은 별도 문서 또는 커밋에 남긴다.
