# 체험 번역 미실행 원인 진단 및 자동 실행 복구 계획

## 요약
원인은 번역 생성 로직이 아니라 `worker 실행 경로 부재`다.

확인된 사실:
- 최신 체험 row는 정상 저장됐고, `source_locale='ko'`, `manual_locales=['ko']`, `translation_meta.en/ja/zh='queued'`까지 들어갔다.
- `experience_translation_jobs`와 `experience_translation_tasks`도 정상 생성됐다.
- 그런데 최신 체험 task는 `leased_at=null`, `attempt_count=0`, `last_error=null` 상태로 그대로 `queued`에 멈춰 있다.
- 즉 `Gemini 번역 호출 자체가 시작되지 않았다`.
- 저장소에는 현재 Vercel Cron 설정 파일 `vercel.json`이 없다.
- 사용 환경은 `Vercel Hobby`로 확정되었고, 공식 제약상 Cron은 하루 1회만 가능하다. 그래서 `Cron만으로는 생성 직후 자동 번역` 요구를 만족할 수 없다.

따라서 고정 설계는 다음으로 간다:
- `생성/수정 API 저장 직후 즉시 번역 트리거`
- `Vercel Cron은 하루 1회 누락 복구용`
- `가격만 수정 같은 non-content edit는 기존 dirty check대로 번역 미실행`

## 구현 목표
새 체험 생성 직후 호스트가 별도 URL을 치지 않아도 번역이 자동으로 들어가야 한다.

성공 기준:
- `ko`만 입력한 새 체험 저장 후 `en/ja/zh` task가 즉시 실행된다.
- 정상 상황에서는 첫 저장 직후 수 초 내 번역 컬럼이 채워진다.
- inline 처리 중 일부 실패/timeout이 있어도 저장 자체는 성공하고, 남은 task는 queue에 남는다.
- 하루 1회 Cron이 잔여 `queued/retryable` task를 회수한다.
- 가격/사진만 수정하면 queue가 새로 생기지 않는다.

## 구현 방식
### 1. Worker 코어를 공용 함수로 분리
현재 `GET /api/cron/experience-translations` 안에 있는 처리 로직을 서버 전용 공용 함수로 분리한다.

신규 내부 인터페이스:
```ts
processExperienceTranslationQueue({
  scope,
  maxTasks,
  timeBudgetMs,
  triggerSource,
}): Promise<{
  processed: number
  completed: number
  failed: number
  retried: number
  cancelled: number
  remaining: number
}>
```

고정 동작:
- `scope`는 `all` 또는 `{ experienceId, translationVersion }`
- `triggerSource`는 `'inline' | 'cron'`
- provider 순서는 기존대로 `gemini -> grok`
- lease/RPM/TPM 제어는 기존 RPC를 그대로 사용
- 공용 함수는 route 밖에서도 직접 호출 가능해야 한다

파일 방향:
- 현재 cron route에서 로직을 떼어 `app/utils/experienceTranslation/worker.ts` 같은 서버 전용 모듈로 이동
- cron route는 이 함수를 호출만 한다

### 2. Host create/update API에서 저장 직후 inline trigger 실행
대상:
- `POST /api/host/experiences`
- `PATCH /api/host/experiences/[id]`

고정 규칙:
- DB 저장과 queue 생성이 끝난 뒤에만 trigger를 건다
- trigger 대상은 `방금 저장한 experience_id + translation_version` 범위로 제한한다
- `translation_version`이 증가하지 않은 요청은 trigger를 절대 호출하지 않는다
- response는 저장 성공을 우선하고, 번역 실패는 저장 실패로 승격하지 않는다

inline 실행 정책:
- `maxTasks = 3`
- `timeBudgetMs = 12000`
- 한 번의 저장 요청에서는 그 체험의 `en/ja/zh`만 처리한다
- 시간 초과나 quota로 남은 작업은 `queued/retryable`로 남기고 response는 성공 처리한다

이 방식을 선택한 이유:
- Vercel Hobby에서는 분 단위 Cron이 불가능하다
- 서버 내부에서 공용 worker 함수를 직접 호출하는 것이 `내부 fetch`보다 단순하고 신뢰성이 높다
- 생성 직후 자동 번역 UX를 만족시키려면 현재 인프라에서 이 방식이 가장 안전하다

### 3. Vercel Cron은 일일 복구용으로만 추가
저장소에 `vercel.json`을 추가한다.

고정 스케줄:
- `0 19 * * *`
- 의미: UTC 19:00, 한국 시간 기준 매일 04:00

Cron 대상:
- `/api/cron/experience-translations`

의도:
- inline trigger에서 남은 `queued/retryable` task 회수
- deploy 실패/일시적 API quota/cold start 이후 누락 복구
- 수동 QA 없이도 큐가 영구 정체되지 않게 보장

