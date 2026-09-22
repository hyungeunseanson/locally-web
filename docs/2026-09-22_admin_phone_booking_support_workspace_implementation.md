# 관리자 전화예약 Customer Support 구현 및 검증

## 1. 시작 main SHA

`78e8e264875b9666a1c7d1c0ef3075c82d9c8391` (`origin/main` fetch 후 확인).
원래 작업 디렉터리의 미커밋 변경을 보존하고 별도 worktree에서 구현했다.
PR #83의 결제 전 카드 anchor 예외를 반영했다.

## 2. Branch

`codex/admin-phone-booking-support-workspace`

## 3. 변경 파일

- `.github/workflows/cloudflare-foundation-check.yml`
- `app/admin/dashboard/page.tsx`
- `app/admin/dashboard/components/Sidebar.tsx`
- `app/admin/dashboard/components/TeamTab.tsx`
- `app/admin/dashboard/components/CustomerSupportTabs.tsx` (신규)
- `app/admin/dashboard/components/PhoneReservationTab.tsx`
- `app/admin/dashboard/components/ChatMonitor.tsx`
- `app/admin/dashboard/hooks/useAdminChatQuery.ts`
- `app/api/admin/inquiries/route.ts`
- `app/api/admin/customer-support/route.ts` (신규 admin read endpoint)
- `app/api/admin/customer-support/queries.ts` (신규 server-only 조회 유틸)
- `app/utils/phoneReservationWorkspace.ts` (신규)
- `app/utils/proxyBookingNotifications.ts`
- `playwright.phone-workspace.config.ts` (신규 격리 테스트 설정)
- `tests/unit/phone-workspace.spec.ts` (신규)
- `tests/ui/phone-workspace.spec.ts` (신규)
- `tests/ui/fixtures/phone-workspace-entry.tsx` (신규)
- `tests/e2e/86-proxy-booking-team-workspace.spec.ts` (변경된 업무 UI 계약 반영)
- 본 문서

## 4. Sidebar/menu

Message Monitoring을 Customer Support로 변경. 기본 진입은 `tab=CHATS&view=support`.

## 5. 세 탭

`1:1 문의` / `전화예약` / `실시간 모니터링`.
일반 문의에서는 유효하게 연결된 정식 전화예약 문의를 제외한다.
기존 고객↔호스트 모니터링은 기존 ChatMonitor를 사용한다.

## 6. Team Workspace 제거 범위

전화예약 import, 탭 버튼, proxy 초기 선택 props와 렌더 분기만 제거했다.
업무일지/할 일/팀 메모와 기존 팀 API는 유지했다.
전화예약 진입 및 이전 TEAM 링크 처리에서 TeamTab을 mount하지 않는다.

## 7. 전화예약 목록·필터·검색

처리할 일 / 결제 대기 / 종료 / 전체. 고객명, 업체명, 요청 ID, 주문번호 검색.
서버에서 anchor를 제외한 뒤 연결 검증, 필터·검색을 적용하고 페이지를 반환한다.
100건은 내부 조회 batch 크기이며 전체 검색/접근 상한이 아니다.
일반 문의/모니터링도 서버에서 분류한 뒤 pagination하며 목록에서 더 보기를 제공한다.

DB schema를 추가하지 않기 위해 전화예약의 파생 필터와 검색은 서버에서 batch를 순회한다.
선택된 페이지만 브라우저에 반환한다. 깊은 페이지·희소 검색은 데이터량에 비례해 조회 비용이 증가한다.
현재 구현은 새 검색 인프라나 DB migration 없이 이 절충을 사용한다.

## 8. 상세 UX

데스크톱 목록+상세 2열, 모바일 목록→상세/뒤로가기.
category별 핵심 신청 필드를 결제보다 먼저 표시하고 나머지는 신청서 전체 보기에 둔다.
전화번호 복사, 업체 링크, 한 줄 결제 요약, 결제 상세 접기/펼치기를 제공한다.
수동 입금 확인은 기존 NAVER/무통장 WAITING 조건에서만 표시한다.
환불·취소는 결제 상세 안에 있다. 모바일 목록 DOM 및 탭별 초안을 유지한다.

## 9. Conversation 재사용

ChatMonitor에 작은 embedded phone 모드를 추가했다.
기존 useAdminChatQuery와 inquiry messages/read/send/realtime 경로를 그대로 사용한다.
PhoneReservationTab에는 별도 메시지 전송 transport가 없다.
기존 공식 발신자, soft-delete, 알림/email의 공통 서버 구현을 변경하지 않았다.

## 10. 답변 보내기

기존 `/api/inquiries/message` 경로로 전송. proxy status를 변경하지 않는다.

## 11. 안내 보내고 완료

메시지 저장 성공 → 기존 `/api/proxy-bookings/:id` PATCH COMPLETED.
결제 완료된 PENDING/IN_PROGRESS 모두 바로 완료할 수 있다.
기존 미결제 완료 거부 server guard를 유지한다.

## 12. Partial failure

메시지 성공 후 PATCH 실패 시 세션 내 inquiry별 실패 상태를 유지한다.
`고객 안내는 전송됐지만 완료 처리에 실패했습니다.` 및 `완료 처리 다시 시도` 표시.
재시도는 PATCH만 수행하고 메시지를 재전송하지 않는다.
페이지 재로드 후에도 마지막 안내가 관리자이고 active/paid이면 상태만 완료하는 보조 액션이 있다.

## 13. 완료 후 추가 답장

최근 실제 메시지(text/image/legacy null, soft-deleted 제외)가 고객 발신이면
COMPLETED를 유지하면서 추가 답장 badge 및 처리할 일에 표시한다.
읽음 여부는 판정에 사용하지 않는다. 관리자 답장 후 badge를 제거한다.

