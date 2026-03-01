# 🔬 Microscopic Full Code Audit Report: Locally-web

**Audit Date:** 2026-03-01  
**Project:** Locally-web (Production Readiness Review)  
**Auditor:** Antigravity (Principal Architect & Security Lead)

---

## 🔴 [Critical] 치명적 결함 및 보안 취약점

### 1. 전역 이메일/알림 스패밍 및 권한 우회 가능성
- **파일:** [`/app/api/notifications/email/route.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/api/notifications/email/route.ts) (Line 89-137)
- **내용:** 단일 알림 발송(`recipient_id` 사용 시) 시, 요청자가 해당 수신자에게 메시지를 보낼 권한이 있는지 확인하는 가드가 전혀 없습니다. 인증된 사용자라면 누구나 API를 직접 호출하여 타인에게 'Locally Team' 이름으로 이메일을 보내거나 DB 알림을 삽입할 수 있습니다.
- **해결 방안:** 발송 전 `senderId`와 `recipientId` 간의 관계(예: 예약 관계, 문의 관계)를 검증하거나, 관리자 전용으로 이 기능을 제한해야 합니다.

### 2. 팀 협업 알림 보안 가드 부재
- **파일:** [`/app/api/admin/notify-team/route.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/api/admin/notify-team/route.ts) (Line 9-14)
- **내용:** 일반 사용자 계정으로 로그인한 사람도 이 API를 호출하면 프로젝트 내 모든 관리자와 화이트리스트 사용자에게 이메일 폭탄을 보낼 수 있습니다. `auth.getUser()`로 로그인 여부만 확인하고 `isAdmin` 권한 확인이 누락되었습니다.
- **해결 방안:** 이메일 발송 로직 전단계에서 반드시 `users.role === 'admin'` 또는 `admin_whitelist` 체크를 수행해야 합니다.

### 3. 관리자 삭제 API의 테이블 화이트리스트 부재 (보안 취약점)
- **파일:** [`/app/api/admin/delete/route.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/api/admin/delete/route.ts) (Line 137)
- **내용:** 요청에서 넘어온 `table` 문자열을 그대로 사용하여 삭제 쿼리를 실행합니다. 공격자가 `admin_whitelist`, `profiles`, `admin_audit_logs` 등 민감한 테이블 이름을 넘길 경우 관리자 권한으로 데이터가 소멸될 위험이 있습니다.
- **해결 방안:** 삭제를 허용할 테이블 명칭(`experiences`, `bookings`, `reviews` 등)을 엄격하게 화이트리스트로 관리해야 합니다.

---

## 🟡 [Warning] 데이터 정합성 및 로직 위험 요소

### 1. 플랫폼 수수료/수익 계산 로직의 하드코딩 분산
- **파일:** 
  - [`supabase_booking_atomic_migration.sql`](file:///Users/sonhyungeun/Documents/locally-web/supabase_booking_atomic_migration.sql) (Line 112: `0.1` 수수료)
  - [`/app/api/bookings/confirm-payment/route.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/api/bookings/confirm-payment/route.ts) (Line 83: `0.8` 호스트 수익)
  - [`/app/api/payment/cancel/route.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/api/payment/cancel/route.ts) (Line 101: `0.8` 호스트 수익)
- **내용:** 예약 생성 시에는 10% 수수료를 붙이고(SQL), 정산 확정 시에는 매출의 80%를 호스트에게 줍니다(JS). 비즈니스 규칙이 변경될 경우 SQL과 여러 API 파일을 동시에 수정해야 하며, 계산 실수로 인해 정산 금액이 어긋날 위험이 매우 큽니다.
- **해결 방안:** 수수료/수익 배분 상수를 `app/constants/finance.ts` 등으로 중앙화하고, SQL 함수 대신 필요한 경우 RPC에서 파라미터로 받거나 계산 로직을 단일화해야 합니다.

### 2. 비원자적(Non-atomic) 연쇄 삭제 로직
- **파일:** [`/app/api/admin/delete/route.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/api/admin/delete/route.ts) (Line 68-128)
- **내용:** 사용자 삭제 시 연관 데이터를 JS의 `Promise.all`로 각각 삭제합니다. 중간에 네트워크 오류나 타임아웃 발생 시, 일부 데이터만 지워지고 일부는 남는(Orphaned records) 정합성 오류가 발생합니다.
- **해결 방안:** PostgreSQL의 `ON DELETE CASCADE` 외래키 설정을 활용하거나, DB Stored Procedure를 통해 트랜잭션 단위로 처리해야 합니다.

