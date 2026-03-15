# Locally-Web Project Guide (GEMINI.md)

**Last Updated:** 2026-03-15 (v3.38.93 locale canonical / sitemap 일관성 정렬)
**Version:** 3.38.93 (Locale Canonical and Sitemap Alignment)
**Purpose:** 코드 계획/구현 시 참조하는 단일 운영 기준 문서

---

## 1. 프로젝트 미션

Locally는 현지인 호스트(Local Host)와 여행자(Guest)를 연결하는 C2C 로컬 체험 여행 플랫폼이다.

---

## 2. 아키텍처 원칙

### 2.1 Admin 구조
- `page.tsx`: 뷰/탭 라우팅 (탭: APPROVALS/USERS/LEDGER/SALES/SERVICE_REQUESTS/ANALYTICS/CHATS/TEAM/ALERTS)
- 관리자 대시보드의 레거시 공통 훅 `hooks/useAdminData.ts`는 제거되었고, 탭별 경량 훅/전용 admin API(`useAdminApprovalsData`, `useAdminUsersData`, `/api/admin/*`)가 단일 source다.
- `hooks/useServiceAdminData.ts`: service_bookings 전용 독립 훅 (v3.9.0 신설, v3.9.3부터 `/api/admin/service-bookings` 경유)
- `components/ServiceAdminTab.tsx`: 맞춤 의뢰 관리 탭 — 전체 의뢰 / 정산 대기 / 취소·환불 내역 (v3.9.0 신설)
- `components/AdminAlertsTab.tsx`: 관리자 운영 인앱 알림 누적 탭 (`notifications` 재사용)
- `/api/admin/inquiries/[id]/status`: ChatMonitor 관리자 1:1 문의 상태 변경 전용 API (`admin`/`admin_support` 문의만 `open → in_progress → resolved` 변경 + audit log)
- `/api/admin/alerts`: Admin Alerts 전용 서버 읽기 API (현재 로그인 관리자 본인의 `admin_alert` 알림 100건)
- `/api/admin/alerts/[id]`: Admin Alerts 전용 서버 단건 API (읽음 처리 / 삭제)
- `/api/admin/alerts/read-all`: Admin Alerts 전용 전체 읽음 처리 API
- `/api/admin/team/tasks`: Team Workspace `Daily Log / TODO / MEMO` 생성 전용 API (`TeamTab` create 경계 서버화)
- `/api/admin/team/tasks/[id]`: Team Workspace 작업 수정 / 삭제 API (`TeamTab` 상태 변경, 메모 수정, 작업 삭제 전용)
- `/api/admin/team/comments`: Team Workspace TODO/MEMO 댓글 + Team Chat 메시지 생성 API (`TeamTab`, `GlobalTeamChat`, `MiniChatBar` direct insert 제거)
- `/api/admin/team/comments/[id]`: Team Chat reaction 저장 API (`GlobalTeamChat` direct update 제거)
- `/api/admin/team/whitelist`: Team Workspace Admin Whitelist 추가 API
- `/api/admin/team/whitelist/[id]`: Team Workspace Admin Whitelist 삭제 API (+ audit log)
- `/api/admin/team-counts`: Team Workspace 사이드바 배지 집계 API (`lastViewed` 기준 새 작업/댓글 개별 count + 합산 `newWorkspaceCount`)
- `types/admin.ts`: 관리자 전용 타입 중앙화 (`AdminServiceBooking` 포함)
- `/api/admin/users-summary`: User Management/Analytics 공용 경량 회원 목록 API (`profiles + users.role` 병합)
- `/api/admin/users-activity-summary`: User Management 리스트 전용 활동 summary API (`총 결제액/예약·의뢰 수/최근 활동` 지연 집계)
- `/api/admin/users/[userId]/timeline`: User Management 상세 패널용 회원 활동 타임라인 API (예약/리뷰/문의 진행/맞춤 의뢰 상태 이벤트 조립)
- `/api/admin/analytics-summary`: Data Analytics `Business & Guest` 전용 서버 집계 API (상단 비즈니스 KPI, 반복 결제 고객 비율, 결제 고객 인구통계는 체험 예약 + 서비스 결제 기준, 검색/Top 체험은 기존 체험 중심 기준 유지)
- `/api/admin/analytics-search-intent`: Data Analytics `고객 검색 수요 분석` 전용 서버 집계 API (검색량 TOP, 급상승, 공급 부족, 동일 세션 기준 참고용 검색→클릭/결제 시작 전환 + 유입 source별 대표 검색 수요 조립)
- `/api/admin/analytics-customer-composition`: Data Analytics `고객 구성 분석` 전용 서버 집계 API (체험 예약 + 서비스 결제 고객 기준 국적, 언어권, 신규/반복, 체험/서비스 선호 조립 + 추적된 고객 기준 유입 source/가입→결제 전환/결제액/반복 고객/주요 고객 국적·언어 참고용 집계)
- `/api/admin/reviews`: Data Analytics `Review Quality` 전용 서버 읽기 API (리뷰 + 게스트 프로필 + 체험 제목 조립)
- `/api/admin/reviews/[id]`: Data Analytics `Review Quality` 전용 서버 삭제 API (관리자 권한 확인 후 리뷰 삭제 + audit log)
- `/api/admin/audit-logs`: Data Analytics `운영 감사 로그` 전용 서버 읽기 API (최근 100개 admin_audit_logs)
- `/api/admin/service-cancel`: 관리자 강제 취소/환불 API (NicePay error-safe)
- `/api/admin/service-confirm-payment`: 무통장 입금 확인 API (PENDING→PAID + request→open, v3.9.2)
- `/api/admin/service-payouts/mark-paid`: 서비스 정산 완료 처리 API (`service_bookings.payout_status='paid'` + audit log)
- `/api/admin/service-bookings`: RLS 우회용 맞춤 의뢰 조회 서버 API (v3.9.3, 최신 `host_applications` 계좌정보 조립 포함)
- `/api/admin/service-requests`: 관리자 맞춤 의뢰 수정 API (`pending_payment/open` 상태만 수정 허용 + audit log)
- `/api/admin/sidebar-counts`: RLS 우회용 사이드바 배지 카운트 서버 API (v3.9.3, 승인/예약/서비스 무통장/CS 미답변 + 현재 로그인 관리자 `admin_alert` unread count 포함). `pendingBookingIds`는 서버가 내려주고, `Master Ledger` badge의 로컬 열람 상태(`viewed_booking_ids`)는 클라이언트 공용 helper에서 stale id를 정리한 뒤 계산한다.
- 관리자 대시보드의 핵심/레거시 승인 경로(`APPROVALS`, `APPS`, `EXPS`)는 모두 `useAdminApprovalsData()`를 사용하고, `useAdminData()`는 더 이상 실제 렌더 경로에서 사용하지 않는다.
- `/api/services/payment/mark-bank`: 무통장 선택 시 payment_method='bank' 저장 (v3.9.2, 이미 bank면 idempotent success / 다른 결제수단이 지정된 PENDING 예약이면 409)
- `utils/paypal/server.ts`: PayPal 고객 결제 1단계 공통 서버 유틸 (access token / order create / order get / order capture). 기존 NicePay 결제 경로와 분리 유지
- `/api/payment/paypal/create-order`: 체험 예약 PayPal 주문 생성 API (예약 소유권/상태/금액 검증 후 PayPal order 발급)
- `/api/payment/paypal/capture-order`: 체험 예약 PayPal 승인 확정 API (PayPal order 검증 + capture + 기존 NicePay와 동일한 예약 확정/정산 데이터 반영)
- `app/experiences/[id]/payment/page.tsx`: PayPal 고객 결제 3단계 UI 연결. 기존 카드/무통장 CTA는 유지하고, `PayPal` 선택 시에만 별도 SDK 버튼/서버 create-order/capture 경로를 사용한다.
- `utils/paypal/server.ts`: PayPal capture refund 유틸 포함. 체험 예약 취소/환불 시 `payment_method='paypal'`인 예약만 PayPal refund endpoint를 사용하고, 기존 NicePay 취소 흐름은 유지한다.