### 4. 배포 환경 변수 정리
Vercel Production에 반드시 있어야 하는 값:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CRON_SECRET`

선택 값:
- `XAI_API_KEY`
- `TRANSLATION_WORKER_BATCH_SIZE`
- `TRANSLATION_TASK_LEASE_SECONDS`
- `TRANSLATION_MAX_ATTEMPTS`
- `TRANSLATION_GEMINI_RESERVED_TOKENS`
- `TRANSLATION_GROK_RESERVED_TOKENS`
- `TRANSLATION_GEMINI_MODEL`
- `TRANSLATION_GROK_MODEL`

고정 규칙:
- `CRON_SECRET`가 있으면 cron route는 bearer 검증 유지
- inline trigger는 내부 함수 직접 호출이므로 `CRON_SECRET`를 쓰지 않는다
- `XAI_API_KEY`가 없으면 fallback은 비활성화되지만 Gemini 단독 번역은 계속 동작한다

### 5. 에러 처리 규칙
고정 정책:
- 체험 저장 성공과 번역 성공은 분리한다
- inline trigger 실패 시 API 응답은 `200/201` 유지
- 실패 원인은 서버 로그에 남기고, task 상태는 기존 queue 규칙을 따른다
- `GEMINI_API_KEY` 누락 같은 환경 설정 오류는 명시적 로그로 남긴다
- `retryable`과 `failed` 구분은 현재 worker 규칙을 유지하되, `inline` 실행에서도 동일하게 적용한다

### 6. 관찰성 보강
추가 로그 포인트:
- create/update 후 `translation queued for experience_id/version`
- inline trigger 시작/종료
- inline 결과 요약 `processed/completed/remaining`
- cron 실행 결과 요약
- quota hit 시 provider, cooldown, retry 시각

선택적 응답 메타:
- create/update API 응답에 `translation_trigger` 요약을 포함한다
```json
{
  "translation_trigger": {
    "mode": "inline",
    "processed": 3,
    "remaining": 0
  }
}
```
- 프론트는 이 값을 당장 사용하지 않아도 된다
- QA와 운영 디버깅을 위해 응답에 포함한다

## 변경되는 인터페이스 / 타입
### Public / Deployment
- 신규 배포 파일: `vercel.json`
- 신규 운영 요구사항: Vercel Production env에 `CRON_SECRET`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Server API 응답
- `POST /api/host/experiences`
- `PATCH /api/host/experiences/[id]`

응답에 추가:
```ts
type TranslationTriggerSummary = {
  mode: 'inline' | 'skipped'
  processed: number
  completed: number
  failed: number
  retried: number
  cancelled: number
  remaining: number
}
```

### Internal
- 신규 공용 함수:
```ts
processExperienceTranslationQueue({
  scope,
  maxTasks,
  timeBudgetMs,
  triggerSource,
})
```

## 테스트 케이스
### 시나리오 1: 신규 생성 즉시 번역
- `ko`만 선택해 체험 생성
- 저장 직후 `jobs/tasks` 생성 확인
- 별도 수동 URL 호출 없이 `title_en/ja/zh`, `description_en/ja/zh` 채워짐
- `meeting_point_i18n`, `inclusions_i18n`, `itinerary_i18n` 등 확장 필드도 대상 locale 생성 확인

### 시나리오 2: 가격만 수정
- 기존 번역 완료 체험에서 가격만 변경
- `translation_version` 증가 없음
- 새 `job/task` 생성 없음
- 기존 번역 컬럼 유지

### 시나리오 3: inline 일부 실패
- Gemini quota 또는 일시 오류 유도
- 저장 요청은 성공
- 일부 task는 `retryable`
- nightly cron 또는 수동 cron 호출 시 복구

### 시나리오 4: 배포 후 자동 복구
- queued task를 남겨둔 상태에서 cron 시간 도래
- daily cron이 `queued/retryable` task 처리
- provider state, cooldown, retry 동작 확인

### 시나리오 5: legacy 보존
- 기존 수동 다국어 값이 들어 있는 체험 수정
- `manual_locales` 유지
- 기존 수동 번역 증발 없음

## 롤아웃 순서
1. worker 코어를 공용 함수로 분리
2. create/update API에 inline trigger 연결
3. 응답에 `translation_trigger` 메타 추가
4. `vercel.json`에 daily cron 추가
5. Vercel Production env 점검
6. Preview 배포에서 신규 생성 QA
7. Production 배포 후 실체험 1건 생성 QA
8. 다음날 daily cron recovery 확인

## 명시적 가정 / 기본값
- 배포 플랫폼은 계속 Vercel이다
- 플랜은 당분간 `Hobby` 유지다
- `즉시 트리거 + 일일 Cron`이 최종 고정안이다
- 생성 직후 자동 번역은 `inline best-effort`로 해결한다
- 저장 응답 지연은 허용하되 12초 budget을 넘기지 않는다
- `Grok`은 optional fallback이며, 없으면 Gemini 단독으로 운영한다
- 기존 dirty check, manual locale 보존, TPM rate-limit 보강 로직은 그대로 유지한다
