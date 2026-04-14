# 체험 예약 Settlement Sync 운영 Runbook

## Summary
- 이 문서는 `체험 예약`의 `completed sync` 운영 절차를 고정한다.
- 이번 release close-out에서는 정산 비즈니스 로직 리팩터 대신 이 운영 절차를 source of truth로 유지한다.
- 실제 운영 당일에는 먼저 아래 짧은 체크리스트를 본다.
  - [experience settlement day-of checklist](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_experience_settlement_day_of_checklist.md:1)
- 대상 체인은 아래로 한정한다.
  - `bookings.status='PAID' | 'confirmed'` 상태의 과거 체험 예약
  - `/api/cron/complete-trips`
  - `/api/admin/settlement-sync`
  - `app/utils/settlementSync/experienceCompletion.ts`
  - `Sales > Settlement Sync Health`
- 목적은 3가지다.
  - 운영자가 `completed sync`가 정상인지 빠르게 판정한다
  - 지연/실패 시 안전한 수동 복구 순서를 따른다
  - 정산 실행 전에 `completed` 전환이 실제로 끝났는지 확인한다

## 운영자용 짧은 버전
- 먼저 `Admin > Sales > Settlement Sync Health`의 `체험 카드`와 `operator banner`를 함께 본다.
- 아래 4개가 모두 괜찮으면 그날은 sync 쪽에서 추가 작업이 없다.
  - `health_state='healthy'`
  - `running_stale=false`
  - `503 infra banner` 없음
  - `due count`가 `0`이거나 설명 가능하게 낮다
- 이 조건이면 바로 다음 단계로 넘어간다.
  - `payout queue` 확인
  - 필요한 host만 정산 실행
- 반대로 아래 셋 중 하나라도 보이면, payout보다 sync를 먼저 본다.
  - `delayed`
  - `running_stale`
  - `failed` 또는 `503`

## 실제 점검 순서
1. `Admin > Sales`로 들어간다.
2. `Settlement Sync Health`에서 `체험 카드`와 `operator banner`를 먼저 본다.
3. 아래 4가지만 확인한다.
   - 상태 라벨
   - `due count`
   - `last success`
   - `infra banner` 유무
4. 카드가 `healthy`면 sync 쪽 조치는 끝이다.
   - 바로 `payout queue`로 넘어간다.
5. 카드가 `delayed`면 `지연 건 지금 실행(run due)`을 1회만 실행한다.
6. 카드가 `running`이면 기다린다.
   - 중복 클릭하지 않는다.
7. 카드가 `running_stale`, `failed`, `503`이면 payout 실행을 멈춘다.
   - 먼저 sync 상태를 복구한다.

## 아무것도 안 해도 되는 조건
- 아래 조건이면 운영자가 sync에 손대지 않아도 된다.
  - `health_state='healthy'`
  - `due count=0`, 또는 남아 있어도 직전 실행/현재 시간대 기준으로 설명 가능하다
  - `last success`가 오래 끊겨 있지 않다
  - `running_stale`, `failed`, `503`가 없다
- 이 경우 해야 할 일은 sync가 아니라 `정산 실행 전 대상 확인`뿐이다.

## Source Of Truth
- 체험 완료 동기화 owner
  - [app/utils/settlementSync/experienceCompletion.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/settlementSync/experienceCompletion.ts:1)
- cron 진입점
  - [app/api/cron/complete-trips/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/cron/complete-trips/route.ts:1)
- 어드민 수동 진입점 / health API
  - [app/api/admin/settlement-sync/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/settlement-sync/route.ts:1)
- 운영 UI
  - [app/admin/dashboard/components/SettlementSyncPanel.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/SettlementSyncPanel.tsx:1)
  - [app/admin/dashboard/components/SalesTab.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/admin/dashboard/components/SalesTab.tsx:231)
- 정산 대기/완료 반영 owner
  - [app/api/admin/payout-queue/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/admin/payout-queue/route.ts:1)
  - [app/api/host/earnings/summary/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/host/earnings/summary/route.ts:1)