원칙:
- Admin page는 비대화하지 않고, 로직은 `hooks/`로 분리한다.
- 복잡 Join은 Raw fetch + JS 조립(Manual Join)을 기본으로 한다.
- service_bookings와 bookings는 완전히 별도 데이터 소스 — 훅/컴포넌트를 분리 유지한다.
- 수수료율(%) Admin UI 어디에도 노출 금지 — 금액(amount)만 표시한다.
- Billing/Sales 탭의 체험 정산은 자동 지급이 아니라 `운영자 수동 송금 → 정산 완료 클릭` 흐름을 기준으로 한다. 누적 정산 가능액이 `₩100,000` 이상일 때만 `정산 가능`, 미만 금액은 누적 보류한다.
- PayPal 고객 결제는 기존 NicePay 경로를 교체하지 않고 단계적으로 추가한다. 1단계는 환경변수(`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`)와 공통 서버 유틸만 추가하며, 실제 체험/서비스 결제 route 및 UI 연결은 후속 단계에서 진행한다.
- PayPal 체험 결제 2단계는 `/api/payment/paypal/create-order`, `/api/payment/paypal/capture-order` 서버 route만 추가하고, 기존 NicePay UI/콜백/취소 환불 경로는 건드리지 않는다. `capture-order`는 `payment_method='paypal'`, `tid=<captureId>`와 기존 예약 확정 정산 필드를 저장한다.
- PayPal 체험 결제 3단계는 `app/experiences/[id]/payment/page.tsx`에만 `PayPal` 결제수단과 SDK 버튼을 연결한다. 기존 카드/NicePay 버튼과 무통장 입금 CTA는 유지하고, PayPal은 별도 버튼에서만 `/api/payment/paypal/create-order`와 `/api/payment/paypal/capture-order`를 사용한다. 공개 client id는 `NEXT_PUBLIC_PAYPAL_CLIENT_ID`만 사용한다.
- PayPal 체험 결제 4단계는 `/api/payment/cancel`, `/api/admin/bookings/force-cancel`에서 `payment_method='paypal'`인 예약만 PayPal capture refund를 호출한다. 기존 NicePay 카드/무통장 취소 흐름은 유지한다.
- 체험 NicePay 카드결제는 `/api/payment/nicepay-callback`에서 브라우저 성공 payload를 신뢰하지 않고, PortOne REST API 재조회(`imp_uid`)로 `status=paid`, `merchant_uid=bookings.order_id`, `amount=bookings.amount`를 모두 확인한 뒤에만 `bookings.status='PAID'`, `payment_method='card'`로 확정한다. 기존 좌석 재검증, 정산 스냅샷 저장, 호스트/관리자 알림 의미는 유지한다.
- `/api/payment/card-ready`는 체험 카드결제 검증 준비 상태를 반환한다. `NEXT_PUBLIC_PORTONE_IMP_CODE`, `PORTONE_API_KEY`, `PORTONE_API_SECRET`가 모두 있어야 `ready=true`이며, 체험 결제 페이지는 readiness가 false일 때 카드 결제를 비활성화하고 무통장/PayPal만 허용한다.
- PayPal 서비스 결제 1단계는 `/api/services/payment/paypal/create-order`, `/api/services/payment/paypal/capture-order` 서버 route만 추가하고, 기존 서비스 NicePay UI/무통장/취소 환불 경로는 건드리지 않는다. `capture-order`는 `service_bookings.status='PAID'`, `payment_method='paypal'`, `tid=<captureId>`를 저장하고 `service_requests.status='open'`으로 전환한다.
- PayPal 서비스 결제 2단계는 `app/services/[requestId]/payment/page.tsx`에만 `PayPal` 결제수단과 SDK 버튼을 연결한다. 기존 서비스 NicePay 카드 CTA와 무통장 입금 CTA는 유지하고, PayPal은 기존 pending `service_bookings`를 재사용해 `/api/services/payment/paypal/create-order`와 `/api/services/payment/paypal/capture-order`를 별도 버튼에서만 사용한다.
- PayPal 서비스 결제 3단계는 `/api/services/cancel`, `/api/admin/service-cancel`에서 `payment_method='paypal'`인 서비스 예약만 PayPal capture refund endpoint를 호출한다. 기존 NicePay 카드 취소/무통장 취소 의미는 유지하고, `PAID + open` 상태의 서비스 고객 취소는 관리자 강제취소와 같은 error-safe 기준으로 PG 환불 성공 시에만 DB 상태를 `cancelled`로 바꾼다.
- 서비스 NicePay 카드결제는 `/api/services/payment/nicepay-callback`에서 브라우저 성공 payload를 신뢰하지 않고, PortOne REST API 재조회(`imp_uid`)로 `status=paid`, `merchant_uid=service_bookings.order_id`, `amount=service_bookings.amount`를 모두 확인한 뒤에만 `service_bookings.status='PAID'`, `payment_method='card'`, `service_requests.status='open'`으로 확정한다.
- 서비스 결제 페이지는 pending `service_bookings.payment_method`를 함께 읽는다. 이미 `payment_method='bank'`로 표시된 `PENDING` 예약은 UI에서 무통장으로 고정되고, `/api/services/payment/nicepay-callback` 및 `/api/services/payment/paypal/capture-order`도 같은 예약에 대한 카드/PayPal 확정을 거부한다.
- 서비스 결제 완료 후 호스트 모집 알림(`service_request_new`)은 카드/NicePay, PayPal, 무통장 입금 확인 모두 같은 helper로 대상을 고른다. 기준은 `host_applications.status='approved'` + `service_requests.city`가 있을 때 해당 도시의 활성 체험(`experiences.is_active=true`, `experiences.city ilike %city%`)을 가진 호스트만 대상으로 하며, 고객 본인은 제외한다.
- `/api/services/payment/card-ready`는 서비스 카드결제 검증 준비 상태를 반환한다. `NEXT_PUBLIC_PORTONE_IMP_CODE`, `PORTONE_API_KEY`, `PORTONE_API_SECRET`가 모두 있어야 `ready=true`이며, 서비스 결제 페이지는 readiness가 false일 때 카드 결제를 비활성화하고 무통장/PayPal만 허용한다.
- Data Analytics `Business & Guest`는 `useAdminData`의 최근 20건 예약 캐시를 재사용하지 않고 `/api/admin/analytics-summary`를 단일 집계 source로 사용한다. 현재 플랫폼 전체화 범위는 상단 비즈니스 KPI(GMV/순수익/AOV/결제건수), 반복 결제 고객 비율, 결제 고객 인구통계이며, `Host Ecosystem`, `Review Management`, `Audit Logs`, `Top 체험`, `검색 트렌드`는 기존 구조를 유지한다.
- Data Analytics의 `Review Quality`, `운영 감사 로그`는 이제 브라우저 직접 select 대신 각각 `/api/admin/reviews`, `/api/admin/audit-logs`를 초기 읽기 source로 사용한다. 현재 실시간성은 감사 로그 INSERT 구독만 클라이언트에 남겨둔다.
- Data Analytics에서 `취소율`, `체험 검색 인기 트렌드`, `Top 체험`은 여전히 체험 예약/체험 검색 기준이다. 플랫폼 전체 KPI와 체험 전용 섹션이 섞여 있으므로 카드/섹션 문구로 기준을 명시한다.
- Data Analytics `고객 검색 수요 분석`은 `/api/admin/analytics-search-intent`를 전용 source로 사용한다. 현재 범위는 `검색량 TOP`, `급상승`, `공급 부족`과 `동일 세션 안에서 다음 검색 전까지 발생한 click/payment_init`를 연결한 참고용 `검색→클릭`, `검색→결제 시작` 전환, 그리고 `유입 source별 대표 검색 수요/공급 부족 신호`까지 포함한다. 전환율과 source별 검색 수요는 정확한 예약 귀속이 아니라 세션 기준 참고 지표이므로 화면에 `동일 세션 기준 참고용`, `source + 세션 기준 참고용`으로 표시한다.
- `analytics-search-intent`, `analytics-customer-composition`는 source tracking 마이그레이션(`search_logs.session_id`, `analytics_events.utm_* / referrer_host / landing_path`)이 아직 적용되지 않은 환경에서도 기존 검색량/고객 구성 지표를 500 없이 유지해야 한다. 새 컬럼이 없으면 전환/source 분석만 `collecting/unavailable`로 내려간다.
- Data Analytics `고객 구성 분석`은 `/api/admin/analytics-customer-composition`을 전용 source로 사용한다. 현재 범위는 결제 고객 기준 `국적`, `언어권`, `신규/반복`, `체험/서비스 선호`와, `analytics_events`에 추적 데이터가 남아 있는 고객 기준 `유입 source`, `source별 가입→결제 전환`, `결제액`, `반복 고객 비율`, `주요 고객 국적·언어` 참고용 집계까지 포함한다. source 데이터가 부족하거나 집계를 불러오지 못하면 `collecting/unavailable` 상태로만 표시하고 다른 고객 구성 지표는 그대로 유지한다.
- 고객 유입 source 분석을 위해 `search_logs`, `analytics_events`에는 `session_id`, `referrer`, `referrer_host`, `utm_source`, `utm_medium`, `utm_campaign`, `landing_path`를 수집한다. 현재는 검색/체험 상세/결제 시작 이벤트만 이 메타데이터를 기록하며, 실제 source 분석 지표는 데이터가 충분히 쌓인 뒤 별도 단계에서 노출한다.
- Data Analytics `Host Ecosystem`는 `/api/admin/analytics-host-summary`를 전용 source로 사용한다. 새 API 실패 시에만 기존 로컬 계산 fallback을 유지한다.

