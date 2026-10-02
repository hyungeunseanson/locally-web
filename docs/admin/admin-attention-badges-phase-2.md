# 관리자 새 항목·처리 대기 표시: Phase 2 검수 기록

관리자가 아직 확인하지 않은 대화에는 N을 하나 표시한다. 상단 탭과 Sidebar는 이런 **대화의 수**를 함께 보여준다. 확인한 뒤에도 답변이 필요하면 기존 답변 필요/추가 답장 표시는 남는다. 승인·입금 업무는 `대기 n`으로 구분한다.

## 기준선과 보존

- 최초 조사 기준: `6cda01f3f423d626e32a6d62904506e135f85334`.
- Hotfix 후 fetch로 확인하고 재개한 기준: `c7d37dab5f5bb9afb22c9c9b88498f05441b5fbc` (#155).
- PR 직전 fetch에서 #156의 `0b556cc578b6e8960d64f8210c76cae9f48677c4`가 추가된 것을 확인해 최종 branch를 그 main 위로 rebase했다. package scripts 충돌은 양쪽 테스트 명령을 모두 보존해 해결했다. hotfix hook 기준선은 그대로다.
- Branch: `codex/admin-attention-badges-phase-2`. 이전 미커밋 작업을 파일 백업과 stash에 보존하고 이 branch를 main으로 fast-forward한 뒤 다시 적용했다. 다른 branch는 수정하지 않았다.
- `6cda01f3 → c7d37dab` 차이는 hook, loading unit tests, phone browser races, Phase 1 gate의 4개 파일이다. 메시지 flight 공유, 직렬 trailing refresh, 요청 버전 보호, 각 GET의 spinner 종료, 선택 해제/unmount에만 요청 무효화하는 hotfix 블록을 유지했다.
- N 확인은 성공한 메시지 snapshot이 React 화면에 반영된 뒤 별도 effect로 처리한다. ACK 대기는 메시지 loading과 독립이다.

## Git history

| 근거 | 확인한 내용 |
|---|---|
| `cf546e7c8a554668fd9f2516245dd26a25ab6007` / 2026-04-02 | `Disable admin sidebar badge counts`. Sidebar에서 210줄을 제거해 숫자 표시, count 조회, debounce, 5분 polling, 여러 Realtime/브라우저 이벤트 처리를 비활성화했다. |
| `407c5f31` / 2026-03-02 | CS 미답변 badge와 관리자 CS 개시 기능. 업무 대기와 새 항목의 의미가 같지는 않다. |
| `ca6ce9e9c624103ad2bacfadeae68febc24a1459` / 2026-03-26 | monitor 표시/시간/목록 개선. 대화 행 N 제거의 근거는 확인되지 않았다. |
| `b35980dd799514d73eeea5e20877b8e5ee85be77` / 2026-03-14 | 관리자 경량 query hook 분리. |
| `3b92e92cefec3bcd15a73e52c0c54e7891cbed66` / 2026-04-17 | 읽음/미읽음 동기화와 대화 조회·전송 뒤 full list 조회 감소. |

제거 commit에는 비활성화 외의 구체적 사유가 적혀 있지 않다. 코드상 과거 CS 숫자는 participant `is_read`/메시지 수에 의존했고, Team/예약은 브라우저 저장 상태를 사용했다. 이런 의미 혼합과 조회 구조는 확인 가능한 문제지만, 이를 제거 당시 작성자의 의도라고 단정하지 않는다. 대화 **행 N**의 별도 제거 commit은 확인하지 못했다.

## 전체 surface 조사와 결정

| 경로 | 기존 기준/문제 | 이번 결정 |
|---|---|---|
| ChatMonitor / useAdminChatQuery | support admin unread, 일반 대화 participant unread 혼재; GET 후 ACK가 render보다 먼저 가능 | `admin_read_at`만 사용. 고객·호스트 포함, 모든 관리자/삭제 메시지 제외. render 후 정확한 ID snapshot ACK. |
| CustomerSupportTabs | 세 탭 숫자 없음 | support/phone/monitor distinct 미확인 대화 수. |
| PhoneReservationTab / customer-support queries | linked inquiry, 추가 답장/운영 주의 표시 존재 | 유효한 연결을 batch 조회해 N 추가. 기존 업무 표시는 유지. |
| Sidebar / sidebar-counts | 표시 비활성화; 기존 CS는 미읽은 메시지 수 | layout 단일 store 공유. CS 합계와 Alerts 정확한 미읽음 수 연결. |
| AdminAlertsTab | 최대 100개 목록에서 숫자 계산; DELETE의 old PK만 오는 경우 누락; reconnect catch-up 없음 | 서버 전체 count를 Sidebar와 공유. INSERT/UPDATE는 local delta, DELETE PK 처리. 재접속/online/visibility/5분 복구, 실패 시 목록 보존. |
| Team Workspace / team-counts | user-scoped localStorage 시각 이후 task+comment 개수; 개인 브라우저 기준. 내부 Team N 존재 | **FOLLOW-UP CANDIDATE**. 관리자 공통 unseen으로 Sidebar에 복원하지 않음. |
| adminBadgeState / Master Ledger | 브라우저의 viewed booking IDs는 확인 이력의 신뢰 가능한 DB 기준이 아님 | **FOLLOW-UP CANDIDATE**. 이 상태를 N으로 사용하지 않음. |
| Approvals / Experience approvals | DB `status=pending` head count | 합계 `대기 n` 표시. NEW와 구분. |
| pending bank bookings | 기존 `bookings: PENDING + bank` | Master Ledger `대기 n`. |
| Service Requests | 기존 `service_bookings: PENDING + bank` | 이 입금 대기 subset만 `대기 n`. 전체 Service 업무 수를 뜻하지 않음. |
| Billing & Revenue / 정산 | 매출 집계·수동 정산/환불 등 서로 다른 상태, 통합 미처리 기준 없음 | **FOLLOW-UP CANDIDATE**. 새 정산 상태 시스템은 범위 밖. |
| User Management / Data Analytics | 승인/CS와 별개인 조회 화면; 확실한 unseen/work queue 기준 없음 | 이번에는 badge 없음. |

Action 숫자는 initial/catch-up/5분 안전망에서 확인한 DB 상태다. 같은 화면에서 승인·삭제·입금·취소 처리에 성공하면 shared store를 즉시 갱신한다. 관련 테이블의 publication 변경이나 결제·승인 서버 workflow 변경은 하지 않았다.

## PR #157 rollout 검수 수정

Phase 1은 support 이력에만 admin seen을 초기화했다. 따라서 일반 monitor의 과거 NULL을 그대로 N으로 세면 오래된 대화를 새 문의처럼 표시한다. pending Phase 2 SQL에 **한 번만 적용되는 일반 대화 시작 기준**을 추가했다.

- `private.admin_monitor_cutover`에는 적용 시각과 실제 baseline 메시지/대화 수를 한 행으로 기록한다. 공개 Data API 밖이며 RLS 활성화, anon/authenticated 접근 없음, service_role SELECT만 허용한다.
- 첫 적용에서 messages/inquiries 쓰기 잠금을 얻은 뒤 존재하는 일반 메시지 중 admin seen이 NULL인 유효 non-admin 행만 baseline 처리한다. `type IS DISTINCT FROM 'admin' AND ... 'admin_support'`를 사용해 NULL inquiry type도 포함한다. 삭제/관리자/이미 확인된 메시지와 모든 support/phone 이력은 보존한다. 고객 `is_read/read_at`은 쓰지 않는다.
- 잠금 이후의 행 존재가 경계다. `created_at`이나 ID 상한으로 추측하지 않는다. 적용 후 새 메시지는 과거 시각/작은 ID로 INSERT돼도 NULL로 남는다. 기록이 있으면 재실행은 baseline을 생략한다. UPDATE와 기록은 같은 transaction으로 commit/rollback한다.
- Production 읽기 전용 preflight 재조회: **2026-10-02 15:24 KST** 일반 monitor **40대화·410메시지**가 현재 예상 baseline 대상이다. 그중 331메시지는 7일 초과, 135메시지는 30일 초과, 가장 오래된 값은 `2026-05-07T14:48:21.670866Z`였다. support 후보는 0, 보존 대상 phone은 **10대화·12메시지**였다. 실제 적용 시점의 트래픽에 따라 수는 변하며 테스트 expected로 쓰지 않는다. Phase 2는 미적용이고 participant UPDATE grant는 두 테이블 모두 false다.
- 로컬 PostgreSQL에서 **적용 전** 일반/NULL-type guest·host 이력을 seed한다. 적용 직후 monitor N 0, 모든 participant receipts 완전 동일, support/phone unread 동일을 검증했다. **적용 후** 과거 created_at의 guest/host 메시지 두 건을 INSERT하면 해당 대화만 N 1이며 exact rendered IDs ACK 후 N 0이다. 즉시 재실행 및 새 메시지 이후 재실행도 처음 기록/새 N을 보존한다.

처리 대기 배지의 기존 성공 경로도 확인했다. Approvals의 `updateAdminStatus`/삭제 뒤에는 approvals 목록만 갱신했고, Master Ledger의 `refreshAfterMutation`은 장부와 선택적 부모 callback만 실행했다(현재 dashboard는 callback 미전달). Service Requests의 입금/취소 성공 callback 역시 service 목록만 갱신했다. Provider는 이 테이블들을 구독하지 않으므로 기존 배지는 다른 catch-up이 없다면 최대 5분 지연된다.

이 세 경로의 **서버 성공 확인 뒤** 공통 `attention.refresh()`를 호출한다. 실패한 mutation은 숫자를 줄이지 않는다. 이 count 요청은 thread GET을 호출하지 않고 loading/ACK와 독립이다. 이미 실행 중인 full count GET이 실패해도 성공한 mutation이 요청한 직렬 trailing refresh는 소실되지 않는다. 실제 hook/MasterLedger/ServiceAdmin 컴포넌트를 DOM에 mount한 테스트에서 rejection → 숫자 보존, success → timer 없이 공통 GET 1회 및 배지 갱신, thread GET 0을 확인했다. 승인/입금 Realtime publication이나 Cron은 추가하지 않았다.

## 의미와 race 보호

- **NEW / UNSEEN**: 유효한 non-admin 메시지 중 `admin_read_at IS NULL`인 메시지가 존재하는 대화. 일반 monitor는 최초 cutover 이전 이력을 baseline 처리한 뒤 이 기준을 적용한다. 메시지 1개/10개 모두 행 N 하나, 탭 숫자 한 건.
- **ACTION REQUIRED**: 답변 필요, 전화예약 추가 답장/주의, 승인·입금 대기. 열람만으로 없애지 않는다.
- admin seen은 기존 Phase 1의 공통 관리자 확인 상태다. 고객/호스트 `is_read/read_at`이나 브라우저의 localStorage 시각과 섞지 않는다.
- 전화예약은 formal proxy 한 건, 같은 고객, support inquiry type이 모두 맞아야 한다. 중복·잘못된 고객·card anchor는 fail closed로 support에 남긴다.
- `ack_admin_inquiry_snapshot`은 **실제로 렌더링한 메시지 ID 집합**만 확인한다. ACK 10 도중 들어온 11뿐 아니라, 나중에 commit된 더 작은 ID 9도 확인하지 않는다.
- 성공한 동일 snapshot은 ACK cache에 저장한다. 실패는 N을 유지하고 다음 성공한 조회에서 재시도할 수 있다. 서버 remaining unread와 store revision을 함께 확인하므로 오래된 GET/ACK가 새 N을 지우지 못한다.
- Sidebar 두 인스턴스와 세 탭이 한 user-scoped store를 공유한다. 변경 inquiry IDs는 250ms에 모아 한 targeted RPC로 조회한다. 메시지 읽음 UPDATE는 thread GET을 발생시키지 않는다.
- 정상 연결 중 30초 polling을 추가하지 않았다. SUBSCRIBED/reconnect, online, visibility 복귀 시 즉시 catch-up과 기존 5분 안전망을 사용한다. Cron/Redis/KV 없음.

## 다섯 경로의 교차 검증

1. Git: 위 commit과 제거 diff, hotfix 4개 파일을 비교했다.
2. Production DB: `BEGIN READ ONLY ... ROLLBACK` 집계만 실행했다. 최초 조사 당시 support 0 / phone **11대화·13메시지** / monitor **40대화·407메시지**였다. monitor 값은 과거 NULL 후보이며 새 메시지라는 증거가 아니었다. 위 rollout 수정의 재집계와 baseline 기준으로 보완했다. 개인정보/메시지 내용은 가져오지 않았다. 숫자는 실제 고객 활동으로 달라질 수 있는 관찰값이며 고정 expected fixture가 아니다.
3. API: 동일 로컬 PostgreSQL fixture에서 support 1 / phone 1 / monitor 1, 합계 3을 검증했다. 실제 list API의 전화예약 제외, phone API의 10메시지→1대화, Sidebar 3을 대조했다. phone activity 조회는 batch 한 번이며 Guest/Host는 Sidebar API 403, 비로그인은 401이다.
4. Realtime: INSERT burst, ACK UPDATE, stale GET/ACK, 재접속·online·visibility, Alerts INSERT/PK-only DELETE를 검증했다. 읽음 UPDATE 10회에도 thread GET은 증가하지 않았다.
5. UI: 실제 컴포넌트를 Chromium/WebKit에 bundle해 390px/1280px에서 확인했다. 세 탭 숫자와 Sidebar 합계, N 하나, 전화예약 추가 답장 독립, Alerts 143(목록 범위 밖 포함), ACK 실패/성공/놓친 새 메시지 복구를 검증했다. 외부 네트워크는 차단한 합성 fixture다. Production 브라우저에는 쓰기를 수행하지 않았다.

Publication은 기존 8개(`admin_audit_logs`, `admin_task_comments`, `admin_tasks`, `admin_whitelist`, `inquiries`, `inquiry_messages`, `notifications`, `profiles`)를 확인했다. `authenticated`의 inquiries/messages 컬럼 UPDATE 권한은 둘 다 false다. 실제 Phase 1 ledger는 `20261002024534`, historical reinquiry ledger는 `20261002024638`이며 Phase 2는 미적용이다.

## 같은 fixture의 요청 수: hotfix main → Phase 2

초기 조회가 끝난 뒤, visible/subscribed이고 한 대화를 열어 둔 동일 fixture를 사용했다. 실제 API route를 실행하고 각 DB query/RPC 호출을 센 값이다. ACK 뒤에 발행되는 메시지별 Realtime UPDATE도 포함한다. 지연시간이나 Production DB 내부 SQL statement 횟수의 측정은 아니다.

| 상황 | API | DB query/RPC | full list GET | thread GET | aggregate/count GET | ACK |
|---|---:|---:|---:|---:|---:|---:|
| idle 10분 | 4 → 6 | 32 → 44 | 2 → 2 | 2 → 2 | 0 → 2 | 0 → 0 |
| 새 메시지 1건 | 3 → 4 | 22 → 18 | 1 → 0 | 1 → 1 | 0 → 2 | 1 → 1 |
| 10건 burst | 4 → 4 | 30 → 18 | 1 → 0 | 2 → 1 | 0 → 2 | 1 → 1 |

idle의 추가 2회는 새 Sidebar/탭 공통 count의 5분 안전망이다. 새 메시지는 전체 목록 재조회 대신 해당 대화 activity 조회를 한다. 두 aggregate는 도착과 ACK UPDATE 후의 각각 한 번이다. 10개 ACK UPDATE도 한 batch로 합친다.

최초 6cda01f3 기준 frozen fixture도 보존했다. 그 기준의 10건 burst는 thread GET 10 / API 12 / DB 94였지만, 최종 비교 기준은 이미 고쳐진 c7d37dab이다. hotfix+Phase 2 phone loading test에서 동일 thread 동시 GET 최대 1, 초기 pending 중 catch-up GET 1 → 초기 성공 뒤 직렬 trailing GET 1을 확인했다.

## 준비한 DB 변경과 적용 경계

- 제안 파일: `supabase/migrations/20261002041848_admin_attention_badges_phase_2.sql`.
- 기존 activity/legacy ACK를 일반 대화까지 확장하고, one-time monitor baseline, exact snapshot ACK 및 shared attention RPC를 추가한다. unseen partial index를 추가한다. service-role 전용/빈 search_path를 검증한다.
- 로컬 PostgreSQL(PGlite)에서 실제 SQL 실행·재실행, roles/admin whitelist/deleted 제외, snapshot 경계/remaining unread, 고객 read 보존, direct UPDATE 차단, phone 분류를 검증했다.
- `pendingProductionMigrations`, `pendingApplicationFunctions`, `pendingPrivateTables`에만 proposal을 기록한다. pending migration SHA256: `d20d5774318f8fe52dc41d13a533728b13c98a20fab812cd693737dba0de51a2`. required objects/current-state checker/staging target/contract fixture를 함께 동기화했다. 적용된 migration SQL, 실제 ledger mapping, Production manifest/current-state SQL은 변경하지 않았다.
- Production parity contract는 pending SQL **이전** checkpoint에서 실행한다. 로컬/staging의 승인된 target 단계에서만 pending SQL 뒤 `admin-attention-target-contract.sql`을 실행한다.
- 이 코드의 shared count/새 ACK RPC에는 proposal이 필요하므로, 이번 Draft PR은 Production 배포 완료를 뜻하지 않는다. 이번 작업에서는 적용·배포하지 않는다.

## 검증 명령과 결과

- `npm run test:admin-attention:phase2`: 14 unit + 14 Chromium/WebKit browser tests PASS. cutover/재실행 및 action freshness 회귀 포함.
- `npm run test:admin-chat:phase1`: hotfix `admin-message-monitoring-loading`, Phase 1 read/security/reopen/history/idle, PR #151/#152 성능·optimistic·Realtime·race, chat/platform 및 KST browser regression PASS.
- `npx playwright test -c playwright.phone-workspace.config.ts`: 87 PASS, hotfix phone initial + SUBSCRIBED/visibility/online browser races 포함.
- `npm run supabase:staging:contract`: immutable baseline/current-state/bootstrap + 13 contract tests PASS.
- `npm run lint`, `npx tsc --noEmit`: PASS. 전체 lint의 기존 unrelated warnings 7개는 수정하지 않았다. 변경 파일에는 lint 오류 없음.
- GitHub Cloudflare Foundation 및 Chat performance CI는 Draft PR head에서 최종 확인한다.

Production DB mutation = **0**. Production deploy = **0**. Supabase 설정/publication 변경 = **0**.
