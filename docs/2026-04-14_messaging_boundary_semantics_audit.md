# 메시징 Boundary Semantics Close-out

## Summary
- 이번 close-out의 owner는 메시징 코어 전체가 아니라 아래 boundary 3건이다.
  - `admin_initiated_support` thread reuse semantics
  - `service_request_id` capability fallback
  - `proxy linked inquiry bridge`
- 기준 owner는 `app/api/inquiries/thread/shared.ts`이며, caller는 `/api/inquiries/thread`, `/api/services/start-chat`, `DetailsPanel`, `/api/proxy-bookings/[id]/comments`까지 역추적했다.
- latest 재확인 기준 결론은 아래와 같다.
  - `admin_initiated_support`: active current contract
  - `service_request_id` fallback: intentional compatibility
  - `proxy linked inquiry bridge`: active current contract
- 이번 패스의 실제 코드 수정은 1건뿐이다.
  - `openOnly` admin support 시작이 resolved old thread를 재사용하지 않도록 fail-closed 재사용 조건을 좁혔다.

## Runtime Snapshot
- `inquiries.service_request_id` select probe: `supported`
- `proxy_requests` live probe
  - checked rows: `2`
  - `linked_inquiry_id` missing rows: `0`
- 최근 `admin_support/admin` inquiry runtime sample에는 `resolved` row와 legacy `status=null` row가 함께 존재했다.
- 따라서 이번 패스의 핵심 risk는 “proxy나 service가 아직 legacy인지”가 아니라, `admin_initiated_support openOnly`가 historical resolved thread를 다시 열 수 있느냐였다.

## Boundary Matrix
| Boundary | Current source of truth | Verdict | Current meaning |
| --- | --- | --- | --- |
| `admin_initiated_support` | `resolveAdminInitiatedSupportThread()` + `DetailsPanel` | active current contract | `openOnly` caller는 `resolved`가 아닌 가장 최근 support thread만 재사용하고, 없으면 새 admin support thread를 만든다 |
| `service_request_id` scoped inquiry | `resolveServiceRequestThread()` | intentional compatibility | current runtime은 `service_request_id` scoped lookup을 지원하고, legacy fallback은 schema capability 미지원 환경용 호환 분기로만 남아 있다 |
| `proxy linked inquiry bridge` | `/api/proxy-bookings/[id]/comments`, `getProxyLinkedInquiryId()` | active current contract | tracked create path는 `linked_inquiry_id`를 항상 심고, route read/write는 linked inquiry가 없으면 `409`로 fail-closed 한다 |

## Confirmed Findings
### 1. `admin_initiated_support`는 이제 `openOnly` 의미가 더 분명하다
- 실제 caller인 `DetailsPanel`은 `contextType='admin_initiated_support'`와 `openOnly: true`를 함께 보낸다.
- 기존 resolver는 guest 기준 최신 `admin_support/admin` thread 1건을 status와 무관하게 재사용했다.
- 이 상태에서는 가장 최근 thread가 `resolved`여도 새 CS 시작이 과거 resolved room으로 다시 들어갈 수 있었다.
- 이번 패스에서 resolver 재사용 범위를 아래로 좁혔다.
  - `status IS NULL`
  - `status='open'`
  - `status='in_progress'`
- 따라서 current openOnly contract는 “열려 있는 support room reuse, 없으면 새 room 생성”으로 잠겼다.

### 2. `service_request_id` scoped thread는 current runtime에서 active contract다
- runtime probe 기준 현재 환경은 `inquiries.service_request_id` 컬럼을 정상 지원한다.
- `resolveServiceRequestThread()`는 current runtime에서 `(guest, host, service_request_id)` 기준 thread를 찾고, inquiry insert에도 `service_request_id`를 저장한다.
- 따라서 현재 운영 의미는 “같은 guest-host라도 request별 thread 분리”가 맞다.
- legacy fallback은 current runtime의 source of truth가 아니라, schema capability 미지원 환경을 위한 compatibility branch로 보는 것이 가장 정확하다.

### 3. `proxy linked inquiry bridge`는 boundary gap이 아니라 active contract에 가깝다
- 최신 proxy audit와 runtime probe를 함께 보면 tracked create path는 새 요청 생성 시 `linked_inquiry_id`를 같이 저장한다.
- `/api/proxy-bookings/[id]/comments`는 linked inquiry가 없으면 `409`로 바로 fail-closed 한다.
- live probe 기준 `linked_inquiry_id` 누락 row는 현재 `0`건이었다.
- 따라서 proxy는 더 이상 “조건부 bridge가 남아 있는 불안정 seam”보다 “inquiry 엔진 고정 재사용 + missing link fail-closed” 쪽으로 보는 게 맞다.

## Test Lock
- 기존 core rerun owner
  - `53-chat-optimistic-send`
  - `41-inquiry-read-route`
  - `60-inquiry-thread-contract`
  - `14-admin-chats`
  - `83-chat-policy-monitoring`
  - `95-guest-inbox-empty-state`
  - `124-inquiry-email-localization`
  - `161-admin-support-unread-alerts`
  - `164-guest-inbox-support-profile-context`
- 이번 패스 추가 owner
  - `185-messaging-boundary-contract`
    - resolved admin support thread is not reused by `admin_initiated_support openOnly`
    - `service_request` chat is scoped by request id when `service_request_id` is available
    - proxy comments fail closed with `409` when linked inquiry is missing

## Final Verdict
- `admin_initiated_support`는 이번 패스에서 boundary-only gap에서 active current contract로 올라갔다.
- `service_request_id` fallback은 current runtime 기준 active contract가 아니라 intentional compatibility로 분류하는 것이 맞다.
- `proxy linked inquiry bridge`는 current runtime과 proxy audit 기준 active current contract로 보는 것이 타당하다.
- 따라서 메시징 도메인의 남은 follow-up은 “core chain 불안정”이 아니라, 앞으로 fallback 제거 시점을 언제 operationally 잠글지의 문제로 좁혀졌다.