---

## 3. 데이터/보안 기준

### 3.1 핵심 테이블 (요약)
| 분류 | 테이블 | 비고 |
| :--- | :--- | :--- |
| 사용자/권한 | `users`, `profiles`, `admin_whitelist` | 권한 판정은 `users.role`, 프로필 표시는 `profiles`, 관리자 예외는 whitelist |
| 상품/예약/결제 | `experiences`, `bookings` | 예약 상태는 서버 검증 기준 |
| 소통/리뷰 | `inquiries`, `inquiry_messages`, `reviews` | 채팅/리뷰 연동 |
| 운영 | `admin_tasks`, `admin_task_comments`, `audit_logs` | 협업/로그 |
| 커뮤니티 | `community_posts`, `community_comments`, `community_likes` | RLS: SELECT USING(true), INSERT/UPDATE/DELETE는 auth 필수 |

### 3.2 권한 원칙
- 기본: 인증 사용자 + 본인 데이터 범위
- 관리자: `users.role='admin'` 또는 `admin_whitelist` 매칭
- 민감 API는 반드시 서버에서 권한 확인 후 처리
- **[팀 알림 아키텍처 결정]** `/api/admin/notify-team`의 수신자 수집은 `admin_whitelist` 단일 소스만 사용한다. `users.role='admin'`을 병행 소스로 쓰면 whitelist에서 삭제된 관리자에게 계속 발송되는 버그 발생. 팀원 추가/제거는 반드시 `admin_whitelist` 테이블만 통해 관리한다.
- **[권한 Source 결정]** 관리자 권한 판정 source는 `users.role + admin_whitelist`다. `profiles`는 표시/프로필 데이터용이며, `profiles.role`을 권한 판정에 사용하지 않는다.
- **[관리자 알림센터 결정]** 운영 알림센터는 신규 테이블을 만들지 않고 기존 `notifications`를 재사용한다. 관리자 전용 누적 알림은 `type='admin_alert'`로 저장하고, Admin Dashboard `ALERTS` 탭에서 소비한다.
- **[알림 API 보안 결정]** `/api/notifications/email`의 단일 수신자 경로는 범용 발송 API로 사용하지 않는다. self 알림이나 서버 검증 가능한 소유권 컨텍스트(`review_reply`, `cancellation_approved` 등)만 허용하고, 그 외는 각 도메인 서버 라우트에서 직접 발송한다.

