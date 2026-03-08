# Messaging / Inquiry Full Audit Report

**Date:** 2026-03-08  
**Scope:** Guest -> Host message, Host -> Guest message, User -> Admin 1:1 inquiry, related notifications/deep links/admin monitoring

## 1. Executive Summary

현재 메시징 시스템은 **핵심 1:1 대화 자체는 동작하고**, 최근 패치로 **알림 딥링크와 라이브 E2E 검증까지 들어간 상태**다.  
다만 구조적으로는 아직 완전히 정리되지 않았다.

가장 큰 문제는 아래 3가지다.

1. **문의방 생성 + 첫 메시지 생성 로직이 경로마다 분산**되어 있다.  
   `useChat.createInquiry()`를 타는 경로와, 화면별로 `inquiries` / `inquiry_messages`를 직접 넣는 경로가 섞여 있다.
2. **서비스 매칭 채팅은 request 단위가 아니라 guest-host 단위로 뭉친다.**  
   같은 고객이 같은 호스트와 두 번째 서비스 의뢰를 진행하면 기존 스레드를 재사용하게 되는 구조다.
3. **관리자 CS는 운영 화면은 있지만, 생성/알림/상태전환이 아직 완전히 일관되지 않다.**

결론적으로:

- **C2C 일반 메시징은 실사용 가능 수준**
- **관리자 1:1 문의는 기능은 되지만 운영 일관성 보강 필요**
- **서비스 매칭 메시징은 구조 재정의가 필요**

---

## 2. 전수 점검 범위

### 공통 코어
- [app/hooks/useChat.ts](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts)
- [app/utils/inquiry.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/inquiry.ts)
- [app/utils/notification.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/notification.ts)
- [app/context/NotificationContext.tsx](/Users/sonhyungeun/Documents/locally-web/app/context/NotificationContext.tsx)
- [app/api/notifications/email/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/notifications/email/route.ts)

### 게스트 메시지 진입점
- [app/guest/inbox/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/guest/inbox/page.tsx)
- [app/experiences/[id]/ExperienceClient.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/[id]/ExperienceClient.tsx)
- [app/experiences/[id]/payment/complete/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/[id]/payment/complete/page.tsx)
- [app/guest/trips/components/TripCard.tsx](/Users/sonhyungeun/Documents/locally-web/app/guest/trips/components/TripCard.tsx)

### 호스트 메시지 경로
- [app/host/dashboard/InquiryChat.tsx](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx)
- [app/api/host/start-chat/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/host/start-chat/route.ts)

### 관리자 문의/운영 경로
- [app/help/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/help/page.tsx)
- [app/admin/dashboard/components/ChatMonitor.tsx](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/ChatMonitor.tsx)
- [app/admin/dashboard/components/DetailsPanel.tsx](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/DetailsPanel.tsx)
- [app/api/admin/sidebar-counts/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/admin/sidebar-counts/route.ts)

### 서비스 매칭 예외 경로
- [app/services/[requestId]/ServiceRequestClient.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/[requestId]/ServiceRequestClient.tsx)
- [app/api/services/start-chat/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/services/start-chat/route.ts)

### 실검증
- [tests/e2e/05-live-guest-booking-messaging-support.spec.ts](/Users/sonhyungeun/Documents/locally-web/tests/e2e/05-live-guest-booking-messaging-support.spec.ts)

---

## 3. 현재 구조 요약

### 3.1 공통 메시징 코어

`useChat`가 사실상 메시징 엔진이다.

- 문의방 목록 조회
- 메시지 조회
- 읽음 처리
- 메시지 전송
- 이미지 업로드
- `new_message` 알림 발송
- guest/host/admin 역할별 딥링크 생성

