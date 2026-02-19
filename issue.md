🛡️ Locally 결제 시스템 통합 감사 마스터 보고서 (Master Report)
작성일: 2026-02-20
검토 범위: 결제 관련 API, 프론트엔드 결제 페이지, 관리자/호스트 대시보드, 정산 로직, 환경변수

📑 개요
결제 흐름 및 비즈니스 로직 전반을 심층 검토한 결과, 총 18개의 고유 이슈가 발견되었습니다. 보안 취약점 3건(CRITICAL), 데이터/기능 결함 3건(HIGH), 로직/운영 문제 6건(MEDIUM), 코드 품질 문제 2건(LOW)으로 분류됩니다. 특히 PG사 콜백 보안, API 엔드포인트 권한, 그리고 호스트 정산 누락 문제가 결합되어 있어 즉각적인 조치가 필요합니다.

🚨 CRITICAL — 즉시 조치 필요 (보안 및 권한)
[C-1] 핵심 인증키 환경변수(.env.local) 노출 위험
파일: .env.local, app/api/payment/nicepay-callback/route.ts, app/api/payment/cancel/route.ts

위험도: 치명적 (인프라 장악 및 과금 위험)

설명: .env.local 파일에 시스템 전체를 제어할 수 있는 주요 키가 평문으로 저장되어 있으며, Git에 커밋될 경우 심각한 보안 사고로 직결됩니다.

Supabase Service Role Key: RLS(Row Level Security)를 완전히 우회하여 전체 DB 접근 가능.

Gmail App Password: 이메일 계정 탈취 및 스팸 악용 가능.

Gemini API Key: 무단 AI 호출로 인한 막대한 금전적 과금 위험.

조치: .gitignore 확인 및 커밋 히스토리(BFG Repo Cleaner) 삭제. 노출된 모든 키 즉시 폐기 및 재발급. 이메일은 SendGrid/SES 등 전용 서비스로 전환 권장.

[C-2] NicePay 결제 콜백 위변조 검증 부재 (가짜 결제 생성 위험)
파일: app/api/payment/nicepay-callback/route.ts:30-36

위험도: 치명적

설명: NicePay 콜백 수신 시 resCode === '0000' 및 amount만 확인하며, HMAC 서명(DataMesh/SignData) 검증이 누락되어 있습니다. 공격자가 임의로 콜백을 호출하면 실제 결제 없이 예약을 확정(PAID)할 수 있습니다.

참고: 현재 코드에서는 resCode가 없을 때 '0000'을 기본값으로 할당하는 위험한 폴백 로직도 존재합니다.

조치: NicePay 가이드에 따른 SignData / EdiDate 기반 HMAC 서명 검증 로직 추가 및 resCode 기본값 폴백 제거.

[C-3] API 엔드포인트 인증 및 권한 검증(Authz) 전면 누락
파일: app/api/payment/cancel/route.ts:25, app/api/bookings/confirm-payment/route.ts

위험도: 치명적

설명: 두 API 모두 Service Role Key를 사용해 DB를 조작하지만, 호출자의 권한을 확인하지 않습니다.

취소(Cancel) API: bookingId만 알면 누구나 타인의 예약을 무단 취소 가능.

결제 확정(Confirm) API: 누구나 무통장 입금을 확인 처리하여 예약을 강제 확정 가능.

조치: supabase.auth.getUser()로 호출자의 세션을 확인하고, 예약의 소유자(게스트/호스트) 또는 관리자인지 검증하는 미들웨어 추가.

🛑 HIGH — 우선순위 높음 (비즈니스 로직 및 데이터 정합성)
[H-1] 호스트 수익 통계 불일치 (취소 위약금 누락)
파일: app/host/dashboard/Earnings.tsx, app/admin/dashboard/components/SettlementTab.tsx

위험도: 높음

설명: 호스트 대시보드(Earnings.tsx)에서는 status === 'cancelled'인 예약을 무조건 수익에서 제외합니다. 하지만 관리자 정산 탭에서는 취소 위약금(host_payout_amount > 0)을 정산 대상에 포함합니다. 이로 인해 호스트가 보는 수익과 실제 정산액이 달라져 CS 클레임이 발생할 수 있습니다.

조치: 호스트 대시보드의 수익 계산 쿼리를 수정하여, 취소된 예약이더라도 host_payout_amount > 0인 건은 매출에 합산되도록 로직 변경.

[H-2] NicePay 취소 API 응답 결과 미검증 (데이터 불일치)
파일: app/api/payment/cancel/route.ts:79-84

위험도: 높음

설명: fetch로 PG사 취소를 호출한 뒤, 응답 코드를 확인하지 않고 무조건 DB를 cancelled로 업데이트합니다. PG사 잔액 부족이나 오류로 취소가 실패해도 DB는 취소 처리되어 고객은 환불을 받지 못하는 사태가 발생합니다.