### 3.3 결제/정합성 원칙
- 결제 확정/취소는 서버 검증 경로를 단일 소스로 유지
- PG 응답 성공 확인 후 DB 상태 변경
- 클라이언트 직접 결제 상태 변경 금지
- **[이메일 결합도 무관찰 원칙]** 결제 콜백(`route.ts`) 라우트 내부에서는 절대 `nodemailer`나 서버 사이드 UI 렌더링(`@react-email`)을 돌리지 않는다. 결제가 확정되면 무조건 `200 OK`를 내어주고, 이메일은 비동기 Fetch(`api/notifications/send-email`)로 백그라운드로 넘긴다.
- **[체험 예약 금액 의미 원칙]** `bookings.amount`는 게스트 실결제액, `bookings.total_price`/`total_experience_price`는 투어 금액(호스트 기준 원가), `host_payout_amount`는 투어 금액의 80%, `platform_revenue`는 `amount - host_payout_amount`를 기준으로 유지한다. 취소 정산도 이 의미 체계를 깨지 않는다.

### 3.4 프로필 동기화 원칙 (v3.21.0+)
- `auth.users`에 레코드가 생성되는 즉시 `profiles` 테이블에 1:1로 레코드가 보장되어야 한다.
- 클라이언트 혹은 애플리케이션 레벨의 수동 Upsert(`syncProfile.ts`) 로직은 절대 사용하지 않는다. (FK Constraint Violation 방지)
- 동기화는 100% DB 레벨의 Postgres Trigger (`on_auth_user_created`)가 담당한다.

---

## 4. 현재 상태 요약

- 결제/보안: NicePay 서명 검증, 결제 확정/취소 API 권한 검증 반영
- 데이터 무결성: 클라이언트 직접 DB 쓰기 제거, 서버 중심 예약/정산 흐름 통합, Postgres Trigger 프로필 100% 일치 동기화.
- 메시징/문의 API 원칙: 신규 문의방 생성과 첫 메시지 생성은 `/api/inquiries/thread`, 기존 문의방 답장 전송은 `/api/inquiries/message` 서버 API를 기준으로 유지한다. 체험 일반 문의, 관리자 1:1 문의, 관리자 CS 선개시, 서비스 매칭 채팅방 열기/첫 메시지/후속 답장은 이 경로들을 재사용한다. 서비스 매칭 채팅은 `docs/migrations/v3_37_35_service_request_inquiry_key.sql` 적용 후 `inquiries.service_request_id` 기준으로 request 단위 분리를 활성화한다.
- 메시징 읽음 처리(`is_read`, `read_at`)는 `/api/inquiries/read` 서버 API를 단일 source로 유지한다. 클라이언트 훅(`useChat`)은 unread UI를 낙관적으로 갱신할 수 있지만, 실제 `inquiry_messages` 읽음 업데이트는 브라우저 direct write를 하지 않는다.
- Admin 맞춤 의뢰 관리 통합(v3.9.0): `service_bookings` 테이블 결제 흐름을 Admin이 통제할 수 있도록 별도 탭 `SERVICE_REQUESTS`를 신설하고, `useServiceAdminData.ts` 독립 훅·`ServiceAdminTab.tsx` 3-서브탭 컴포넌트·`/api/admin/service-cancel` 강제 취소 API를 추가. NicePay cancel 실패 시 DB 상태 미변경(에러 안전) 보장. `SalesTab` KPI에 service_bookings GMV/정산액 합산(수수료율 % 미노출). 관리자 탭 데이터는 공통 eager load 대신 탭별 전용 훅/API를 기준으로 유지한다.
- `Billing & Revenue` 탭은 `/api/admin/sales-summary`를 전용 source로 사용하므로, `page.tsx`에서 공통 로딩 게이트 밖에서 직접 렌더링한다.
- `Master Ledger` 탭은 `/api/admin/master-ledger`를 전용 source로 사용하므로, `page.tsx`에서 공통 로딩 게이트 밖에서 직접 렌더링한다. `MasterLedgerTab`은 자체 realtime 구독(`bookings INSERT/UPDATE`, `service_bookings INSERT/UPDATE`)으로 최신성을 유지한다.
- `Data Analytics` 탭은 `/api/admin/analytics-summary`, `/api/admin/analytics-host-summary`, `/api/admin/reviews`, `/api/admin/audit-logs`를 전용 source로 사용하므로, `page.tsx`에서 공통 로딩 게이트 밖에서 직접 렌더링한다. `AnalyticsTab`의 shared props는 마지막 fallback 안전망으로만 유지한다.
- `User Management` 탭은 `/api/admin/users-summary`와 presence 구독을 쓰는 `useAdminUsersData.ts` 경량 훅으로 `page.tsx`에서 직접 렌더링한다.
- `Approvals` 및 레거시 `APPS`/`EXPS` 경로는 `/api/admin/host-applications` 요약 API + `experiences` 클라이언트 조회를 쓰는 `useAdminApprovalsData.ts` 경량 훅으로 `page.tsx`에서 직접 렌더링한다.
- `TEAM` 탭은 아직 목록/실시간 읽기는 client Supabase를 유지하지만, `TeamTab`, `GlobalTeamChat`, `MiniChatBar`의 `admin_tasks / admin_task_comments / admin_whitelist` 쓰기(create/update/delete/reaction)는 전용 `/api/admin/team/*` 경로로만 처리한다.
- `TEAM` 탭 진입 시 `last_viewed_team`을 현재 시각으로 갱신하고 `team-viewed` 이벤트를 발생시켜, 사이드바 `Team Workspace` 배지가 같은 탭 세션에서도 즉시 0으로 돌아가게 유지한다.
- 맞춤 의뢰 결제 무통장 입금 추가(v3.9.1): `/services/[requestId]/payment`에 결제 수단 선택 UI(카드 결제 / 무통장 입금)를 추가. 무통장 선택 시 IMP 호출 없이 계좌번호 안내 후 `/payment/complete?method=bank`로 직접 이동. 계좌 정보는 `NEXT_PUBLIC_BANK_ACCOUNT`/`NEXT_PUBLIC_BANK_NAME` 환경변수로 관리.
- 맞춤 의뢰 무통장 백엔드 연동(v3.9.2): 무통장 선택 시 `/api/services/payment/mark-bank` 호출로 `service_bookings.payment_method='bank'` 저장(service_role 전용 쓰기 → 서버 API 경유). Admin `ServiceAdminTab`에 "결제수단" 컬럼(🏛️ 무통장/💳 카드) 및 PENDING+무통장 행에 "💰 입금 확인" 버튼 추가 → `/api/admin/service-confirm-payment` 호출 → PENDING→PAID, pending_payment→open + 호스트 알림 + 감사 로그.
- 어드민 대시보드 권한 및 무통장 버그 수정(v3.9.3): `service_bookings` 영역의 RLS 권한 누락으로 인한 관리자 데이터 블락/사이드바 카운트 증발 현상을 우회하기 위해 `createAdminClient`를 쓰는 전용 백엔드 API 신설 (`/api/admin/service-bookings`, `/api/admin/sidebar-counts`). 또한, 일반 `bookings` 테이블에 `payment_method` 컬럼을 신규 추가하고 `create_booking_atomic` 함수에서 이를 저장하도록 수정.