핵심 구현:
- 문의방 조회: [app/hooks/useChat.ts#L139](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L139)
- 읽음 처리: [app/hooks/useChat.ts#L240](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L240)
- 메시지 전송: [app/hooks/useChat.ts#L308](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L308)
- 문의방 생성: [app/hooks/useChat.ts#L431](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L431)
- 리얼타임 구독: [app/hooks/useChat.ts#L480](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L480)

### 3.2 게스트 -> 호스트

진입점이 여러 개다.

- 체험 상세 문의: [app/experiences/[id]/ExperienceClient.tsx#L101](/Users/sonhyungeun/Documents/locally-web/app/experiences/[id]/ExperienceClient.tsx#L101)
- 예약 완료 후 메시지: [app/experiences/[id]/payment/complete/page.tsx#L128](/Users/sonhyungeun/Documents/locally-web/app/experiences/[id]/payment/complete/page.tsx#L128)
- 내 여행 카드: [app/guest/trips/components/TripCard.tsx#L288](/Users/sonhyungeun/Documents/locally-web/app/guest/trips/components/TripCard.tsx#L288)
- 게스트 인박스 실제 처리: [app/guest/inbox/page.tsx#L78](/Users/sonhyungeun/Documents/locally-web/app/guest/inbox/page.tsx#L78)

### 3.3 호스트 -> 게스트

호스트 대시보드 문의함이 중심이다.

- URL의 `inquiryId`, `guestId`, `expId`를 읽어서 자동 스레드 선택/생성: [app/host/dashboard/InquiryChat.tsx#L46](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L46)
- 체험 기준 새 문의방 생성 API: [app/api/host/start-chat/route.ts#L22](/Users/sonhyungeun/Documents/locally-web/app/api/host/start-chat/route.ts#L22)

### 3.4 유저 -> 관리자 문의

두 경로가 있다.

- 유저가 Help에서 1:1 문의 생성: [app/help/page.tsx#L200](/Users/sonhyungeun/Documents/locally-web/app/help/page.tsx#L200)
- 관리자가 유저 상세에서 먼저 CS 시작: [app/admin/dashboard/components/DetailsPanel.tsx#L20](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/DetailsPanel.tsx#L20)

관리자 운영 UI:
- [app/admin/dashboard/components/ChatMonitor.tsx#L58](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/ChatMonitor.tsx#L58)

### 3.5 알림/딥링크

`sendMessage()`는 메시지 저장 후 `sendNotification()`을 호출하고, 그 알림은 `/api/notifications/email`을 통해 DB + 이메일로 fan-out된다.

- 알림 호출: [app/hooks/useChat.ts#L406](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L406)
- 알림 클라이언트 유틸: [app/utils/notification.ts#L41](/Users/sonhyungeun/Documents/locally-web/app/utils/notification.ts#L41)
- 알림 API: [app/api/notifications/email/route.ts#L6](/Users/sonhyungeun/Documents/locally-web/app/api/notifications/email/route.ts#L6)
- 실시간 토스트 및 unread 집계: [app/context/NotificationContext.tsx#L46](/Users/sonhyungeun/Documents/locally-web/app/context/NotificationContext.tsx#L46)

---

## 4. 업그레이드 현황

### 이미 올라간 개선

1. **메시지 알림 딥링크가 thread 기반으로 정리됨**
   - 게스트: `/guest/inbox?inquiryId=...`
   - 호스트: `/host/dashboard?tab=inquiries&inquiryId=...`
   - 관리자: `/admin/dashboard?tab=CHATS&inquiryId=...`
   - 구현: [app/hooks/useChat.ts#L110](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L110)

2. **예약 완료 후 메시지 CTA가 빈 inbox가 아니라 호스트 대화 진입 기준으로 보정됨**
   - 구현: [app/experiences/[id]/payment/complete/page.tsx#L128](/Users/sonhyungeun/Documents/locally-web/app/experiences/[id]/payment/complete/page.tsx#L128)

3. **읽음 상태(`is_read`, `read_at`) 표시가 guest/host 양쪽 UI에 반영됨**
   - guest: [app/guest/inbox/page.tsx#L237](/Users/sonhyungeun/Documents/locally-web/app/guest/inbox/page.tsx#L237)
   - host: [app/host/dashboard/InquiryChat.tsx#L265](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L265)

4. **라이브 E2E가 실제로 깔림**
   - `게스트 가입 -> 무통장 예약 -> 호스트 메시지 -> 호스트 답장 -> 관리자 문의`
   - 스펙: [tests/e2e/05-live-guest-booking-messaging-support.spec.ts](/Users/sonhyungeun/Documents/locally-web/tests/e2e/05-live-guest-booking-messaging-support.spec.ts)

### 현재 성숙도 판단

- Guest <-> Host 일반 메시징: **상**
- 예약 완료 후 메시지 진입: **상**
- Host dashboard 문의함: **중상**
- User -> Admin 1:1 문의: **중**
- Admin 운영/배정/상태관리: **중**
- Service matching 메시징: **중하**
- 알림 집계/대규모 운영성: **중하**
- 다국어 완성도(메시징 영역): **중하**

---

## 5. 핵심 문제 및 보완 포인트

## 5.1 P1 — 문의방 생성과 첫 메시지 생성이 경로마다 분산됨

### 문제

현재는 같은 “문의 시작”이라도 구현이 4종류다.

- 공용 경로: [app/hooks/useChat.ts#L431](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L431)
- Help 1:1 문의 직접 insert: [app/help/page.tsx#L211](/Users/sonhyungeun/Documents/locally-web/app/help/page.tsx#L211)
- Admin 상세 패널 CS 시작 직접 insert: [app/admin/dashboard/components/DetailsPanel.tsx#L25](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/DetailsPanel.tsx#L25)
- ServiceRequestClient 직접 insert: [app/services/[requestId]/ServiceRequestClient.tsx#L141](/Users/sonhyungeun/Documents/locally-web/app/services/[requestId]/ServiceRequestClient.tsx#L141)

이 구조 때문에 경로마다 차이가 생긴다.

- 어떤 경로는 `inquiries`와 `inquiry_messages` 둘 다 만듦
- 어떤 경로는 `inquiries.content / updated_at` 갱신을 안 함
- 어떤 경로는 알림을 안 보냄
- 어떤 경로는 빈 스레드만 만들 수 있음

### 실제 영향

- 관리자 1:1 문의는 현재 Help에서 생성돼도 `useChat.sendMessage()`를 안 타므로 **관리자에게 `new_message` 알림이 가지 않는다**
- Service matching 문의는 **목록 preview / updated_at / 알림 일관성**이 깨질 수 있다
- 첫 문의 생성이 insert 2단계라서 중간 실패 시 **“문의방은 생겼는데 실제 메시지는 없는” 불완전 상태**가 가능하다

### 권장 보완

**단일 서버 액션 / API로 통합**

예시 책임:
- `create_inquiry_with_first_message`
- 입력: `type`, `user_id`, `host_id`, `experience_id | request_id`, `content`, `sender_id`
- 처리:
  1. 기존 스레드 검색
  2. 없으면 문의방 생성
  3. 첫 메시지 insert
  4. `inquiries.content / updated_at` 동기화
  5. notification insert
  6. `inquiryId` 반환

이걸 guest/host/help/admin/service가 모두 재사용하는 방식이 맞다.

---

## 5.2 P1 — 서비스 매칭 채팅이 request 단위가 아니라 guest-host 단위로 합쳐짐

### 문제

[app/api/services/start-chat/route.ts#L49](/Users/sonhyungeun/Documents/locally-web/app/api/services/start-chat/route.ts#L49)에서 기존 스레드를 찾을 때 조건이:

- `user_id = guestId`
- `host_id = hostId`
- `experience_id IS NULL`

즉 **requestId를 전혀 보지 않는다.**

### 실제 영향

같은 게스트가 같은 호스트와 서비스 요청을 두 번 진행하면,

- 두 번째 요청도 첫 번째 서비스 채팅방을 재사용할 수 있다
- 서로 다른 서비스 의뢰 맥락이 하나의 스레드로 섞인다
- 게스트 inbox의 `hostId only` 선택 로직([app/guest/inbox/page.tsx#L97](/Users/sonhyungeun/Documents/locally-web/app/guest/inbox/page.tsx#L97))도 이 합침을 더 강화한다

### 권장 보완

서비스 매칭 전용 식별자를 스레드에 붙여야 한다.

권장안:
- `inquiries.service_request_id` 추가
- 서비스 채팅은 `type: 'service_general'` 같은 별도 subtype 도입
- 기존 조회 조건을 `(user_id, host_id, service_request_id)`로 변경

이건 **구조 변경이 필요한 진짜 업그레이드 항목**이다.

---

## 5.3 P1 — 관리자 CS 시작/답변이 운영적으로 비일관적임

### 문제 A: 관리자가 CS를 먼저 시작할 때 스레드 선택 기준이 거칠다

[app/admin/dashboard/components/DetailsPanel.tsx#L25](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/DetailsPanel.tsx#L25)에서는
해당 유저의 최신 `admin_support/admin` 문의 하나만 찾아서 열거나, 없으면 새로 만든다.

문제:
- 현재 admin 본인이 담당한 스레드인지 보지 않음
- resolved 된 과거 문의를 다시 여는 경우가 생길 수 있음
- 첫 메시지 row(`inquiry_messages`)를 남기지 않고 `inquiries.content`만 넣는 경로다

### 문제 B: 관리자 답변 후 상태 전환이 send success와 묶여 있지 않다

[app/admin/dashboard/components/ChatMonitor.tsx#L99](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/ChatMonitor.tsx#L99)에서 `sendMessage()`를 `await`하지 않고 바로 `in_progress` 전환 로직을 탄다.

즉 이론상:
- 메시지 insert 실패
- 그런데 상태는 `처리중`으로 바뀜

이런 불일치가 가능하다.

### 권장 보완

- 관리자 CS 시작도 서버 API로 통일
- 조회 기준을 `user_id + type + resolved 여부 + 담당 admin` 기준으로 재정의
- `handleSend()`는 `await sendMessage(...)` 성공 후에만 상태 변경
- 가능하면 `admin reply + status update`를 서버에서 하나의 명령으로 처리

---

## 5.4 P2 — 관리자 채팅 데이터가 공용 `useChat` + 최신 100개 제한에 묶여 있음

### 문제

[app/hooks/useChat.ts#L149](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L149)~[app/hooks/useChat.ts#L156](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L156)을 보면:

- admin role은 별도 서버 조회가 아니라 같은 `inquiries` 테이블을 그냥 읽는다
- `limit(100)`이 전역으로 걸려 있다
- type filter는 이후 [app/admin/dashboard/components/ChatMonitor.tsx#L119](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/ChatMonitor.tsx#L119)에서 client-side로 한다

### 실제 영향

- 관리자 1:1 문의가 100개를 넘으면 오래된 unresolved 건이 목록에서 밀릴 수 있다
- monitor/admin 구분도 클라이언트에서만 함
- 운영 규모가 커질수록 관리자 채팅은 별도 데이터 패스가 필요하다

### 권장 보완

- admin 전용 `useAdminChatData` 또는 `/api/admin/chats`
- 서버 기준 pagination
- server-side filter: `admin_support`, `status`, `updated_at`, `assigned_admin`

현재처럼 공용 guest/host 훅으로 admin까지 처리하는 구조는 초기엔 빠르지만, 운영 단계에선 한계가 있다.

---

## 5.5 P2 — 알림 파이프라인이 동기적이고 unread 집계가 잘려 있음

### 문제 A: 메시지 전송이 이메일 발송 경로를 동기적으로 밟음

- 메시지 전송 후 알림 호출: [app/hooks/useChat.ts#L406](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L406)
- 클라이언트 알림 유틸: [app/utils/notification.ts#L91](/Users/sonhyungeun/Documents/locally-web/app/utils/notification.ts#L91)
- 알림 API는 DB insert 뒤 바로 nodemailer 수행: [app/api/notifications/email/route.ts#L123](/Users/sonhyungeun/Documents/locally-web/app/api/notifications/email/route.ts#L123)

즉, 메시지 send path가 email 시도까지 같은 요청 안에서 돈다.

### 문제 B: 알림 컨텍스트는 최신 20개만 읽는다

[app/context/NotificationContext.tsx#L52](/Users/sonhyungeun/Documents/locally-web/app/context/NotificationContext.tsx#L52)~[app/context/NotificationContext.tsx#L59](/Users/sonhyungeun/Documents/locally-web/app/context/NotificationContext.tsx#L59)

이 때문에:
- unreadCount가 전체 unread가 아니라 최근 20개 기준일 수 있다
- 메시지/예약 알림이 누적되면 실제 unread보다 작게 보일 수 있다

### 권장 보완

- 인앱 알림 insert와 이메일 발송을 분리
- 메시지 전송 시에는 DB insert까지만 동기
- 이메일은 큐/백그라운드 route로 위임
- unread count는 count query 또는 서버 집계 API로 전환

---

## 5.6 P2 — 일부 진입점은 아직 `inquiryId`가 아니라 hostId/guestId 추정 로직에 의존함

### 문제

아직 아래 경로는 특정 inquiryId가 아니라 추정 기준으로 스레드를 연다.

- 게스트 inbox `hostId && !expId` 경로: [app/guest/inbox/page.tsx#L97](/Users/sonhyungeun/Documents/locally-web/app/guest/inbox/page.tsx#L97)
- 호스트 inbox `guestId` 경로: [app/host/dashboard/InquiryChat.tsx#L58](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L58)
- 예약 카드 메시지 버튼: [app/guest/trips/components/TripCard.tsx#L288](/Users/sonhyungeun/Documents/locally-web/app/guest/trips/components/TripCard.tsx#L288)
- 서비스 매칭 메시지 열기: [app/services/[requestId]/ServiceRequestClient.tsx#L129](/Users/sonhyungeun/Documents/locally-web/app/services/[requestId]/ServiceRequestClient.tsx#L129)

### 실제 영향

대화가 2개 이상인 상황에서 잘못된 스레드를 여는 위험이 남는다.

### 권장 보완

- 가능한 모든 진입점을 `?inquiryId=` 기준으로 통일
- 예약/서비스 생성 시점에 스레드가 없으면 먼저 생성하고 ID를 받는 방식으로 정리

---

## 5.7 P3 — 메시징 영역 i18n 완성도가 불균형함

### 문제

게스트 inbox는 `t()` 사용이 많이 들어가 있지만, 호스트/관리자 쪽은 하드코딩이 아직 많다.

예시:
- 호스트 문의함 empty/default: [app/host/dashboard/InquiryChat.tsx#L145](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L145), [app/host/dashboard/InquiryChat.tsx#L169](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L169), [app/host/dashboard/InquiryChat.tsx#L228](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L228)
- 호스트 문의함 시간 locale 고정: [app/host/dashboard/InquiryChat.tsx#L149](/Users/sonhyungeun/Documents/locally-web/app/host/dashboard/InquiryChat.tsx#L149)
- 관리자 ChatMonitor 전반: [app/admin/dashboard/components/ChatMonitor.tsx#L162](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/ChatMonitor.tsx#L162)~[app/admin/dashboard/components/ChatMonitor.tsx#L311](/Users/sonhyungeun/Documents/locally-web/app/admin/dashboard/components/ChatMonitor.tsx#L311)

### 권장 보완

- host/admin messaging UI를 feature-local localization 파일로 분리
- 시간 포맷도 `lang -> localeMap` 기준으로 통일
- 관리자용 고정 배지/경고문/상태 라벨도 다국어화

---

## 5.8 P3 — 리얼타임 구독 범위가 넓고 확장성이 약함

### 문제

[app/hooks/useChat.ts#L483](/Users/sonhyungeun/Documents/locally-web/app/hooks/useChat.ts#L483)에서 `inquiry_messages` 전체 테이블 이벤트를 구독하고, 클라이언트에서만 걸러낸다.

현재는 문제 없을 수 있지만:

- 트래픽이 커지면 noise가 많아짐
- admin role은 특히 모든 메시지 변화에 영향을 받을 수 있음

### 권장 보완

- inquiry membership 기반 구독 범위 축소
- admin는 별도 채널 또는 서버 push
- 최소한 role별/selected inquiry별 필터 전략 정리

---

## 6. 개선 우선순위 제안

## Phase 1

1. **문의 생성/첫 메시지 생성 단일 서버 API 통합**
2. **서비스 매칭 채팅에 `service_request_id` 도입**
3. **관리자 답변 send + status 전환 원자화**

## Phase 2

1. **모든 진입점을 `inquiryId` 중심 딥링크로 통일**
2. **admin 전용 채팅 조회 훅/API 분리**
3. **알림 unread count 서버 집계화**
4. **메시지 알림 이메일 비동기 분리**

## Phase 3

1. **host/admin 메시징 UI 다국어화**
2. **notification read와 message read 동기 정책 정리**
3. **리얼타임 필터링/확장성 개선**

---

## 7. 최종 판단

현재 메시징 시스템은 “기능이 없다”가 아니라,
**핵심 경로는 작동하지만 생성 경로가 분기되어 운영 일관성이 깨지기 쉬운 상태**다.

특히 중요한 포인트는 이 두 가지다.

1. **일반 체험 메시징은 유지하면서**
2. **서비스 매칭 / 관리자 CS를 공용 메시징 규약으로 끌어올려야 한다**

즉 다음 메시징 업그레이드의 본질은 UI 개편보다:

- `thread identity 정규화`
- `first message 생성 원자화`
- `notification/deep-link 일관화`

이 3개다.

이 세 가지를 끝내면, 이후 읽음 상태/첨부파일/다국어/운영 자동화는 비교적 안전하게 확장할 수 있다.