## 운영 의미 고정
- `ReservationManager`의 `completed`는 일정 관점이다.
  - 날짜가 지났고 pending/requesting이 아니면 completed 탭으로 갈 수 있다.
- `Settlement Sync`의 `completed`는 DB 정산 관점이다.
  - 실제 DB `bookings.status='completed'` 전환을 뜻한다.
- `호스트 수익 pending payout`과 `어드민 payout queue pending`은 둘 다 DB 정산 관점을 따른다.
- 따라서 예약 탭에서 지난 일정으로 보여도, DB completed sync가 끝나기 전까지는 정산 대기로 올라오지 않을 수 있다.

## 정상 상태 판단
- `Sales > Settlement Sync Health`에서 체험 카드가 아래 조건이면 정상으로 본다.
  - `health_state='healthy'`
  - `due_candidate_count=0` 이거나 매우 낮고 빠르게 감소한다
  - `running_stale=false`
  - 최근 `last_success_at`이 설명 가능하다
- 아래 상태도 즉시 장애는 아니다.
  - `running`
    - 현재 배치가 실행 중인 상태
  - `delayed`
    - overdue backlog가 있어 운영자 확인이 필요한 상태
- 아래 상태는 정산 실행 전 반드시 확인해야 한다.
  - `running_stale`
  - `failed`
  - `503 infra disabled banner`

## 일일 운영 순서
1. `Admin > Sales`로 들어간다.
2. `Settlement Sync Health`의 체험 카드와 `operator banner`를 먼저 본다.
3. 아래 4가지를 확인한다.
   - 상태 라벨
   - `due count`
   - `최대 지연`
   - `last success` 또는 `last heartbeat`
4. 체험 카드가 `healthy`면 다음 단계로 간다.
   - `payout queue`에서 pending settlement를 확인한다.
   - 필요한 host만 정산 실행한다.
5. 체험 카드가 `delayed`면 즉시 아래 순서를 따른다.
   - `지연 건 지금 실행(run due)`을 1회 실행한다.
   - 성공 메시지가 `completed` 또는 `no_candidates`인지 본다.
   - 새로고침 후 `due count` 감소 여부를 확인한다.
6. 체험 카드가 `running`이면 기다린다.
   - 추가 수동 실행은 하지 않는다.
7. 체험 카드가 `running_stale`, `failed`, `503`이면 정산 실행을 잠시 멈춘다.
   - 아래 incident 순서로 전환한다.

## Incident 대응 순서

### A. `delayed`
- 의미
  - due candidate가 있고, 최근 성공으로 backlog가 해소되지 않았다.
- 조치
  1. `지연 건 지금 실행(run due)` 1회 실행
  2. 결과 확인
     - `completed`: 정상 복구 시도 성공
     - `no_candidates`: health snapshot만 늦었는지 새로고침 확인
     - `already_running`: 다른 실행이 있으므로 기다림
  3. `payout queue`에서 pending settlement가 늘거나 이동했는지 확인
  4. host earnings pending bucket이 설명 가능하게 늘었는지 spot check
- 중단 조건
  - `지연 건 지금 실행(run due)` 후에도 `due count`가 유지되거나 증가
  - `failed`로 바뀜
  - `running_stale`로 바뀜

### B. `running_stale`
- 의미
  - 이전 실행이 lease/heartbeat를 잃은 채 멈춘 상태
- 조치
  1. 즉시 payout 실행은 멈춘다
  2. `last heartbeat`, `last failure`, `due count`를 기록한다
  3. 필요 시 1회 새 `지연 건 지금 실행(run due)`을 시도한다
  4. 성공적으로 새 run이 잡혀 `completed` 또는 `healthy`로 돌아오면 계속 진행한다
- 중단 조건
  - 새 `지연 건 지금 실행(run due)`도 `already_running`만 반복
  - `503`으로 떨어짐

### C. `failed`
- 의미
  - 마지막 동기화 실행이 실패했다
- 조치
  1. `last_failure_message`를 확인한다
  2. 메시지가 infra/RPC/admin_job_runs 계열이면 코드 복구 전까지 payout 중단
  3. 단순 일시 오류로 판단되면 `지연 건 지금 실행(run due)` 1회 재시도