비고: 상세 변경 로그(파일 단위 픽셀 조정, 과거 패치 서술)는 `docs/CHANGELOG.md` 또는 커밋 이력에서 확인한다.

---

## 5. 필수 개발 규칙

### 5.1 DO
1. Supabase 단건 조회는 기본적으로 `.maybeSingle()`을 우선 사용한다.
2. Admin 복잡 Join은 Raw fetch + JS 조립(Manual Join) 패턴으로 처리한다.
3. Realtime 구독은 `useEffect` cleanup에서 채널/리스너를 반드시 해제한다.
4. SSR/CSR 불일치가 생길 수 있는 `window`, `localStorage`, `Date` 접근은 `useEffect` 또는 client guard로 분리한다.
5. 실패 처리 시 로그만 남기지 말고 사용자 피드백(Toast)을 제공한다.
6. 수정 전 연관 컴포넌트/훅/API 흐름을 교차 검증하고, 핀셋 수정(최소 변경)을 우선한다.
7. **[SSR Join 분리 원칙]** `page.tsx` 서버 컴포넌트에서 여러 테이블을 join하는 단일 Supabase 쿼리는 쓰지 않는다. join 에러 시 `data=null`이 되어 `notFound()`가 호출되는 문제가 있음. 대신 ① 핵심 테이블 단독 조회 → ② 보조 테이블 별도 조회 패턴으로 분리한다.
8. **[메시징 서버 단일 API 원칙]** 신규 문의방 생성/첫 메시지는 `/api/inquiries/thread`, 기존 문의방 답장은 `/api/inquiries/message`를 단일 소스로 사용한다. 클라이언트에서 `inquiries`, `inquiry_messages`, `notifications`를 직접 분산 insert/update하지 않는다.
9. **[서비스 매칭 채팅 식별 원칙]** 서비스 매칭 채팅은 guest-host 조합만으로 기존 스레드를 재사용하지 않는다. `service_request_id` 컬럼이 있는 환경에서는 `(user_id, host_id, service_request_id)` 기준으로 스레드를 찾고, 마이그레이션 전 환경에서만 레거시 fallback을 허용한다.

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

### 6.3 z-index 기준
- `z-[9999]`: 최상위 전역 모달/토스트
- `z-[200]`: 일반 모달
- `z-[150]`: 상세/갤러리 오버레이
- `z-[105]`: 예약 플로팅/모바일 상위 고정 요소
- `z-[100]`: BottomTabNavigation 기준 레이어
- `z-[80]`: Admin Sidebar

---

## 7. 백로그

- 지도 기반 검색 (국내/해외 지도 분기)
- 메시징 기능 확장 (미디어, 읽음 상태 등)
- Admin 권한 세분화(RBAC)
- 정산/운영 자동화 강화

---

## 8. 문서 운영 규칙

- 이 문서는 "현재 유효한 구현 기준"만 유지한다. 과거 완료 작업·이력 서술은 작성하지 않는다.
- 중복/과장/과거 상세 로그는 누적하지 않는다.
- **[영구 규칙 1]** gemini.md는 DB 스키마 변경·신규 API 추가·아키텍처 결정 등 **핵심 시스템 골격 변경** 시에만 업데이트한다. UI 픽셀 조정·스타일 수정·컴포넌트 리파인은 gemini.md 업데이트 대상이 아니다.
- **[영구 규칙 2]** 과거 완료된 버그 수정·UI/UX 조정·패치 내역은 반드시 `docs/CHANGELOG.md`에만 기록한다. gemini.md에 과거형(~수정, ~추가, ~변경) 서술을 쌓지 않는다.
- 대규모 변경 시 이 문서에는 결정사항만 요약하고, 상세 이력은 `docs/CHANGELOG.md` 또는 커밋에 남긴다.
- 모바일 전용 경로(`'/host/menu'` 등)는 데스크탑 전환/네비게이션의 기본 목적지로 사용하지 않는다.
- 폰트 검증은 개발 캐시(`.next/dev`) 단독 결과를 기준으로 판단하지 않고, `.next` 정리 후 `webpack build` 산출물로 최종 확인한다.

---

## 9. 현재 연결 점검 메모

- 호스트 지원서의 `email`은 `host_applications.email` 전용 필드다. 관리자 검토용으로는 보이지만, 실제 로그인 계정 이메일(`auth`/`profiles.email`)과 동기화되지 않는다.
- 호스트 지원서 언어는 `host_applications.language_levels`(JSON) + `languages`(문자열 배열) 이중 구조로 저장한다. 관리자 상세에서는 `언어 + Lv.n`으로 보여주고, 리스트 요약은 `languages` 기준으로 표시한다.
- `/host/register`는 여전히 단계형 UI와 스토리지 업로드를 클라이언트에서 유지하지만, 최종 저장(`host_applications` insert/update + 빈 `profiles` 필드 seed + admin alert 조건 처리)은 `POST /api/host/register/submit` 서버 route가 맡는다.
- 기존 `POST /api/host/register/admin-alert`는 현재 제품 경로에서는 더 이상 호출하지 않으며, stale client 호환을 위한 compatibility endpoint로만 유지한다.
- 호스트 대시보드 `Earnings` 탭은 게스트 실결제액(`bookings.amount`)이나 플랫폼 수수료를 노출하지 않고, `host_payout_amount` 우선 fallback 기준의 호스트 정산 예정 금액만 표시한다.
- 호스트 대시보드 `ProfileEditor` 저장은 `POST /api/host/profile` 서버 route가 맡는다. 이 route는 공개 프로필 필드(`full_name`, `job`, `dream_destination`, `favorite_song`, `languages`, `avatar_url`)와 latest `host_applications.self_intro`만 갱신하며, 정산/국적/지원서 private 필드는 계속 읽기 전용으로 유지한다.
- 호스트 대시보드 리뷰 탭 쓰기는 `POST /api/host/guest-reviews`, `POST /api/host/reviews/reply` 서버 route가 맡는다. 게스트 후기 생성은 `booking -> experiences.host_id` 소유권과 중복 여부를, 후기 답글 저장은 `review -> experiences.host_id` 소유권을 서버에서 검증한 뒤 반영한다.
- `useChat`의 문의 읽음 처리도 `POST /api/inquiries/read` 서버 route가 맡는다. 이 route는 문의 참여자(게스트/호스트) 또는 관리자만 접근할 수 있고, 상대방이 보낸 `read_at IS NULL` 메시지만 `is_read=true`, `read_at=now()`로 갱신한다.
- 호스트 지원서의 `language_cert`는 입력/저장을 유지하며, 관리자 상세에서만 텍스트로 노출한다.
- 호스트 지원서 상태의 `idCardType`은 로컬 상태만 존재하고, 렌더/저장/조회 경로가 없다.
- 체험 등록의 `spots`는 생성 시 저장되지만 현재 런타임 읽기 경로가 없다.
- 체험 언어는 `experiences.language_levels`(JSON) + `languages`(문자열 배열) 이중 구조로 저장한다. 공개 상세는 기존 Lightbulb 언어 안내 위치에서 `한국어 Lv.5 · 영어 Lv.4` 형식의 한 줄 요약을 우선 노출한다.
- 체험의 `exclusions`는 생성/수정 화면 모두에서 직접 입력 가능하며, 상세 화면에서는 `포함 사항 / 불포함 사항 / 준비물`을 분리 노출한다.
- 체험의 `is_private_enabled` / `private_price`는 생성뿐 아니라 호스트 대시보드의 체험 수정 화면에서도 실제 편집/저장 가능해야 한다.
- 체험 상세 UI는 `rules.preparation_level`을 더 이상 표기하지 않고, `활동 강도`는 `rules.activity_level`만 노출한다.

