# 메시징·문의 체인 엔드투엔드 구조 점검

## Summary
- 감사 범위: `guest inbox ↔ host inquiry chat ↔ admin support monitor`, 그리고 이를 잇는 `thread/message/read` 공통 코어와 `service/proxy/host start-chat` boundary
- 제외 범위: `서비스 의뢰 상태 머신`, `proxy 결제/정산`, `리뷰 reply`, `커뮤니티 댓글`, live mutation 재실행
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행 + persistent failure 재재현
- latest run
  - `17 passed / 1 failed`
  - persistent failure: `tests/e2e/53-chat-optimistic-send.spec.ts`의 `guest inbox shows a host reply without reloading the page`
- 이번 재감사 기준 핵심 해석
  - 3월 감사에서 컸던 `문의 생성 경로 분산`은 tracked caller 기준으로 상당 부분 해소됐다
  - `admin support unread alert`, `policy signal`, `guest/host/admin deep link`, `localized inquiry email`은 현재 기준 정상이다
  - 다만 `host → guest reply`가 guest inbox에 실시간으로 반영되는 계약은 현재 persistent failure가 있어 최신 판정은 `부분 보장`이다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| Thread creation / first message | `app/api/inquiries/thread/shared.ts`, `/api/inquiries/thread` | `60`, `124`, `161`, `164` | 정상 | guest help, host start-chat, service start-chat, admin initiated support가 tracked path 기준 공통 thread upsert를 사용 |
| Guest ↔ host message send/read | `app/hooks/useChat.ts`, `/api/inquiries/message`, `/api/inquiries/read`, `/guest/inbox`, `host/dashboard/InquiryChat.tsx` | `41`, `53`, `95`, `164`, rerun `53` | 부분 보장 | optimistic send와 read contract는 정상이나, host reply realtime receive는 guest inbox에서 persistent fail |
| Admin support / monitor | `/api/admin/inquiries*`, `useAdminChatQuery`, `ChatMonitor`, `/api/admin/sidebar-counts` | `14`, `161`, `83` | 정상 | status 변경, unread alert batch, policy monitoring, participant card 모두 latest run green |
| Notification / email / policy signal | `thread/shared.ts: notifyRecipient`, `InquiryNewMessageEmail`, `emitChatPolicySignal` | `124`, `83`, `161` | 정상 | inquiry new_message notification + localized email + policy admin alert 경로가 current implementation과 일치 |
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

### 3. admin support 운영 체인은 현재 기준으로 가장 안정적인 편이다
- `14-admin-chats`, `161-admin-support-unread-alerts`, `83-chat-policy-monitoring`이 모두 latest run green이었다.
- 확인된 현재 truth
  - `/api/admin/inquiries`가 admin monitor 목록 source of truth다
  - `/api/admin/inquiries/[id]/messages`는 admin support thread 열람 시 read + unread batch clear를 함께 처리한다
  - `/api/admin/inquiries/[id]/status`는 optimistic locking token(`updated_at`)을 받아 false conflict를 방지한다
  - guest가 admin support thread에 메시지를 남기면 unread batch / admin alert / team email이 current contract대로 이어진다

### 4. inquiry message side effect는 예전보다 fail-soft해졌다
- `createInquiryMessage()`는 message insert와 inquiry preview update까지는 동기 처리하지만, email dispatch는 `notifyRecipient()` 내부에서 `void sendTemplatedEmail(...)`로 fire-and-forget 처리한다.
- 따라서 3월 감사 당시의 “메시지 send path가 email 시도까지 같은 요청 안에서 돈다”는 해석은 최신 inquiry message 경로에는 그대로 적용되지 않는다.
- 현재 구조에서 메시지 truth는 DB write이고, email은 best-effort side effect로 분리되어 있다.

### 5. guest inbox realtime host reply는 현재 active risk다
- 실패 스펙: `tests/e2e/53-chat-optimistic-send.spec.ts`
- 동일 failure를 감사 묶음 전체 실행과 단일 재실행에서 모두 재현했다.
- 확인된 사실
  - host reply row 자체는 DB에 정상 insert된다
  - 그러나 guest inbox는 reload 없이 해당 reply bubble을 timeout 안에 렌더링하지 못한다
- 따라서 현재 결함의 성격은 `message write contract`가 아니라 `guest inbox realtime receive/catch-up contract`다.
- 정적 코드상 관련 source는 `app/hooks/useChat.ts`의 realtime `inquiry_messages INSERT/UPDATE` 구독과 `scheduleRealtimeMessageRefresh()` 경로다.
- 이 finding은 더 이상 단순 test flake로 보기 어렵고, 최신 active risk로 기록하는 편이 맞다.

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

## Follow-up Need
- 1순위
  - `guest inbox realtime host reply` persistent failure를 product/test combined issue가 아니라 `active messaging risk`로 분리해 핀셋 수정 계획을 세우는 것이 맞다
  - 수정 범위는 `useChat` guest realtime receive/catch-up path 중심으로 좁히는 편이 안전하다
- 2순위
  - `admin_initiated_support` thread reuse semantics를 `resolved 제외` 또는 `openOnly stricter reuse` 기준으로 잠글지 결정해야 한다
- 3순위
  - schema가 충분히 정리됐다면 `service_request_id` capability fallback을 언제 걷어낼지 운영 기준을 정할 필요가 있다

## Final Verdict
- 메시징/문의 도메인은 최신 tracked caller 기준으로 3월보다 구조가 훨씬 정리됐다
- thread creation, admin support unread, policy monitoring, inquiry notification/email는 현재 기준 `정상`
- 그러나 guest inbox가 host reply를 reload 없이 반영해야 하는 핵심 UX 계약은 latest rerun에서 지속적으로 실패했다
- 따라서 이번 재감사의 최종 판정은 `메시징 도메인 전반은 대체로 안정적이지만, guest realtime receive chain에 active risk 1건이 남아 있어 전체로는 부분 보장`이다
