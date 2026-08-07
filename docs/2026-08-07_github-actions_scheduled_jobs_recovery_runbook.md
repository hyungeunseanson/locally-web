# GitHub Actions scheduled job 장애 복구 runbook

## 목적

GitHub 호스티드 러너 장애로 예약 workflow가 실행 단계에 들어가지 못했을 때, 애플리케이션 오류와 외부 인프라 장애를 구분하고 중복 실행 없이 안전하게 복구한다.

대상 workflow:

- `Cancel Pending Bookings`
- `Admin Support Unread Alerts`
- `Experience Completion Sync`

이 작업들은 한 회차의 이벤트만 처리하지 않는다. 실행 시점에 이미 기한이 지난 전체 대상을 다시 조회하므로, GitHub Actions가 복구된 뒤 다음 정상 실행이 누락 회차를 따라잡는다.

## 2026-08-07 기준 사례

2026-08-07 01:24~03:04 KST에 발생한 세 실패는 동일한 GitHub Actions 인프라 장애였다.

- job의 `runner_name`이 비어 있었다.
- job의 `steps`가 빈 배열이었다.
- check annotation은 `The job was not acquired by Runner of type hosted even after multiple attempts`였다.
- 세 실행 모두 GitHub가 공지한 Actions 장애 시간(2026-08-07 00:22~11:04 KST) 안에 있었다.
- 애플리케이션과 workflow 변경 없이 동일 커밋의 후속 예약 실행이 모두 성공했다.

공식 장애 기록: <https://stspg.io/rcz3fcm83sff>

이 조합이면 코드, `PROD_URL`, `CRON_SECRET`, endpoint 또는 DB 오류로 분류하지 않는다. 해당 값과 코드는 러너가 배정된 다음 step에서야 평가되기 때문이다.

## 판별 순서

1. 실패한 workflow run의 job 화면과 annotation을 확인한다.
2. step이 하나라도 시작됐는지 확인한다.
   - `steps: []`이고 runner가 비어 있으면 러너 배정 실패 후보이다.
   - secret 검증이나 `curl` step이 시작됐다면 이 runbook이 아니라 해당 step의 오류를 조사한다.
3. annotation에 hosted runner 미배정 또는 queue timeout 메시지가 있는지 확인한다.
4. <https://www.githubstatus.com/>에서 같은 시간대의 Actions 장애를 확인한다.
5. 같은 커밋의 직전 성공과 후속 예약 실행을 비교한다.
6. 후속 실행이 성공했다면 아래 backlog 확인을 수행한다.

## backlog 확인

### Cancel Pending Bookings

- 현재 시각 기준 2시간을 넘겼고 `PENDING`, `tid IS NULL`인 처리 가능 예약이 남았는지 확인한다.
- 승인된 카드 결제(`tid` 존재)와 이미 정상 취소된 예약은 backlog로 세지 않는다.
- 다음 정상 실행 후 처리 가능한 오래된 예약이 없다면 복구 완료이다.

### Admin Support Unread Alerts

- 활성 상태이면서 `alert_due_at <= now()`인 batch가 처리되지 않은 채 남았는지 확인한다.
- 오래된 `processing_started_at`은 다음 worker가 회수할 수 있으므로, 먼저 다음 정상 실행 결과를 확인한다.
- 같은 unread wave에 `admin_alert` 또는 팀 메일이 중복 생성되지 않았는지 확인한다.

### Experience Completion Sync

- 완료 시각이 지났지만 여전히 active 상태인 체험 예약이 남았는지 확인한다.
- `admin_job_runs`에서 `experience_completion_sync`의 최근 `last_success_at`, 상태, 처리 건수를 확인한다.
- 완료 예약별 review-request 등 keyed side effect가 중복되지 않았는지 확인한다.

## 수동 복구 결정

다음 조건을 모두 만족할 때만 GitHub Actions의 `Run workflow`로 해당 workflow를 **한 번만** 실행한다.

1. GitHub Actions 장애가 복구됐다.
2. 다음 예약 실행이 아직 오지 않았거나 후속 실행 뒤에도 실제 backlog가 남아 있다.
3. 현재 같은 concurrency group의 running/pending 실행이 없다.
4. 실행 전 backlog 수와 확인 시각을 기록했다.

수동 실행 후 endpoint가 2xx인지 확인하고, backlog 수와 중복 부작용을 다시 확인한다. 과거 실패 run 여러 개를 일괄 재실행하거나 연속으로 `Run workflow`를 누르지 않는다.

## 완료 기준

- 세 workflow의 최신 예약 실행이 성공한다.
- 각 endpoint가 2xx를 반환한다.
- 처리 가능한 overdue backlog가 남지 않는다.
- 동일 예약, unread batch 또는 review-request에 중복 부작용이 없다.

외부 장애 중 정시 실행을 보장하기 위한 이중 스케줄러나 자체 러너는 이 대응 범위에 포함하지 않는다. 현재 정책은 복구 후 다음 실행의 안전한 catch-up을 우선한다.