---

## 🟢 [Optimization] 성능 최적화 및 UX 개선

### 1. 채팅 목록 조회의 N+1 문제 및 잦은 Auth 호출
- **파일:** [`/app/hooks/useChat.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts) (Line 113-209)
- **내용:** 채팅 목록 호출 시 프로필, 호스트 지원서, 읽지 않은 메시지 수를 각각 별도의 `.in()` 쿼리로 호출합니다. 또한 메시지 전송 시마다 `auth.getUser()`를 반복 호출하여 네트워크 라운드트립이 낭비됩니다.
- **최적화 방향:** `supabase.rpc`를 사용하여 서버 단에서 Join된 데이터를 한 번에 가져오거나, Auth 정보를 Context에서 안정적으로 캐싱하여 재사용해야 합니다.

### 2. 실시간 채널 관리 효율화
- **파일:** [`/app/hooks/useChat.ts`](file:///Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts) (Line 422-454)
- **내용:** `useChat` 훅을 사용하는 모든 곳에서 개별 채널을 생성합니다. 대화방이 많아질 경우 클라이언트 측 채널 관리에 부담이 될 수 있습니다.
- **최적화 방향:** 전역 채팅 Context를 통해 단일 채널을 구독하고 이벤트를 분배하는 구조를 고려해볼 수 있습니다.

---

## ⚪ [Tech Debt] 기술 부채 및 코드 품질

### 1. 레거시 필드 및 미사용 타입 잔존
- **대상:** `profiles.school` 필드
- **내용:** `gemini.md`에 명시된 대로 실제 로직에서는 제거되었으나, `app/utils/profile.ts`의 타입 정의와 라벨 맵에는 여전히 남아 있어 혼동을 줄 수 있습니다.
- **정리:** 사용하지 않는 필드 관련 타입 멤버를 제거하여 인터페이스를 정갈하게 유지해야 합니다.

### 2. 광범위한 `any` 타입 사용
- **파일:** `app/utils/contentHelper.ts`, `app/utils/notification.ts`, `app/hooks/useChat.ts`
- **내용:** 데이터 객체나 Supabase 클라이언트를 `any`로 받아 타입 안정성을 해치고 있습니다. 
- **정리:** `InquiryListItem`, `SupabaseClient` 등 명확한 타입을 적용하여 런타임 에러를 사전에 방지해야 합니다.

### 3. 일관되지 않은 로깅 (Console Logging)
- **내용:** `console.log`와 `console.error`가 섞여 있으며, 프로덕션 환경에서 민감한 정보(사용자 이메일 등)가 노출될 수 있는 로그가 다수 포함되어 있습니다.
- **정리:** 프로덕션 빌드 시 로그를 제거하거나, 전역 Logger 유틸리티를 도입하여 보안과 관리 효율성을 높여야 합니다.

---

**보고서 요약:**  
보안 측면에서 **API 권한 검증 누락(🔴)**이 가장 시급한 수정 대상입니다. 또한, **정산 로직의 중앙 집중화(🟡)**가 이루어지지 않아 정식 출시 후 금전적 정합성 문제가 발생할 우려가 있습니다. 코드 품질 면에서는 `maybeSingle()` 전환이 잘 이루어져 있어 안정성이 높으나, 남아있는 `any` 타입과 레거시 필드에 대한 정리가 필요합니다.
