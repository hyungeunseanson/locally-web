# 체험 예약 정산 Day-of 체크리스트

## 목적
- 이 문서는 `체험 예약 정산 실행 당일`에 운영자가 빠르게 pass/fail을 판단하기 위한 1장짜리 체크리스트다.
- 이번 release close-out에서는 정산 로직 변경보다 이 체크리스트 준수를 우선한다.
- 긴 설명과 incident 대응은 아래 문서를 본다.
  - [experience settlement sync 운영 runbook](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_experience_settlement_sync_runbook.md:1)
  - [experience settlement chain audit](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_experience_settlement_chain_e2e_audit.md:1)

## 시작 전 원칙
- 먼저 `Settlement Sync`를 확인하고, 그 다음에만 payout을 실행한다.
- 실제 day-of 순서는 `체험 카드 -> operator banner -> 상단 정산 가드 -> payout queue 대상 확인 -> payout 실행 -> host earnings spot check`으로 고정한다.
- 아래 중 하나라도 보이면 정산 실행을 멈춘다.
  - `running_stale`
  - `failed`
  - `503 infra banner`
- `ReservationManager`의 `지난 일정`은 일정 기준이다.
- 실제 정산 대상은 `bookings.status='completed'` 이고 `payout_status='pending'` 인 건만이다.

## 실제 점검 순서
1. `Admin > Sales > Settlement Sync Health`로 들어간다.
2. `체험 카드`, `operator banner`, 상단 `정산 가드`를 같이 본다.
3. 아래 6개를 확인한다.
   - `health_state`
   - `operator banner` 문구
   - 상단 가드 문구
   - `due count`
   - `last success`
   - `infra banner`
4. 아래 조건이면 통과다.
   - `health_state='healthy'`
   - `operator banner`가 `목록 반영 정상` 또는 같은 의미의 진행 가능 안내
   - 상단 가드가 `정산 진행 가능` 또는 같은 의미의 안전 안내
   - `running_stale=false`
   - `503 infra banner` 없음
   - `due count`가 `0`이거나 설명 가능하게 낮다
5. 통과면 `payout queue`로 넘어간다.
6. 정산 대상 host를 열고 아래를 확인한다.
   - 대상 booking이 `completed`
   - `payout_status='pending'`
7. 그 다음에만 payout 실행
8. 실행 후 아래를 spot check 한다.
   - `payout queue` pending 감소
   - host earnings의 pending 감소
   - host earnings의 paid 증가
   - `latest_paid_at` 갱신

## 상태별 즉시 행동
- `healthy`
  - sync 쪽 추가 작업 없이 payout queue 확인으로 이동
- `delayed`
  - `지연 건 지금 실행(run due)` 1회
  - 새로고침 후 `due count` 감소 확인
  - 줄지 않으면 payout 보류
- `running`
  - 기다림
  - 중복 실행 금지
- `running_stale`
  - payout 중단
  - runbook incident 절차로 이동
- `failed`
  - payout 중단
  - `last_failure_message` 확인 후 runbook 절차로 이동
- `503`
  - payout 중단
  - infra 복구 전까지 실행 금지

## 아무것도 안 해도 되는 조건
- 아래면 sync는 건드리지 않는다.
  - `healthy`
  - `operator banner`가 `목록 반영 정상` 또는 같은 의미의 진행 가능 안내를 보여준다
  - 상단 `정산 가드`가 `정산 진행 가능` 또는 같은 의미의 안전 안내를 보여준다
  - `due count=0` 또는 설명 가능
  - `last success` 정상
  - `running_stale`, `failed`, `503` 없음
- 이 경우 운영자는 payout 대상 확인과 실행만 하면 된다.

## 기록할 것
- 점검 시각
- 체험 카드 상태
- `due count`
- payout 실행 여부
- 이상 시 `last_failure_message` 또는 `infra banner` 유무

## 판정
- `Go`
  - sync 정상
  - payout queue 대상 확인 완료
  - payout 실행 가능
- `Hold`
  - sync 상태가 `delayed`, `running_stale`, `failed`, `503`
  - 또는 대상 booking이 아직 `completed`가 아님