- 중단 조건
  - 재시도 후 동일 failure 반복
  - `503 infra banner` 동반

### D. `503 infra banner`
- 의미
  - required infra가 없거나 접근 불가하다
  - 현재 구조는 fail-open이 아니라 fail-closed다
- 조치
  1. payout 실행 중단
  2. `admin_job_runs`, experience due RPC, cron auth/infra를 확인
  3. 패널의 manual trigger가 disabled인 것이 정상인지 확인
- 중단 조건
  - `503`이 해소되기 전까지 체험 정산 실행 금지

## 수동 실행 규칙

### `지연 건 지금 실행(run due)`
- 용도
  - backlog 전체를 현재 due 기준으로 한 번 처리
- 사용 시점
  - `delayed`
  - cron 직후인데 backlog가 남아 보일 때
- 실제 버튼 라벨
  - `지연 건 지금 실행`
- 사용 금지
  - `running` 상태에서 중복 클릭
  - `503` infra 상태

### `force one`
- 용도
  - 특정 `booking_id` 또는 `order_id`가 이미 due인데 scheduler만 놓친 경우
- 입력값
  - 기본은 `order_id` 또는 `booking_id`
- 기대 결과
  - `completed`
  - `already_processed`
  - `not_due`
- 운영 원칙
  - `force one`은 business override가 아니다
  - future booking을 억지 완료시키는 용도로 사용하지 않는다
- 사용 금지
  - guest가 단순히 “지난 일정인데 예약 탭에 남아 있다”고 말한 것만으로 즉시 실행
  - 아직 due 여부를 확인하지 않은 예약

## 정산 실행 전 체크
1. `Settlement Sync Health` 체험 카드가 `healthy` 또는 방금 수동 복구 후 정상화된 상태인지 확인
2. `payout queue`에서 대상 체험 예약이 pending settlement로 보이는지 확인
3. 대상 booking의 의미가 아래와 맞는지 확인
   - `status='completed'`
   - `payout_status='pending'`
4. 그 다음에만 host payout 실행

## 정산 실행 후 체크
1. `payout queue`에서 해당 host pending amount가 줄었는지 확인
2. `completed settlement` 또는 paid history로 이동했는지 확인
3. host earnings에서 아래가 맞는지 spot check
   - pending payout 감소
   - paid payout 증가
   - `latest_paid_at` 갱신

## Day-of 체크리스트
- cutover day나 운영 점검일에는 아래 순서로만 본다.
1. `Sales > Settlement Sync Health`
   - 체험 카드 `healthy`
   - `operator banner`가 `목록 반영 정상` 또는 같은 의미의 진행 가능 안내를 보여준다
   - `due count` 설명 가능
2. `/api/admin/settlement-sync`가 200을 반환하는지
3. cron 경로가 auth 포함 시 설명 가능한지
   - `/api/cron/complete-trips`
4. pending payout가 있는 host 1명을 골라 상태만 확인
   - 실제 payout 실행 전에는 `completed`와 `payout_status='pending'`인지
5. payout 실행 후 host earnings spot check 1회

## 테스트 근거
- 현재 운영 계약을 닫는 기준 스펙
  - `tests/e2e/57-guest-trips-sync-completed.spec.ts`
  - `tests/e2e/155-admin-settlement-sync-status.spec.ts`
  - `tests/e2e/156-admin-settlement-sync-manual-trigger.spec.ts`
  - `tests/e2e/157-settlement-sync-race-guard.spec.ts`
  - `tests/e2e/158-settlement-sync-fail-closed.spec.ts`
  - `tests/e2e/130-admin-settle-host-payout-guard.spec.ts`
  - `tests/e2e/133-host-payout-summary-reflection.spec.ts`

## Close-out
- 체험 예약 정산 체인에서 운영자가 실제로 컨트롤할 수 있는 핵심 경계는 `Settlement Sync Health`와 `payout queue`다.
- 이 runbook의 기본 원칙은 단순하다.
  - 먼저 `completed sync`가 정상인지 확인
  - 그 다음에만 payout 실행
  - `running_stale`, `failed`, `503`이면 정산을 멈추고 sync부터 복구
