# 메시징·문의 체인 엔드투엔드 구조 점검

## Summary
- 감사 범위: `guest inbox ↔ host inquiry chat ↔ admin support monitor`, 그리고 이를 잇는 `thread/message/read` 공통 코어와 `service/proxy/host start-chat` boundary
- 제외 범위: `서비스 의뢰 상태 머신`, `proxy 결제/정산`, `리뷰 reply`, `커뮤니티 댓글`, live mutation 재실행
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E close-out 재실행
- latest run
  - `18 passed (1.4m)`
  - close-out rerun bundle
    - `tests/e2e/53-chat-optimistic-send.spec.ts`
    - `tests/e2e/41-inquiry-read-route.spec.ts`
    - `tests/e2e/60-inquiry-thread-contract.spec.ts`
    - `tests/e2e/124-inquiry-email-localization.spec.ts`
    - `tests/e2e/14-admin-chats.spec.ts`
    - `tests/e2e/161-admin-support-unread-alerts.spec.ts`
    - `tests/e2e/83-chat-policy-monitoring.spec.ts`
    - `tests/e2e/164-guest-inbox-support-profile-context.spec.ts`
    - `tests/e2e/95-guest-inbox-empty-state.spec.ts`
- previous targeted rerun after realtime catch-up patch
  - `tests/e2e/53-chat-optimistic-send.spec.ts`
  - `tests/e2e/41-inquiry-read-route.spec.ts`
  - `tests/e2e/60-inquiry-thread-contract.spec.ts`
  - `tests/e2e/164-guest-inbox-support-profile-context.spec.ts`
  - result: `8 passed`
- 이번 재감사 기준 핵심 해석
  - 3월 감사에서 컸던 `문의 생성 경로 분산`은 tracked caller 기준으로 상당 부분 해소됐다
  - `guest ↔ host realtime reply`, `policy signal`, `guest/host/admin deep link`, `localized inquiry email`은 현재 기준 정상이다
  - 기존 active risk였던 `admin support unread alert`의 read 후 재기동(re-arm) 체인도 최신 close-out rerun 기준으로 green 복구됐다
  - 이번 close-out 이후 남는 것은 core failure가 아니라 low-risk boundary semantics 두 건이다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| Thread creation / first message | `app/api/inquiries/thread/shared.ts`, `/api/inquiries/thread` | `60`, `124`, `161`, `164` | 정상 | guest help, host start-chat, service start-chat, admin initiated support가 tracked path 기준 공통 thread upsert를 사용 |
| Guest ↔ host message send/read | `app/hooks/useChat.ts`, `/api/inquiries/message`, `/api/inquiries/read`, `/guest/inbox`, `host/dashboard/InquiryChat.tsx` | `41`, `53`, `95`, `164`, rerun `53` | 정상 | optimistic send, read contract, host reply realtime receive가 latest targeted rerun에서 모두 green |
| Admin support / monitor | `/api/admin/inquiries*`, `useAdminChatQuery`, `ChatMonitor`, `/api/admin/sidebar-counts` | `14`, `161`, `83` | 정상 | status 변경, policy monitoring, participant card, unread re-arm close-out rerun까지 현재 green |
| Notification / email / policy signal | `thread/shared.ts: notifyRecipient`, `InquiryNewMessageEmail`, `emitChatPolicySignal` | `124`, `83`, `161` | 정상 | inquiry new_message email, policy alert, admin support unread alert + team email의 second dispatch까지 green 복구 |
| Boundary entrypoints | `/api/host/start-chat`, `/api/services/start-chat`, `proxy-bookings/[id]/comments` | `60` + static audit | 부분 보장 | host/service는 공통 thread upsert로 정리됐고, proxy는 linked inquiry가 있을 때만 공통 message path를 재사용 |

## Confirmed Findings
### 1. 문의 생성 경로는 tracked caller 기준으로 공통 API로 수렴했다
- 현재 tracked 진입점은 대부분 `/api/inquiries/thread` 또는 `upsertInquiryThread()`를 사용한다.
  - `app/help/page.tsx`
  - `app/admin/dashboard/components/DetailsPanel.tsx`
  - `app/services/[requestId]/ServiceRequestClient.tsx`
  - `app/hooks/useChat.ts`
  - `app/api/host/start-chat/route.ts`
  - `app/api/services/start-chat/route.ts`
- 따라서 3월 감사의 핵심 finding이었던 “화면별 direct insert 분산”은 최신 tracked app 기준으로는 더 이상 주 경로가 아니다.
- `60-inquiry-thread-contract`도 `redirectUrl + inquiryId + createdMessage` fast-path contract를 현재 기준으로 보장한다.

### 2. 서비스 매칭 채팅은 예전보다 정리됐지만 schema capability fallback이 남아 있다
- `resolveServiceRequestThread()`는 `service_request_id` 컬럼 사용 가능 여부를 먼저 확인하고, 가능하면 `(guest, host, service_request_id)` 기준으로 thread를 찾는다.
- 즉 3월 감사의 “서비스 채팅이 guest-host 단위로만 뭉친다” 문제는 최신 코드상 완화됐다.
- 다만 schema capability check 실패 시에는 여전히 legacy fallback(`experience_id IS NULL`)을 탄다.
- 현재 저장소 기준으로는 이 fallback이 실제 운영에서 아직 필요한지, 아니면 완전히 제거 가능한지는 이번 감사 범위에서 닫히지 않았다.