---

## 10. 서비스 매칭 시스템 (역경매, v3.3.0)

### 10.1 개요

고객이 맞춤 동행/통역 서비스를 의뢰하면 해당 지역 호스트들이 지원하고, 고객이 선택 후 결제하는 **역경매 매칭 플로우**. 기존 `experiences` / `bookings` 테이블/로직과 **완전 독립**.

**가격 구조 (수수료율 절대 노출 금지):**
- 고객 결제: ₩35,000/hr × duration_hours (최소 4시간)
- 호스트 수익: ₩20,000/hr × duration_hours
- 플랫폼 마진: ₩15,000/hr (비공개)

### 10.2 DB 테이블 (Supabase)

| 테이블 | 용도 |
|--------|------|
| `service_requests` | 고객 의뢰. `total_customer_price`, `total_host_payout`은 GENERATED ALWAYS 컬럼 |
| `service_applications` | 호스트 지원. UNIQUE(request_id, host_id) |
| `service_bookings` | 결제/정산. `SVC-` 접두사 주문번호. service_role 전용 쓰기 |

**마이그레이션 파일:** `supabase_service_matching_migration.sql` (초기), `supabase_service_matching_v2_escrow_migration.sql` (v2 에스크로), `docs/migrations/v3_37_35_service_request_inquiry_key.sql` (서비스 매칭 채팅 request 키)

**상태 플로우 (v2 에스크로):**
```
service_requests: pending_payment → (결제) → open → (호스트 선택) → matched → completed
                  pending_payment → cancelled (결제 포기)
                  open → cancelled (결제 후 호스트 미선택 상태에서 취소 + PG 환불)
                  matched → cancelled (관리자 검토)
service_bookings: PENDING → (결제) → PAID → cancelled / cancellation_requested
```

### 10.3 라우팅

**고객:**
- `/services/request` — 의뢰 작성 폼 (₩35,000/hr 고정 표시)
- `/services/my` — 내 의뢰 목록
- `/services/[requestId]` — 의뢰 상세 (지원자 선택 포함)
- `/services/[requestId]/payment` — NicePay 결제 (기존 결제 callback과 완전 분리)
- `/services/[requestId]/payment/complete` — 결제 완료

**호스트:**
- `/services` — 잡보드 (열린 의뢰 목록)
- `/services/[requestId]/apply` — 지원 폼 (₩20,000/hr 예상 수입 표시, 비율 미노출)
- 호스트 대시보드 `?tab=service-jobs` — ServiceJobsTab (열린 의뢰 / 내 지원 / 진행중)

### 10.4 API 라우트

| 엔드포인트 | 용도 |
|------------|------|
| `POST /api/services/requests` | 의뢰 생성(pending_payment) + 에스크로 예약 사전 생성(PENDING, host_id=null) |
| `GET /api/services/requests?mode=board\|my` | 의뢰 목록 조회 (board: open만) |
| `POST /api/services/applications` | 호스트 지원 (중복/재지원 처리) |
| `POST /api/services/select-host` | 고객의 호스트 선택 → matched + 기존 예약에 host_id/application_id 채워넣기 |
| `POST /api/services/payment/nicepay-callback` | 결제 확정 → request.status: open 전환 + 호스트 전체 알림 |
| `POST /api/services/cancel` | PENDING: DB 취소 / open+PAID: PG 환불 성공 시에만 취소 확정 / matched: 관리자 검토 |

### 10.5 타입 & 상수

- `app/types/service.ts` — ServiceRequest, ServiceApplication, ServiceBooking 등
- `app/constants/serviceStatus.ts` — 상태 유틸 함수 (`isOpenServiceRequest`, `getServiceRequestStatusLabel` 등)
- `app/utils/notification.ts` — NotificationType에 `service_request_new`, `service_application_new`, `service_host_selected`, `service_host_rejected`, `service_payment_confirmed`, `service_cancelled` 추가

### 10.6 네비게이션 연동

- **홈 서비스 탭:** `LOCALLY_SERVICES` 5번째 항목(id=5) → 클릭 시 `/services/intro` 라우팅
- **호스트 대시보드:** `service-jobs` 탭 추가 (Briefcase 아이콘) → ServiceJobsTab 렌더
- **MobileHostMenu:** "서비스 매칭" 메뉴 항목 추가 → `/host/dashboard?tab=service-jobs`
- **BottomTabNavigation:** `isHostNavPath`에 `/services` 경로 추가 (호스트 잡보드 탐색 시 탭바 유지)

### 10.7 주요 제약사항

- 수수료 비율(₩15,000/hr) 어디에도 노출 금지 — Generated 컬럼 기반으로 UI에서 계산 불필요
- 기존 `/api/payment/nicepay-callback` 수정 금지 — 서비스 결제는 `/api/services/payment/nicepay-callback` 전용
- 기존 `experiences` / `bookings` 테이블/API 변경 금지
- 주문번호 `SVC-` 접두사: 기존 예약과 충돌 방지 + callback 라우팅 가드

---

## 11. 에스크로 선결제 시스템 (v3.8.0+)

### 11.1 배경 — 노쇼 문제 해결

