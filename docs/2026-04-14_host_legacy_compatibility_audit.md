# Host Legacy Compatibility Close-out

## Summary
- 이번 close-out의 owner는 `/api/host/register/admin-alert` 단독이 아니라, `host register tracked submit path`와 legacy shim의 경계를 잠그는 것이다.
- current source of truth는 `POST /api/host/register/submit`이다.
- repo tracked caller 기준 `/api/host/register/admin-alert`의 직접 소비자는 현재 확인되지 않았다.
- latest 결론은 아래와 같다.
  - `submit` route: active current contract
  - `admin-alert` route: dormant but intentional compatibility
  - 최종 제거 여부: external evidence 없이는 아직 잠그지 않음

## Consumer Snapshot
| Surface | Current owner | Verdict | Notes |
| --- | --- | --- | --- |
| host register submit | `app/host/register/components/HostRegisterForm.tsx` → `/api/host/register/submit` | active current contract | tracked UI submit은 단일 submit route만 호출한다 |
| host register admin alert | `/api/host/register/admin-alert` | dormant but intentional compatibility | stale client 호환용 route 주석이 명시돼 있고 repo tracked caller는 보이지 않는다 |
| admin approval write | `app/actions/admin.ts`, admin approvals consumers | active current contract | 승인/보완/거절의 실제 status write owner는 admin action chain이다 |

## Confirmed Findings
### 1. current submit source of truth는 이미 단일화돼 있다
- `HostRegisterForm`의 tracked submit path는 `POST /api/host/register/submit`뿐이다.
- submit route는 아래를 한 체인으로 처리한다.
  - 최신 application row 조회
  - approved 재제출 fail-closed
  - 신규 insert 또는 same-row update
  - profile seed update
  - 필요한 경우 admin alert insert
- 따라서 current product path 기준으로는 host register 저장과 admin alert 생성 owner가 이미 submit route로 수렴했다.

### 2. `/api/host/register/admin-alert`는 orphan가 아니라 compatibility shim 해석이 더 강하다
- route 상단 주석은 이미 이 endpoint를 `Legacy compatibility route`로 명시한다.
- repo tracked app/tests에서 `/api/host/register/admin-alert` 호출자는 현재 확인되지 않는다.
- 기존 host flow audit와 현재 repo search를 합치면, 이 route는 “현재 제품 경로 owner”가 아니라 “stale external client가 남아 있을 수 있어 보존 중인 shim”에 가깝다.

### 3. 지금 단계에서는 removal candidate로 바로 내리기보다 external-evidence-needed가 맞다
- 이 route는 현재 `pending` application에 대해 unconditional admin alert insert를 시도한다.
- 즉 외부 stale client가 실제로 아직 호출 중이라면 중복 alert 가능성은 남아 있다.
- 반대로 repo 내부 evidence만 보면 current UI/테스트 경로에서는 더 이상 사용하지 않는다.
- 따라서 현재 가장 정확한 분류는 아래 조합이다.
  - repo 내부 기준: dormant but intentional compatibility
  - 최종 제거 판단 기준: external evidence needed

## Git / Repo Evidence
- repo search 기준 `/api/host/register/admin-alert`의 current caller는 문서 외에는 확인되지 않았다.
- git history 기준 해석
  - `dcd466a2`에서 host register write가 submit route 중심으로 serverize됐다
  - `9f7e70e0`에서 admin-alert route가 legacy route임을 더 분명히 적었다
- 따라서 지금 남은 질문은 “왜 남아 있나?”가 아니라 “외부 stale caller가 아직 있나?”에 가깝다.

## Test Lock
- current submit / approval chain 재확인 owner
  - `36-host-register-submit`
  - `97-host-register-visibility`
  - `98-host-approved-welcome-overlay`
  - `140-host-status-refresh-after-approval`
  - `141-host-landing-cta-refresh-after-approval`
  - `164-admin-host-approval-happy-path`
  - `167-host-register-revision-resubmit-ui`
- 이번 배치에서 새 route contract spec은 추가하지 않는다.
  - 이유: current gap은 repo 내부 product contract가 아니라 external stale client evidence 부재이기 때문이다.

## Final Verdict
- `app/api/host/register/admin-alert/route.ts`는 현재 repo 기준으로 active owner가 아니다.
- 하지만 git history와 route 주석, 기존 host audit를 함께 보면 accidental dead code보다 intentional compatibility shim 해석이 더 타당하다.
- 따라서 이번 close-out 기준 분류는 아래로 고정한다.
  - `submit route`: active current contract
  - `admin-alert route`: dormant but intentional compatibility
  - `removal decision`: external evidence needed
