# 관리자 대시보드 팀 워크스페이스 심층 현황 보고서 (2026-03-05 기준)

## 요약
- 사용 스킬: 없음 (`skill-creator`, `skill-installer`는 이번 요청 범위와 무관).
- 실제 DB 데이터 기준으로 **댓글 중복은 재현/관측됨**. 3초 이내 동일 작성자·동일 내용 중복 4건이 모두 TODO 댓글에서 발생.
- 체감 성능 저하는 단일 원인보다, `admin_task_comments`를 팀할일/팀채팅이 함께 쓰는 구조 + 과도한 Realtime 후속 쿼리 + 사이드바 무거운 카운트 API 호출이 겹친 결과.
- 팀채팅 자체 중복 삽입 징후는 약함(중복 4건 모두 TODO). 대신 읽음 처리 UPDATE 폭주가 다른 영역(TeamTab)에 부하를 전파.

## 구현 진행 현황 (2026-03-05)
- ✅ TeamTab: 댓글 전송 `task_id` 단위 in-flight 락 + IME Enter 가드 + `client_nonce` 삽입 반영.
- ✅ TeamTab: `admin_task_comments` Realtime 구독을 `INSERT/DELETE` + 현재 task_id 필터 + 200ms 디바운스 재조회로 축소.
- ✅ GlobalTeamChat: 읽음 처리 루프 UPDATE 제거, `mark_room_messages_read` RPC 1회 호출로 전환.
- ✅ Sidebar: 팀 카운트 경량 endpoint(`/api/admin/team-counts`) 분리, 전체 카운트는 별도 호출/주기 갱신으로 분리.
- ✅ Admin Dashboard: `TEAM/CHATS/SERVICE_REQUESTS` 탭에서 `useAdminData()` 선로딩 제거(탭별 lazy 분리).
- ✅ SQL 추가: `docs/migrations/v3_29_0_team_workspace_stability.sql` ( `client_nonce` + unique index + RPC ).

## 조사 범위 및 근거
- 프론트 핵심 코드:
  - [TeamTab.tsx:102](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:102)
  - [TeamTab.tsx:161](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:161)
  - [TeamTab.tsx:496](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:496)
  - [GlobalTeamChat.tsx:77](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/GlobalTeamChat.tsx:77)
  - [GlobalTeamChat.tsx:169](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/GlobalTeamChat.tsx:169)
  - [Sidebar.tsx:114](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/Sidebar.tsx:114)
  - [sidebar-counts API:30](/Users/sonhyungeun/Documents/locally-web/app/api/admin/sidebar-counts/route.ts:30)
  - [admin page:43](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/page.tsx:43)
  - [useAdminData.ts:101](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/hooks/useAdminData.ts:101)
- 실데이터 집계(읽기 전용):
  - `admin_tasks`: 27건 (`DAILY_LOG` 11, `TODO` 11, `MEMO` 5)
  - `admin_task_comments`: 122건 (`CHAT_ROOM` 87, `TODO` 31, `MEMO` 4)
  - 3초 이내 동일 작성자/동일 내용 중복: 4건, 전부 `TODO`
  - 샘플 중복 시간차: 1ms, 2ms, 11ms, 18ms (사람의 재입력보다 호출 중복 패턴에 가까움)

## 핵심 이슈 (심각도 순)
1. **S1 댓글 2중 등록(실제 DB 중복 존재)**
- 근거: TODO 댓글에서 동일 author/content가 1~18ms 간격으로 2회 insert.
- 코드상 위험 지점: TODO 댓글 전송에 in-flight 락/중복방지 키/버튼 disable 없음 ([TeamTab.tsx:161](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:161), [TeamTab.tsx:496](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:496)).
- 추정 원인: 키 입력/클릭 중복 이벤트 또는 클라이언트 이중 호출을 DB가 그대로 수용.

2. **S1 팀채팅 읽음 처리 UPDATE가 TeamTab 성능에 간접 타격**
- `markMessagesRead`가 unread 메시지 수만큼 개별 UPDATE 수행 ([GlobalTeamChat.tsx:95](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/GlobalTeamChat.tsx:95)).
- TeamTab은 `admin_task_comments`의 모든 이벤트(`*`)마다 `fetchComments()` 재조회 ([TeamTab.tsx:104](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:104)).
- 결과: 채팅 열기/읽음 처리 시, 할일 댓글과 무관한 UPDATE에도 TeamTab이 반복 재조회.

