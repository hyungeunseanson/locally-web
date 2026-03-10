# Service Request Chat Scope Handoff

작성일: 2026-03-08

## 목적

서비스 매칭 채팅이 기존에는 `guest-host` 조합 기준으로 재사용되어, 같은 게스트와 같은 호스트가 서로 다른 의뢰를 진행할 때 채팅방이 합쳐질 수 있었다.

이를 `service_request_id` 기준으로 분리하는 작업을 진행했고, 내일 이어서 최종 라이브 검증을 하면 된다.

---

## 현재 완료 상태

### 1. 코드 반영 완료

반영 커밋:
- `8af4783` : 답장 전송 서버 API 통합 2차
- `3ef348e` : 서비스 매칭 채팅 request 단위 식별 준비

핵심 파일:
- [app/api/inquiries/thread/shared.ts](/Users/sonhyungeun/Documents/locally-web/app/api/inquiries/thread/shared.ts)
- [docs/migrations/v3_37_35_service_request_inquiry_key.sql](/Users/sonhyungeun/Documents/locally-web/docs/migrations/v3_37_35_service_request_inquiry_key.sql)
- [docs/gemini.md](/Users/sonhyungeun/Documents/locally-web/docs/gemini.md)
- [docs/CHANGELOG.md](/Users/sonhyungeun/Documents/locally-web/docs/CHANGELOG.md)

핵심 동작:
- `service_request` 컨텍스트 문의 생성 시, DB에 `inquiries.service_request_id` 컬럼이 있으면
  `(user_id, host_id, service_request_id)` 기준으로 기존 스레드를 찾음
- 컬럼이 없으면 레거시 fallback:
  `(user_id, host_id, experience_id IS NULL)` 기준 유지
- 즉, 배포 순서가 뒤바뀌어도 앱이 깨지지 않게 설계함

### 2. SQL 실행 완료

실행 파일:
- [docs/migrations/v3_37_35_service_request_inquiry_key.sql](/Users/sonhyungeun/Documents/locally-web/docs/migrations/v3_37_35_service_request_inquiry_key.sql)

포함 내용:
- `inquiries.service_request_id` 컬럼 추가
- `service_requests(id)` FK 추가
- `service_request_id` 인덱스 추가
- `(user_id, host_id, service_request_id)` partial unique index 추가

### 3. 기본 회귀 검증 완료

통과한 검증:
- `git diff --check`
- `npx tsc --noEmit`
- `npx playwright test tests/e2e/05-live-guest-booking-messaging-support.spec.ts --project=chromium --reporter=list`

의미:
- 기존 예약/게스트↔호스트 메시지/관리자 문의 플로우는 회귀 없이 유지됨

---

## 아직 안 한 것

### 최종 라이브 검증 1건

아직 남은 핵심은 이것 하나다:

`같은 guest-host 조합으로 서비스 의뢰 2건을 만들고, 채팅방이 2개로 분리되는지 확인`

즉, 이번 작업의 진짜 목표 검증은 아직 미실행 상태다.

---

## 내일 바로 할 작업

### 목표

아래 시나리오를 실제로 검증:

1. 같은 게스트 계정으로 서비스 의뢰 A 생성
2. 같은 호스트가 선택되도록 진행
3. 메시지방 생성 확인
4. 다시 같은 게스트 계정으로 서비스 의뢰 B 생성
5. 같은 호스트가 선택되도록 진행
6. 메시지방 생성 확인
7. A/B가 서로 다른 `inquiry.id`를 가지는지 확인
8. 필요하면 DB에서 `service_request_id` 값까지 직접 확인

### 기대 결과

- 의뢰 A용 채팅방과 의뢰 B용 채팅방이 분리되어야 함
- 같은 guest-host 조합이라도 하나의 기존 문의방으로 합쳐지면 안 됨

---

## 확인 포인트

### 성공 조건

- `inquiries`에 같은 `user_id`, 같은 `host_id`라도
  서로 다른 `service_request_id`로 별도 row 생성
- guest 화면에서 의뢰 A/B가 서로 다른 문의방으로 열림
- host 화면에서도 A/B가 서로 다른 문의방으로 열림

### 실패 조건

- 두 번째 서비스 의뢰가 첫 번째 문의방을 재사용함
- `service_request_id`가 NULL로 들어감
- unique index 충돌 후 fallback이 잘못되어 같은 채팅방으로 귀결됨

---

## 주의사항

### 1. 기존 문의방은 분리되지 않음

이번 작업은 backfill을 하지 않았다.

즉:
- 과거에 이미 생성된 서비스 채팅은 그대로 유지
- SQL 적용 후 새로 생성되는 서비스 채팅부터 request 단위 분리 활성화

### 2. fallback 코드는 유지 중

현재 코드에는 컬럼 존재 여부 체크가 들어가 있다.

의미:
- SQL 미적용 환경에서도 안전
- 하지만 지금은 SQL 적용이 끝났으므로, 실제 새 의뢰 생성부터는 `service_request_id` 경로를 타야 정상

### 3. 내일 재시작할 때 이 문서를 기준으로 진행하면 됨

다음 요청 예시:

`이 문서 기준으로 서비스 매칭 채팅 분리 최종 라이브 검증 이어서 진행해`

---

## 참고 경로

- [app/api/inquiries/thread/shared.ts](/Users/sonhyungeun/Documents/locally-web/app/api/inquiries/thread/shared.ts)
- [docs/migrations/v3_37_35_service_request_inquiry_key.sql](/Users/sonhyungeun/Documents/locally-web/docs/migrations/v3_37_35_service_request_inquiry_key.sql)
- [docs/gemini.md](/Users/sonhyungeun/Documents/locally-web/docs/gemini.md)
- [docs/CHANGELOG.md](/Users/sonhyungeun/Documents/locally-web/docs/CHANGELOG.md)
- [app/services/[requestId]/ServiceRequestClient.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/[requestId]/ServiceRequestClient.tsx)
- [app/api/services/start-chat/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/services/start-chat/route.ts)

