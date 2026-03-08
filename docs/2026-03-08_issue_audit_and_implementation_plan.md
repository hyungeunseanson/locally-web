# 2026-03-08 이슈 전수 점검 및 구현 개선 계획

## 범위

사용자 제보 이슈 4건을 기준으로 아래 영역을 점검했다.

1. HEIC 업로드
2. 일본어 노출 누락
3. 투어 예약 후 호스트 메시지 직결
4. 메시지 알림 클릭 시 해당 대화 딥링크
검토 기준 문서:

- `docs/gemini.md`
- `docs/CHANGELOG.md`

추가 확인:

- `npx tsc --noEmit` 현재 베이스라인 실패
- 실패 위치: `app/become-a-host2/page.tsx(99,45)` `Cannot find namespace 'JSX'`
- 이번 이슈 4건과 직접 연결된 오류는 아니지만, 자동 검증 베이스라인이 이미 깨져 있어 구현 단계에서 별도 정리가 필요하다.

## 핵심 요약

이번 4건은 각각 개별 버그처럼 보이지만, 실제로는 아래 3개의 구조 문제로 묶인다.

1. 업로드 공통 유틸이 포맷별 정책 없이 `image/*` 전체를 허용한다.
2. i18n이 중앙 딕셔너리 기반이지만, 핵심 플로우 일부가 여전히 하드코딩 한국어에 의존한다.
3. 메시지/알림은 이미 URL 파라미터 기반 자동 선택 규약이 있는데, 알림 생성과 일부 진입 버튼이 그 규약을 끝까지 채우지 않는다.

우선순위는 아래 순서가 맞다.

1. 예약 후 메시지 직결
2. 메시지 알림 딥링크
3. 일본어 누락 최소화와 “한국어만 지원” 명시
4. HEIC 정책 정리
## gemini/changelog 확인 결과

- `docs/gemini.md:17-33` 기준상 `service_bookings`와 일반 `bookings`는 분리 유지가 원칙이다. 따라서 메시지/정산 개선도 기존 예약과 서비스 매칭을 섞지 말고 각 흐름의 링크와 필드를 별도로 유지해야 한다.
- `docs/gemini.md:54-58` 기준상 결제 확정/취소는 서버 검증이 단일 소스여야 한다. 결제 완료 후 메시지 직결도 결제 상태를 클라이언트에서 임의 생성하지 않고, 기존 예약 데이터나 기존 inquiry 조회 규약을 이용해야 한다.
- `docs/CHANGELOG.md:159-181` 기준상 최근에 서비스 매칭용 1:1 메시지, `hostId` 단독 inbox 선택, 고객센터 메시지 개선이 이미 들어갔다. 즉 메시지 딥링크 체계는 새로 만드는 것이 아니라 일반 예약/알림 경로에 일관되게 확장하는 작업이다.

## 이슈별 분석

### 1. HEIC 파일 업로드 안 됨

#### 현재 상태

- 공통 업로드 유틸 `app/utils/image.ts:3-37` 는 `file.type.startsWith('image/')` 만 검사하고, 모든 이미지를 `browser-image-compression` 으로 JPEG 변환 시도한다.
- 실패하면 원본 파일을 그대로 반환한다. 즉 “지원 불가”도 아니고 “안전 변환 성공”도 아닌 애매한 상태다.
- 여러 업로드 경로가 이 유틸을 재사용한다.
  - `app/host/create/page.tsx:202-240`
  - `app/account/page.tsx`
  - `app/components/ReviewModal.tsx`
  - `app/community/write/PostEditor.tsx`
  - `app/hooks/useChat.ts`
  - `app/host/register/page.tsx:208-226`
  - `app/host/dashboard/components/ProfileEditor.tsx:126-145`
- 다수 파일 입력이 `accept="image/*"` 로 열려 있다.
  - `app/host/register/components/HostRegisterForm.tsx:264`, `282`
  - `app/host/create/components/ExperienceFormSteps.tsx:309`

#### 근본 원인

1. 클라이언트 정책이 “이미지면 일단 받는다” 수준이다.
2. HEIC/HEIF 디코딩 가능 여부를 브라우저별로 판별하지 않는다.
3. 변환 실패 시 사용자에게 지원 불가를 알리지 않고 원본 반환으로 흐려진다.
4. 업로드 이후 렌더링 계층도 HEIC 표시를 보장하지 않는다.

#### 영향 범위

- 프로필 사진
- 호스트 지원서 신분증
- 체험 대표사진/동선 사진
- 후기 사진
- 커뮤니티 사진
- 채팅 이미지

#### 구현 개선안

빠른 대응안:

1. 공통 유틸에 명시적 포맷 정책 추가
2. `image/heic`, `image/heif`, 확장자 `.heic`, `.heif` 감지
3. 현재 브라우저에서 안정 변환이 불가능하면 업로드를 막고 “HEIC는 아직 지원하지 않습니다. JPG/PNG로 변환 후 업로드해 주세요.” 표기
4. 모든 업로드 UI에 동일 문구 재사용

구조 개선안:

1. `validateImage()` 를 `validateUploadImage()` 로 재설계
2. 반환값에 `code` 포함
   - `unsupported_format`
   - `too_large`
   - `conversion_failed`
3. 브라우저 변환 성공 시에만 JPEG/WebP로 통일 업로드
4. 장기적으로는 서버 변환 파이프라인 또는 HEIC 디코더 도입 검토

판단:

- 지금 상태에서 “HEIC 완전 지원”보다 “명시적으로 미지원 표기”가 먼저다.
- 사용자 요청 문구대로, 지원이 어려우면 표기 필요하다는 요구에 정확히 부합한다.

### 2. 일부 일본어 미노출

#### 현재 상태

중앙 딕셔너리 자체는 존재한다.

- `app/context/LanguageContext.tsx:1-35`

하지만 실제 화면 일부는 `t()` 를 쓰지 않고 한국어 하드코딩 상태다.

대표 사례:

- 호스트 지원서
  - `app/host/register/components/HostRegisterForm.tsx:163-355`
- 체험 작성
  - `app/host/create/components/ExperienceFormSteps.tsx:197-360`
  - `app/host/create/page.tsx:49-139`
- 고객센터/호스트 도움말 일부
  - `app/help/page.tsx:158-208`
  - `app/help/page.tsx:349-369`
- 약관/정책
  - `app/constants/legalText.ts:3-80`
  - `app/components/SiteFooter.tsx:30-35`
  - `app/components/SiteFooter.tsx:205-227`

참고:

- `docs/Languageplan.md` 에는 별도 페이지 i18n 전개 방식이 이미 정리돼 있다. 즉 번역 키 확장 방식은 새로 설계할 필요가 없다.

#### 근본 원인

1. 중앙 i18n 시스템과 신규/구형 페이지가 혼재한다.
2. 화면 텍스트와 검증 토스트가 컴포넌트 내부 문자열로 박혀 있다.
3. 약관은 번역 키가 아니라 긴 한국어 문자열 상수로만 관리된다.

#### 영향 범위

- 일본어 UI 신뢰도 저하
- 폼 입력 성공/실패 메시지까지 한국어 노출
- 법무/정책 문서는 일본어 라벨만 있고 실제 내용은 한국어

#### 구현 개선안

Phase 1:

1. 호스트 지원서/체험 작성/고객센터 모달의 하드코딩 문구를 `LanguageContext` 키로 치환
2. 토스트/placeholder/button label 도 함께 치환
3. 약관은 당장 번역이 준비되지 않으면 모달 상단에 “현재 한국어만 지원” 배지와 안내 문구 표기

Phase 2:

1. `legalText.ts` 를 locale별 문서 구조로 분리
2. 형태는 아래 둘 중 하나
   - `Record<Locale, { terms, privacy, travel, refund }>`
   - `docs/legal/{locale}/*.md`
3. footer 모달 제목도 `t()` 로 이동

권장:

- “UI는 번역, 법률 문서는 한국어만 제공” 상태가 당분간 필요하다면 숨기지 말고 명시해야 한다.
- 현재처럼 메뉴명만 일본어이고 본문은 한국어인 상태가 가장 불친절하다.

### 3. 투어 예약 후 “호스트에게 메시지 보내기”가 바로 연결되지 않음

#### 현재 상태

정상 동작하는 경로도 있다.

- `app/api/guest/trips/route.ts:44-59` 가 `hostId` 와 `expId` 를 내려준다.
- `app/guest/trips/components/TripCard.tsx:287-293` 는 `/guest/inbox?hostId=...&expId=...&expTitle=...` 로 이동한다.
- `app/guest/inbox/page.tsx:73-108` 는 이 URL 규약을 받아 기존 대화를 자동 선택하거나 새 대화 상태를 연다.

하지만 예약 직후 완료 페이지는 다른 동작을 한다.

- `app/experiences/[id]/payment/complete/page.tsx:206-214` 의 CTA 는 그냥 `/guest/inbox` 로 이동한다.

#### 근본 원인

1. 예약 완료 직후 CTA가 기존 자동 선택 규약을 쓰지 않는다.
2. 이미 구현된 deep link 규약이 완료 페이지에 재사용되지 않았다.

#### 영향 범위

- 사용자가 가장 메시지를 보내고 싶은 “예약 직후” 순간에 빈 인박스로 이동한다.
- 사용자 입장에서는 “메시지 버튼이 고장”처럼 보인다.

#### 구현 개선안