### 3. guest inbox realtime host reply는 이제 latest 기준으로 정상이다
- 이전 persistent failure였던 `tests/e2e/53-chat-optimistic-send.spec.ts`의 `guest inbox shows a host reply without reloading the page`는 현재 재현되지 않았다.
- 현재 확인된 사실
  - host reply row는 DB에 정상 insert된다
  - guest inbox는 reload 없이 같은 thread bubble을 렌더링한다
  - 관련 targeted rerun(`53`, `41`, `60`, `164`)은 모두 green이었다
- 최신 해석으로는 이 이슈는 `useChat` client catch-up 보강으로 닫힌 상태다

### 4. inquiry message side effect는 예전보다 fail-soft해졌다
- `createInquiryMessage()`는 message insert와 inquiry preview update까지는 동기 처리하지만, email dispatch는 `notifyRecipient()` 내부에서 `void sendTemplatedEmail(...)`로 fire-and-forget 처리한다.
- 따라서 3월 감사 당시의 “메시지 send path가 email 시도까지 같은 요청 안에서 돈다”는 해석은 최신 inquiry message 경로에는 그대로 적용되지 않는다.
- 현재 구조에서 메시지 truth는 DB write이고, email은 best-effort side effect로 분리되어 있다.

### 5. admin support unread alert 재기동(re-arm) 경로는 latest 기준으로 닫혔다
- 근거 스펙: `tests/e2e/161-admin-support-unread-alerts.spec.ts`
- 이번 close-out rerun 기준 확인된 사실
  - 첫 unread wave alert/in-app/email dispatch가 정상 동작한다
  - admin이 thread를 읽으면 batch가 inactive로 내려간다
  - 새 unread wave가 오면 batch가 다시 active로 올라가고, sent markers도 새 wave 기준으로 재무장된다
  - 이후 cron 재실행 시 admin alert/email 총량이 두 번째 라운드만큼 다시 증가한다
- 현재 해석
  - unread alert의 제품 의미는 `문의방 전체 1회`가 아니라 `read로 끊기는 unread wave당 1회`로 보는 것이 맞다
  - `app/utils/adminSupportUnreadAlerts.ts`는 최신 코드 기준으로 이 계약을 다시 만족한다

## Static Risk Notes
- `admin_initiated_support` 재사용 기준은 여전히 가장 최근 `admin_support/admin` thread 1건을 고른다
  - `resolveAdminInitiatedSupportThread()`는 `resolved 여부`, `담당 admin`, `open thread only`를 따로 거르지 않는다
  - 현재 tracked caller는 통일됐지만, 어떤 admin support thread를 재사용할지의 운영 semantics는 여전히 느슨하다
  - 이번 재실행 묶음에는 이 branch를 resolved thread 재사용 관점에서 직접 잠그는 스펙은 없었다
- `proxy-bookings/[id]/comments`는 linked inquiry가 있을 때만 `createInquiryMessage()`를 재사용한다
  - linked inquiry가 없으면 여전히 `proxy_comments` 별도 저장 경로를 탄다
  - 즉 proxy boundary는 완전 통일이 아니라 조건부 브리지 상태다

## Coverage Gaps
- live mutation coverage는 이번 감사에서 재실행하지 않았다
  - `tests/e2e/05-live-guest-booking-messaging-support.spec.ts`
- boundary reference는 full rerun하지 않았다
  - `tests/e2e/16-admin-team-chat.spec.ts`
- `admin_initiated_support`의 “resolved old thread 재사용 여부”는 정적 구조상 리스크를 확인했지만, dedicated regression spec으로 닫히지 않았다
- `service_request_id` fallback legacy branch는 static audit로는 파악했지만, production schema capability까지 이번 문서에서 단정하진 않는다
- `proxy-bookings/[id]/comments`의 linked inquiry 미존재 legacy branch도 이번 close-out에서는 boundary-only로만 확인했다

## Follow-up Need
- 1순위
  - `admin_initiated_support` thread reuse semantics를 `resolved 제외` 또는 `openOnly stricter reuse` 기준으로 잠글지 결정해야 한다
- 2순위
  - schema가 충분히 정리됐다면 `service_request_id` capability fallback을 언제 걷어낼지 운영 기준을 정할 필요가 있다
- 3순위
  - `proxy` linked inquiry 브리지가 완전 통일로 갈지, 현행 조건부 bridge를 유지할지 별도 운영 판단이 필요하다

## Final Verdict
- 메시징/문의 도메인은 최신 tracked caller 기준으로 3월보다 구조가 훨씬 정리됐다
- guest ↔ host realtime reply는 현재 기준 정상으로 회복됐다
- `admin support unread alert`의 `read 후 새 unread batch 재기동 → 두 번째 dispatch` 계약도 latest close-out rerun에서 green으로 복구됐다
- 따라서 이번 close-out 기준 최종 판정은 `메시징 core chain은 정상`이다
- 다만 `admin_initiated_support` 재사용 semantics, `service_request_id` legacy fallback, `proxy` 조건부 bridge는 여전히 boundary-only gap으로 남아 있다