**v2 에스크로 플로우:** 의뢰 등록 → **즉시 결제(에스크로)** → open 공개 → 호스트 지원 → 선택 → 확정
- 고객 결제 완료 후 잡보드 공개 → 호스트 선택 → 이미 결제된 금액으로 바로 확정

### 11.2 DB 변경사항 (v3.8.0)

- **`service_requests.status`:** `pending_payment` 상태 추가 (결제 전 잡보드 미노출)
- **`service_bookings.host_id`:** NOT NULL → nullable (에스크로 단계에서 호스트 미정)
- **`service_bookings.application_id`:** NOT NULL → nullable (호스트 선택 후 채워짐)
- **마이그레이션:** `supabase_service_matching_v2_escrow_migration.sql` 실행 필요

### 11.3 결제 플로우

**카드 결제:**
```
1. 고객: /services/request → 폼 작성
2. POST /api/services/requests
   → service_requests INSERT (status=pending_payment)
   → service_bookings INSERT (status=PENDING, host_id=null, application_id=null)
   → 반환: { requestId, orderId, amount }
3. 프론트: /services/${requestId}/payment 리다이렉트
4. 결제 페이지: DB에서 PENDING 예약 조회 (request_id + customer_id)
5. [카드] IMP.request_pay() → NicePay 결제
6. POST /api/services/payment/nicepay-callback
   → service_bookings.status = PAID
   → service_requests.status = open
   → 승인 호스트 전체 알림 발송
7. 잡보드(/services): open 의뢰만 표시
8. 호스트: 지원서 제출 → 고객이 선택
9. POST /api/services/select-host
   → service_requests.status = matched
   → service_bookings.host_id, application_id 채워넣기
10. 매칭 확정 — 별도 결제 불필요
```

**무통장 입금 (v3.9.2 완성):**
```
1~4. 동일
5. [무통장] POST /api/services/payment/mark-bank
   → service_bookings.payment_method = 'bank' (service_role 경유)
6. /payment/complete?orderId=...&method=bank 리다이렉트
   → "입금 대기 중" UI + 계좌번호 재표시
   → service_bookings: PENDING 유지 / service_requests: pending_payment 유지
7. Admin: ServiceAdminTab → "💰 입금 확인" 버튼
   → POST /api/admin/service-confirm-payment
   → service_bookings: PENDING → PAID
   → service_requests: pending_payment → open (잡보드 공개)
   → 호스트 전체 알림 + 고객 알림 + 감사 로그
```

**PayPal 결제 (v3.38.48 추가):**
```
1~4. 동일
5. [PayPal] POST /api/services/payment/paypal/create-order
   → service_bookings PENDING 예약 소유권/상태/금액 검증
   → PayPal order 생성 (order_id/custom_id 사용)
6. 고객 PayPal 승인
7. POST /api/services/payment/paypal/capture-order
   → PayPal order/custom_id/금액 재검증 + capture
   → service_bookings: PENDING → PAID, payment_method='paypal', tid=<captureId>
   → service_requests: pending_payment → open
   → 승인 호스트 전체 알림 + 고객 알림 + 관리자 알림
```

**결제 수단 환경 변수:**
- `NEXT_PUBLIC_BANK_ACCOUNT`: 무통장 입금 계좌번호
- `NEXT_PUBLIC_BANK_NAME`: 은행명 (기본: 카카오뱅크)

### 11.4 취소/환불 로직

| 예약 상태 | 의뢰 상태 | 처리 방식 |
|-----------|-----------|-----------|
| PENDING | pending_payment | DB 취소만 (PG 미결제) |
| PAID | open | NicePay PG 전액 환불 + DB 취소 |
| PAID | matched / confirmed | cancellation_requested (관리자 검토) |

### 11.5 주의사항

- `isPendingPaymentServiceRequest` 유틸 사용 — raw 문자열 비교 금지
- 잡보드 GET API: `status='open'` 필터 고정 — `pending_payment` 절대 노출 금지
- 체험 카드결제는 `signData`/`ediDate`를 신뢰하지 않는다. 브라우저는 `imp_uid`, `merchant_uid`, `orderId`만 보내고 `/api/payment/nicepay-callback`이 PortOne REST API 재조회로 실제 결제를 검증한 뒤에만 예약을 확정한다.
- 체험 카드결제 준비 상태는 `/api/payment/card-ready`가 단일 source다. readiness가 false인 환경에서는 카드 버튼을 비활성화하고 무통장/PayPal만 허용한다.

### 11.6 Site URL / SEO 기준

- 사이트 절대 URL은 `NEXT_PUBLIC_SITE_URL`가 단일 source다.
- 메타데이터(`metadataBase`, canonical, `alternates.languages`, OG URL), `robots`, `sitemap`, 이메일 기본 링크는 모두 `app/utils/siteUrl.ts` helper를 통해 생성한다.
- `locally.vercel.app`, `locally-web.vercel.app`, `www.locally-travel.com` 같은 배포 도메인을 개별 파일에 하드코딩하지 않는다.
- staging/transition 기간에는 `NEXT_PUBLIC_SITE_URL`만 현재 배포 도메인으로 유지하고, 최종 도메인 전환 시에는 env만 교체한다.
- `/about`, `/search`, `/become-a-host`, `/help`, `/site-map`, `company/*`, `/services/intro` 같은 공개 랜딩/정보 페이지는 route-level metadata를 직접 가진다. 반대로 로그인 리다이렉트가 있는 `/services` 잡보드류는 공개 SEO 보강 대상이 아니라 private `noindex` 정리 대상으로 본다.
- private 페이지(`app/login`, `app/account`, `app/guest/*`, `app/host/*`, `app/admin/*`, `app/notifications`, `app/services`, `app/services/my`)는 `app/utils/seo.ts`의 `PRIVATE_NOINDEX_METADATA`를 단일 source로 사용해 `robots: noindex, nofollow`를 강제한다.
- `/community`처럼 필터 query를 쓰는 공개 목록은 canonical과 `alternates.languages`를 기본 목록 경로에 고정해 query 조합별 중복 신호를 만들지 않는다.
- `sitemap.xml`은 dead path를 포함하지 않아야 하며, `/search`, `/community`, `/services/intro`, `/site-map` 같은 주요 공개 진입 페이지를 누락하지 않는다.
- 정적 공개 URL의 sitemap `lastModified`는 매 요청 시각이 아니라 해당 라우트 소스 파일들의 실제 수정 시각(`fs.stat().mtime`) 기준으로 계산한다. 동적 체험 상세는 DB `updated_at`을 계속 사용한다.
- 동적 상세 중 체험 상세는 `status='active' && is_active !== false`일 때만 indexable 메타를 유지하고, 그 외 상태는 `noindex`로 낮춘다. 서비스 의뢰 상세(`/services/[requestId]`)는 공유용 title/description은 유지하되 항상 `noindex`다.
- 동적 상세 title은 root layout의 `%s | Locally` template를 전제로 하므로, page-level title 문자열에 `| Locally`나 `- Locally`를 중복으로 직접 붙이지 않는다. 공개 동적 상세(체험, 커뮤니티 글)는 self-canonical을 반드시 가진다.
- locale prefix rewrite를 쓰는 공개 페이지는 기본 no-prefix 경로를 canonical primary route로 사용하고, `/en`, `/ja`, `/zh` prefix URL은 `alternates.languages`로만 유지한다. `sitemap.xml`의 동적 공개 URL 포함 기준도 page-level indexability 규칙과 정확히 일치해야 한다.
- locale prefix URL(`/en`, `/ja`, `/zh`)로 진입한 요청은 middleware가 `app_lang` cookie도 같은 locale로 동기화해야 한다. 그래야 내부 RSC/메타 요청이 이전 cookie locale 때문에 canonical/JSON-LD를 잘못 만들지 않는다.
- JSON-LD는 `app/components/seo/JsonLd.tsx`와 `app/utils/structuredData.ts`를 통해 주입한다. 현재 범위는 홈(`Organization`, `WebSite` + `sameAs`), 공개 체험 상세(`Product` + `TouristTrip` 힌트), 커뮤니티 상세(`Article` + `BreadcrumbList`)까지이며, 실제 화면/DB에 존재하는 사실만 구조화 데이터에 넣는다.
- `robots.txt`는 private UI를 차단하는 용도가 아니라, 크롤 불필요한 `/api/`만 `Disallow`한다. private UI 차단은 route-level `noindex`가 단일 source다.