조치: PG사 취소 API의 응답값을 파싱하여, 실제 성공했을 경우에만 DB 트랜잭션을 실행하도록 수정.

[H-3] 환불 계산 기준 시간(Timezone) 불일치
파일: app/api/payment/cancel/route.ts:7-21

위험도: 높음

설명: 환불율 계산 시 new Date()를 사용하여 서버 로컬 시간을 기준으로 삼습니다. 서버가 UTC일 경우 한국 시간(KST)과 9시간 오차가 발생하여, 자정 직전/직후 취소 시 고객의 환불율이 잘못 계산됩니다.

조치: date-fns-tz를 사용하여 타임존을 Asia/Seoul로 명시적 고정.

⚠️ MEDIUM — 중요도 보통 (운영 안정성 및 엣지 케이스)
[M-1] 계좌번호 하드코딩 및 환경변수 폴백 관리 미흡
파일: app/experiences/[id]/payment/page.tsx:291, app/api/payment/cancel/route.ts:72

설명: 카카오뱅크 계좌번호가 프론트엔드에 하드코딩되어 있으며, NICEPAY_MID가 누락될 경우 테스트용 MID(nicepay00m)로 무분별하게 폴백됩니다.

조치: 하드코딩된 값을 .env 환경변수 또는 DB 세팅 테이블로 분리. NICEPAY_MID 누락 시 폴백 대신 에러를 반환하여 프로덕션 사고 방지.

[M-2] 무통장 입금 자동 취소 스케줄러(Cron) 부재
파일: app/experiences/[id]/payment/page.tsx, app/experiences/[id]/payment/complete/page.tsx

설명: 프론트엔드는 "1시간 이내 미입금 시 자동 취소"를 안내하지만, 실제 백엔드에서 이를 처리하는 스케줄러가 없습니다.

조치: Supabase Edge Functions + Cron 또는 Vercel Cron Jobs를 활용하여 만료된 PENDING 예약을 자동 취소하는 로직 구현.

[M-3] 취소 API Rate Limiting 부재
파일: app/api/payment/cancel/route.ts

설명: 단시간 내 중복 취소 요청 시 PG사에 다중 요청이 전송될 위험이 있습니다.

조치: 식별자(IP 또는 UserID) 기반 Rate Limiting 구현 및 DB 상태 사전 검증 로직 강화.

[M-4] 부분 취소 시 호스트 정산 불일치
파일: app/api/payment/cancel/route.ts:68-93

설명: NicePay 부분 취소(Partial Cancel) 호출 후, 이미 기록된 호스트 정산 데이터(payouts 테이블)를 업데이트하는 로직이 누락되어 있습니다.

[M-5] 패널티 계산의 매직 넘버(/ 1.1) 미문서화
파일: app/api/payment/cancel/route.ts:60

설명: 위약금 계산 중 Math.floor(penaltyAmount / 1.1) 로직의 근거(VAT 10% 제거 추정)가 주석으로 명시되어 있지 않아 유지보수에 혼선을 줍니다. 수수료율 상수로 분리 필요.

[M-6] 중요 알림 이메일 발송 실패 무시
파일: app/api/payment/nicepay-callback/route.ts:153-155

설명: 이메일 발송 에러 발생 시 로그만 남기고 무시합니다.

조치: 예약 확정/취소 등 중요 메일은 재시도 큐에 등록하거나 관리자 슬랙(Slack) 알림 등으로 폴백 처리.

🛠️ LOW — 낮은 우선순위 (코드 정리)
[L-1] 프로덕션 콘솔 로그(민감 정보) 노출
파일: app/api/payment/nicepay-callback/route.ts, app/api/payment/cancel/route.ts

설명: [DEBUG] 태그로 주문 ID, 금액, 이메일 주소 등이 Vercel 프로덕션 로그에 그대로 출력됩니다. 개발 환경(NODE_ENV) 분기 처리가 필요합니다.

[L-2] 미사용 결제 SDK 방치
파일: package.json

설명: 실제로는 NicePay를 사용 중이나, @tosspayments/payment-widget-sdk가 설치되어 번들 용량을 차지하고 있습니다. 사용 계획이 없다면 제거를 권장합니다.

🗺️ 단계별 실행 로드맵 (Action Items)
Phase 1 (오늘 즉시 처리): * .env.local 유출 점검 및 C-1 키 전면 재발급

C-2 (NicePay HMAC 검증 로직 추가)

C-3 (API 권한 및 세션 검증 로직 추가)

Phase 2 (이번 주 내 처리):

H-1 (호스트 대시보드 위약금 정산 로직 수정)

H-2 (PG 취소 API 응답 연동 DB 업데이트)

H-3 (KST 타임존 보정)

Phase 3 (다음 주 내 처리):

M-1, M-2, M-5 (환경변수화, 자동 취소 Cron, 매직넘버 상수화)

Phase 4 (백로그):

Rate Limit 적용, 이메일 큐 구축, 불필요한 로그 및 SDK 정리