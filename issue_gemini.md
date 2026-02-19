# Locally 결제 시스템 심층 검토 보고서 (Gemini CLI)

작성일: 2026-02-19
검토 대상: 결제 콜백, 취소 API, 정산 로직, 프론트엔드 결제 페이지

---

## 🚨 CRITICAL - 보안 취약점 (즉시 수정 권장)

### 1. NicePay 결제 콜백 위변조 위험 (Signature 검증 부재)
- **파일:** `app/api/payment/nicepay-callback/route.ts`
- **현황:** `resCode === '0000'` 및 `amount` 검증만 수행하며, NicePay에서 제공하는 HMAC 서명(DataMesh/SignData) 검증 로직이 없습니다.
- **위험:** 공격자가 `moid`(주문번호)와 `amt`(금액) 정보를 알고 있다면, NicePay를 거치지 않고 직접 콜백 API에 POST 요청을 보내 실제 결제 없이 예약을 확정(`PAID`) 시킬 수 있습니다.
- **해결책:** NicePay 가이드에 따라 `SignData` 또는 `EdiDate` 기반의 HMAC 서명 검증 로직을 반드시 추가해야 합니다.

### 2. API 엔드포인트 인증 및 권한 검증 부재
- **파일:** 
  - `app/api/payment/cancel/route.ts`
  - `app/api/bookings/confirm-payment/route.ts`
- **현황:** 두 API 모두 `SUPABASE_SERVICE_ROLE_KEY`를 사용하여 데이터베이스를 직접 수정하지만, 요청자가 해당 권한이 있는지(로그인 여부, 본인 예약 여부) 전혀 검증하지 않습니다.
- **위험:** 
  - `cancel` API: `bookingId`만 알면 타인의 예약을 임의로 취소하고 환불을 발생시킬 수 있습니다.
  - `confirm-payment` API: 누구나 특정 예약의 입금을 확인 처리하여 예약을 강제로 확정할 수 있습니다.
- **해결책:** `supabase.auth.getUser()`를 호출하여 요청자의 세션을 확인하고, 해당 예약의 소유자(게스트 또는 호스트/어드민)인지 검증하는 로직을 추가해야 합니다.

---

## ⚠️ HIGH - 기능 결함 및 데이터 불일치

### 1. 결제 취소 API 응답 미검증
- **파일:** `app/api/payment/cancel/route.ts`
- **현황:** `fetch`를 통해 NicePay 취소 API를 호출한 후, 성공 여부를 확인하지 않고 즉시 DB 상태를 `cancelled`로 업데이트합니다.
- **위험:** PG사에서 취소가 실패(예: 잔액 부족, TID 오류 등)하더라도 시스템상으로는 취소된 것으로 처리되어 게스트는 돈을 못 받고 DB만 취소되는 데이터 불일치가 발생합니다.
- **해결책:** `fetch` 응답의 `resCode`를 확인하여 성공 시에만 DB를 업데이트하도록 수정해야 합니다.

### 2. 호스트 수익 통계 불일치 (취소 위약금 누락)
- **파일:** `app/host/dashboard/Earnings.tsx`
- **현황:** 호스트 대시보드에서 수익을 계산할 때 `status`가 `cancelled`인 예약은 무조건 제외합니다.
- **위험:** 관리자 정산 탭(`SettlementTab.tsx`)에서는 취소 위약금(`host_payout_amount > 0`)을 정산 대상으로 포함하지만, 호스트는 본인의 대시보드에서 이 금액을 확인할 수 없어 정산 금액에 의구심을 가질 수 있습니다.
- **해결책:** `Earnings.tsx`의 쿼리를 수정하여 `cancelled` 상태이더라도 `host_payout_amount > 0`인 건은 매출에 포함시켜야 합니다.

### 3. 환불 계산의 Timezone 불일치
- **파일:** `app/api/payment/cancel/route.ts`
- **현황:** `new Date()`를 사용하여 서버 시간을 기준으로 환불율을 계산합니다.
- **위험:** 서버가 UTC 기준일 경우 한국 시간(KST)과 9시간 차이가 발생하여, 환불 규정 경계에 있는 예약(예: 자정 직전 취소)의 환불 금액이 부정확하게 계산될 수 있습니다.
- **해결책:** 모든 시간 계산을 `Asia/Seoul` 기준으로 명시적으로 처리해야 합니다.

---

## ⚡ MEDIUM - 운영 및 코드 품질

### 1. 계좌번호 하드코딩 및 환경변수 관리 미흡
- **파일:** 
  - `app/experiences/[id]/payment/page.tsx`
  - `app/api/payment/cancel/route.ts`
- **현황:** 카카오뱅크 계좌번호가 프론트엔드 코드에 직접 작성되어 있고, `NICEPAY_MID` 등이 코드 내 폴백 값(`nicepay00m`)으로 존재합니다.
- **해결책:** 민감 정보 및 운영 설정값은 모두 `.env` 환경변수로 관리해야 합니다.

### 2. 무통장 입금 자동 취소 로직 부재
- **현황:** 프론트엔드에서는 "1시간 이내 미입금 시 자동 취소"라고 안내하고 있으나, 이를 실행할 백엔드 스케줄러(Cron Job)가 구현되어 있지 않습니다.
- **해결책:** Supabase Edge Functions + Cron 또는 별도의 스케줄러를 통해 미입금 예약을 자동으로 취소 처리하는 로직을 구현해야 합니다.

### 3. 이메일 발송 실패 무시
- **현황:** 예약 확정/취소 알림 이메일 발송 실패 시 `catch` 블록에서 로그만 남기고 무시합니다.
- **해결책:** 중요 알림의 경우 발송 실패 시 재시도 큐에 넣거나, 관리자에게 알림을 보내는 처리가 필요합니다.

---

## ✅ 권장 조치 순서

1.  **[CRITICAL]** NicePay 콜백 서명 검증 및 API 엔드포인트 권한 체크 로직 추가
2.  **[HIGH]** NicePay 취소 API 응답 결과에 따른 조건부 DB 업데이트 적용
3.  **[HIGH]** 호스트 대시보드(`Earnings.tsx`) 수익 계산 로직 보완 (위약금 포함)
4.  **[MEDIUM]** 계좌번호 환경변수화 및 Timezone 처리 보정