---

## 12. Experience Translation System

### 12.1 canonical content 기준

- `experiences.title` / `description`는 대표 원문(`source_locale`)의 canonical 텍스트를 담는 기준 필드다.
- locale별 노출 필드는 `title_ko`, `title_en`, `title_ja`, `title_zh`, `description_ko`, `description_en`, `description_ja`, `description_zh` 컬럼으로 유지한다.
- `manual_locales`는 호스트가 직접 입력한 언어 코드 목록만 담는다.
- `translation_meta`는 locale별 `mode/status/version` 상태를 담는 JSON 오브젝트다.
- `meeting_point_i18n`, `supplies_i18n`, `inclusions_i18n`, `exclusions_i18n`, `itinerary_i18n`, `rules_i18n`는 제목/소개글 외 guest-facing 본문을 locale별 JSON으로 저장한다.
- 호스트 생성/수정 폼은 이제 `manual_content + source_locale` 구조를 사용하고, 호스트가 선택한 구사 언어에 대해서만 직접 title/description을 입력한다.
- host write path는 더 이상 클라이언트 `supabase.from('experiences')` direct write를 사용하지 않고 `POST /api/host/experiences`, `PATCH /api/host/experiences/:id` 서버 API로 이관한다.
- host 일정 관리 저장도 `POST /api/host/experiences/:id/availability` 서버 route를 사용한다. `/host/experiences/[id]/dates`는 읽기(`experience_availability`, 예약 count)만 클라이언트에서 유지하고, 저장 시에는 서버가 현재 슬롯/확정 예약을 다시 조회해 diff를 계산한다.
- host 내 체험 삭제도 `DELETE /api/host/experiences/:id` 서버 route를 사용한다. `MyExperiences`와 `/host/experiences/[id]` 상세 페이지는 삭제 버튼에서 route만 호출하고, 실제 소유권 확인과 삭제 실행은 서버가 맡는다.
- PATCH 저장 시에는 기존 `manual_locales`를 보존 병합하고, `title/description/source_locale/manual_locales + meeting_point/itinerary/inclusions/exclusions/supplies/rules` 중 실제 변경이 있을 때만 `translation_version`을 증가시킨다.

### 12.2 queue 테이블

- `experience_translation_jobs`: 체험 1건의 번역 배치를 표현한다. 유니크 키는 `(experience_id, translation_version)`이다.
- `experience_translation_tasks`: locale별 실제 번역 단위를 표현한다. 유니크 키는 `(experience_id, translation_version, target_locale)`이다.
- create/update API는 save 시 manual locale을 제외한 지원 언어에 대해 `gemini` provider task를 enqueue 한다.
- worker는 한 locale task 안에서 `title`, `description`, `meeting_point`, `supplies`, `inclusions`, `exclusions`, `itinerary`, `rules`를 함께 번역하고, 완료 시 해당 locale의 i18n JSON/컬럼을 한 번에 갱신한다.
- host는 자동 번역본을 수정 UI에서 직접 보지 않는다. 비수동 locale 컬럼은 저장 시 clear 되고, 이후 worker가 다시 채운다.

### 12.3 provider rate-limit 상태

- `translation_provider_state`는 Gemini / Grok 호출 창(window), cooldown, dispatched count를 DB에서 단일 관리한다.
- worker는 provider row를 `FOR UPDATE`로 lease하여 RPM / 동시성 제한을 강제한다.
- 기본 seed는 `gemini-2.5-flash` 8 RPM / concurrency 1, `grok-3-fast` 60 RPM / concurrency 2다.
- 운영 환경에서는 model / RPM 값을 환경변수 override로 조정한다.
- Gemini 2.5 Flash가 `503/high demand/rate-limit`류의 일시 오류를 내면 provider 내부에서 `gemini-2.5-flash-lite`를 한 번 더 시도하고, 그 뒤에도 retryable이면 queue 규칙으로 넘긴다.
- lease RPC는 RPM뿐 아니라 reserved token 기반 TPM도 함께 체크하고, outcome RPC에서 reserved token을 실제 사용 token으로 정산한다.

### 12.4 worker / fallback

- cron route는 `GET /api/cron/experience-translations` 이고 `CRON_SECRET`으로 보호한다.
- worker는 `lease_experience_translation_task()` RPC로 provider-aware task lease를 수행해 DB 단에서 RPM / concurrency를 강제한다.
- Gemini task 처리 중 retryable / quota / 5xx 오류가 나면, 먼저 Gemini 내부 `Flash -> Flash-Lite` fallback을 1회 시도한다.
- 그 뒤에도 retryable이면 `XAI_API_KEY`가 있을 때만 task provider를 `grok`으로 바꾸고 같은 queue에서 재시도한다.
- `XAI_API_KEY`가 없으면 Gemini provider로 backoff 후 `retryable` 상태를 유지한다.
- Grok 실패 시에는 backoff 후 `retryable`, 최대 시도 수 초과 시 `failed`로 종료한다.
- provider token/cooldown bookkeeping은 `record_translation_provider_outcome()` RPC로 반영한다.