1. 완료 페이지에서 예약 조회 시 `host_id`, `experience_id`, `host display info` 까지 함께 읽는다.
2. CTA 링크를 `/guest/inbox?hostId=...&expId=...&expTitle=...` 로 변경한다.
3. `hostName`, `hostAvatar` 도 붙이면 새 대화 상태 fallback UX가 좋아진다.
4. 일반 예약과 서비스 매칭은 분리한다.
   - 일반 예약: `hostId + expId`
   - 서비스 매칭: `hostId` 단독

#### 우선순위

- 매우 높음
- 수정 범위가 작고 사용자 체감 효과가 바로 난다.

### 4. 메시지 알림 클릭 시 해당 메시지로 바로 이동하지 않음

#### 현재 상태

알림 페이지/토스트 자체는 link 기반 이동 구조다.

- `app/notifications/page.tsx:62-83`
- `app/context/NotificationContext.tsx:79-84`
- `app/context/NotificationContext.tsx:121-124`

문제는 메시지 알림 생성 시 link 가 너무 뭉뚱그려져 있다는 점이다.

- `app/hooks/useChat.ts:347-375`
- guest 수신 링크: `/guest/inbox`
- host 수신 링크: `/host/dashboard?tab=inquiries`

또한 알림 API는 `inquiry_id` 를 받아도 저장하지 않는다.

- `app/api/notifications/email/route.ts:25-27`
- `app/api/notifications/email/route.ts:89-99`

#### 근본 원인

1. 대화 단위 메타데이터 없이 페이지 단위 링크만 보낸다.
2. 클라이언트는 이미 `hostId/expId`, `guestId/expId` 규약으로 특정 대화를 열 수 있는데, 알림 생성 쪽이 그 정보를 링크에 넣지 않는다.
3. `inquiry_id` 는 함수 시그니처에만 있고 실제 persistence 경로에서 버려진다.

#### 영향 범위

- 메시지 토스트 클릭 시 인박스만 열림
- 알림 리스트 클릭 시 해당 스레드가 아니라 전체 목록으로 이동
- 호스트가 여러 게스트와 동시에 대화 중일 때 불편함이 커진다

#### 구현 개선안

빠른 대응안:

1. `useChat.sendMessage()` 에서 `currentInquiry` 기반 deep link 생성
2. guest 수신
   - 일반 예약: `/guest/inbox?hostId={hostId}&expId={experienceId}`
   - 서비스 매칭: `/guest/inbox?hostId={hostId}`
3. host 수신
   - `/host/dashboard?tab=inquiries&guestId={userId}&expId={experienceId || ''}`

구조 개선안:

1. `notifications` 테이블 또는 payload에 `inquiry_id`, `experience_id`, `host_id`, `guest_id` 저장
2. `NotificationContext` 와 `notifications/page.tsx` 가 metadata 기반 라우팅 지원
3. 향후 “정확히 그 메시지” 스크롤까지 가려면 `message_id` 저장도 검토

판단:

- 1차는 링크에 쿼리 파라미터만 붙여도 충분하다.
- 별도 schema 변경은 2차.

## 권장 실행 순서

### 0단계. 즉시 처리 가능한 Quick Win

1. 예약 완료 페이지 메시지 CTA 딥링크 적용
2. `useChat.sendMessage()` 에서 메시지 알림 deep link 정교화
3. HEIC 미지원 문구 명시
4. 약관 모달 상단에 “현재 한국어만 지원” 배지 추가

### 1단계. i18n 최소 완성

1. 호스트 지원서
2. 체험 작성
3. 고객센터 모달
4. 관련 토스트/검증문구

### 2단계. 업로드 체계 정리

1. 포맷 정책 공통화
2. 모든 업로드 경로에 동일 에러 메시지 적용
3. 필요 시 HEIC 지원 검토

## 변경 시 주의점

1. 일반 예약 `bookings` 와 서비스 매칭 `service_bookings` 를 섞지 않는다.
2. 메시지 딥링크는 기존 자동 선택 규약을 재사용한다.
3. 약관 번역이 준비되지 않으면 “숨기기” 대신 “한국어만 지원”을 명시한다.
4. HEIC는 일부 브라우저에서 변환 실패 후 원본이 남기 때문에, 지원 여부를 명확히 분기해야 한다.

## 결론

가장 먼저 손대야 할 것은 메시지 진입 UX다. 이미 필요한 URL 파라미터 기반 규약이 구현돼 있어서, 예약 완료 페이지와 `new_message` 알림 생성 링크만 바로잡아도 사용자 체감 문제가 크게 줄어든다.

그 다음은 i18n과 법률 문구 표시 방식 정리다. 현재는 번역 시스템이 없는 것이 아니라, 핵심 플로우 일부가 시스템 밖에 남아 있다. 마지막으로 HEIC는 공통 정책 차원에서 정리하는 것이 맞다.