## 14. Deep link

- CHATS 기본 및 view=support → 일반 문의
- view=phone + proxyRequestId → 정식 전화예약 상세
- view=monitor + inquiryId → 모니터링 상세
- TEAM&teamTab=proxy → CHATS&view=phone replace (proxyRequestId 유지)
- 기존 CHATS&inquiryId → 실제 linked inquiry 관계를 조회하여 phone/support/monitor로 분류

잘못된 고객 연결·중복 연결·누락은 확인 필요로 노출하며 잘못 연결된 대화는 보내기/완료 대상에서 제외한다.
anchor는 목록/검색/분류/상세에서 제외한다. 신규 상세 endpoint도 anchor에 404를 반환한다.

## 15. 알림 링크

새 전화예약 admin alert는 `tab=CHATS&view=phone&proxyRequestId=...` 사용.
저장된 알림은 수정하지 않았다. 기존 inquiry 링크는 위 routing compatibility로 처리한다.

## 16. DB migration

0개. Production migration/current-state ledger 변경 없음.
`finalize_proxy_card_intake_atomic` 및 PR #83 migration 변경 없음.

## 17. RLS/grant

변경 0개. 새 읽기 endpoint는 서버 인증 및 resolveAdminAccess 뒤에만 admin client를 사용한다.

## 18. Payment/refund semantics

결제/환불 route, 금액 유틸, provider, 취소 정책 및 activation RPC 변경 없음.
기존 confirm-payment / cancel-payment / refund-payment 및 status PATCH를 재사용한다.

## 19. Targeted tests

`npx playwright test -c playwright.phone-workspace.config.ts`: **24 passed**.
실제 React 컴포넌트를 browser에서 구동하되 API/auth/realtime 경계는 로컬 fixture로 격리한다.
서버 테스트는 실제 route와 Supabase query builder에 fake fetch를 연결한다.
라우팅, 100건 초과 조회, 분류, anchor 제외/404, 권한, 필터, category 우선순위,
전송/완료/부분 실패/재시도, 후속 답장, 모바일 초안 및 화면 폭을 검사한다.
이 테스트는 Foundation CI에도 추가했다.

## 20. Regression

격리 회귀: **24 passed**.

- `260-proxy-card-intake-contract.spec.ts` (기존 계약 무수정)
- `215-inquiry-admin-intervention-contract.spec.ts`
- `223-inquiry-rls-authorization-boundary.spec.ts` (무수정)
- `87-proxy-booking-fee-util.spec.ts`
- `231-proxy-request-form-schema.spec.ts`
- `tests/ui/admin-chat-layer.spec.ts`

Next production server에서 `229-proxy-bank-transfer-guidance.spec.ts`: **1 passed**.
총 독립 실행 성공: 49 tests.

다음 DB 연동 suite도 실행을 시도했으나 별도 테스트 DB/.env.local 부재로 준비 단계 실패:

- `14-admin-chats.spec.ts`
- `86-proxy-booking-team-workspace.spec.ts`
- `105-proxy-booking-self-service.spec.ts`
- `119-proxy-notification-localization.spec.ts`
- `161-admin-support-unread-alerts.spec.ts`
- `192-proxy-self-service-admin-refund-linked-inquiry-journey.spec.ts`
- `165-card-payment-provider-cutover.spec.ts` 중 atomic activation/replay 및 rollback runtime cases

로그 기준 8 failed / 15 did not run, 원인은 `.env.local` ENOENT다.
Production 환경 파일을 복사하지 않았다. 카드 activation 시 1개 inquiry/message 생성, replay 동시성 등
실제 DB runtime 보장은 이 작업에서 재검증 완료로 주장하지 않는다.

## 21. TypeScript/ESLint

`tsc --noEmit` 성공. 변경 파일 ESLint 오류/경고 0.
전체 source lint는 시작 baseline과 동일: 오류 0, 기존 경고 3
(AnalyticsHostSection 2, AuthContext 1).
빌드 이후 전체 비교에서는 생성물 `.open-next/**`, `.wrangler/**`, `.tmp/**`를 제외했다.
`git diff --check` 성공.

## 22. Next/OpenNext/Wrangler

- Next production build 성공
- `cloudflare:build:production` 성공 (Next build 포함, production media build contract PASS)
- Wrangler 4.129.1 canary/production typegen 성공
- canary/production deploy **dry-run** 성공
- Cloudflare artifact validation 성공

외부 DB 쓰기를 막기 위해 빌드·테스트 환경은 localhost Supabase dummy 값만 사용했다.
실제 deploy 명령은 실행하지 않았다.

## 23. Baseline/current-state/backup

Production baseline static contract PASS.
Production current-state static contract PASS.
backup workflow/isolation, Postgres lifecycle contract PASS; storage backup unit tests 18 passed.
Docker 기반 실제 cold restore는 로컬 Docker runtime이 없어 실행하지 않았다.

## 24. PR

정상 commit/push 후 생성 대상. 아직 생성하지 않음.
예정 제목: `feat: simplify admin phone booking workflow`.

## 25. CI

PR 생성 전이므로 원격 CI 미실행. 로컬 검증과 구분한다.

## 26. Production

배포, DB write test, 실제 고객 메시지, 결제/환불 조작 모두 0.
main push/merge 없음.

## 27. 남은 이슈

- 별도 staging/local Supabase에서 위 DB 연동 regression과 카드 activation/replay 재검증 필요.
- 정상 commit/push, PR 생성 및 CI 확인이 남아 있다.
- 깊은 검색은 server batch scan 비용이 증가하는 application-only 절충이 있다.
- 모바일·데스크톱 캡처 및 상세 실행 로그는 worktree의 `.tmp/phone-validation/`에 있으며 commit 대상에서 제외한다.