3. **S2 사이드바 카운트 갱신 비용 과다**
- 댓글 INSERT마다 `fetchCounts()` 호출 ([Sidebar.tsx:116](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/Sidebar.tsx:116)).
- `fetchCounts()`는 단순 팀 카운트 외에도 여러 테이블을 동시 조회 ([sidebar-counts API:30](/Users/sonhyungeun/Documents/locally-web/app/api/admin/sidebar-counts/route.ts:30)).
- 댓글 1건이 팀 UI 외 운영 데이터 조회까지 유발.

4. **S2 TEAM 탭에서도 대시보드 전체 데이터 선로딩**
- `TEAM` 탭만 봐도 `useAdminData()`가 대량 쿼리를 먼저 실행 ([admin page:43](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/page.tsx:43), [useAdminData.ts:101](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/hooks/useAdminData.ts:101)).
- 초기 진입 체감이 무거워짐.

5. **S3 렌더링 계산량 비효율**
- `todos.map` 내부에서 매번 `comments.filter` 수행, 탭 뱃지에서도 반복 필터/탐색 ([TeamTab.tsx:344](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:344), [TeamTab.tsx:453](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/TeamTab.tsx:453)).
- 데이터 증가 시 리렌더 코스트 상승.

## 결정 완료된 개선 설계 (구현 기준안)
1. 댓글 중복 방지
- 클라이언트: TODO/MEMO 댓글 전송 함수에 `isSubmittingCommentByTaskId` 락 추가, 전송 중 Enter/버튼 비활성화.
- 클라이언트: `onKeyDown`에서 조합 입력(IME) 시 전송 무시.
- 서버/DB: `admin_task_comments`에 `client_nonce` 컬럼 추가, `UNIQUE(author_id, task_id, client_nonce)` 적용(최종 중복 차단).

2. Realtime 이벤트 폭주 차단
- TeamTab 구독을 `event: 'INSERT' | 'DELETE'` 중심으로 축소하고 `UPDATE`는 무시.
- 콜백에서 payload `task_id`가 현재 워크스페이스 task 목록에 없으면 즉시 return.
- `fetchComments`를 150~300ms 디바운스.

3. 팀채팅 읽음 처리 최적화
- 개별 UPDATE 루프 제거.
- `mark_room_messages_read(room_id, user_id)` RPC 1회 호출로 일괄 처리.
- UPDATE 구독 반영은 유지하되 TeamTab 영향 없도록 필터링.

4. 사이드바 카운트 경량화
- `/api/admin/sidebar-counts`에서 Team 이벤트 경로 분리:
  - 신규 `/api/admin/team-counts?lastViewed=...` (tasks/comments만 조회)
- Sidebar의 team realtime 이벤트는 경량 endpoint만 호출.
- 기존 전체 카운트 API는 30~60초 폴링 또는 탭 전환 시 호출.

5. TEAM 탭 로딩 분리
- `useAdminData()`를 탭별 lazy fetch로 분해.
- `TEAM` 활성 시에는 TeamTab/GlobalTeamChat 관련 데이터만 초기 로드.

## Public API / 인터페이스 변경
- DB:
  - `admin_task_comments.client_nonce text null`
  - `unique index (author_id, task_id, client_nonce) where client_nonce is not null`
- 신규 RPC:
  - `mark_room_messages_read(p_room_id uuid, p_user_id uuid)`
- 신규 API:
  - `GET /api/admin/team-counts`
- 타입:
  - `AdminComment`에 `client_nonce?: string`
  - 채팅/댓글 전송 payload에 `client_nonce` 포함

## 테스트 시나리오
1. TODO 댓글 입력창에서 Enter 연타 + 버튼 연속 클릭 시 DB row 1건만 생성.
2. 동일 브라우저/다른 브라우저 동시 전송 시 nonce 충돌 없이 각각 1건씩 저장.
3. Team Chat 오픈 시 unread 100건이어도 DB write 1회(RPC)만 발생.
4. Chat read_by UPDATE 발생 시 TeamTab 댓글 목록 재조회가 트리거되지 않음.
5. Sidebar 팀 뱃지 갱신 시 service/bookings 등 무관 쿼리가 호출되지 않음.
6. TEAM 탭 최초 진입 TTI가 기존 대비 유의미하게 감소(회귀 없이).

## 가정 및 기본값
- `admin_task_comments` 단일 테이블(팀할일+팀채팅 공용) 구조는 유지.
- UI/UX 카피와 레이아웃은 최대한 유지, 동작 안정성/성능 개선에 집중.
- 실서비스 기준 날짜/로그는 UTC 저장을 기준으로 분석.
- 인덱스 메타 직접 조회(`pg_catalog`)는 PostgREST 노출 제한으로 확인 불가하여, 위 설계에서 필요한 인덱스는 명시적으로 추가.
