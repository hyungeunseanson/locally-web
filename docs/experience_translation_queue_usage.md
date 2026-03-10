# 체험 번역 수동 실행 방법

## 1. 지금 바로 번역 돌리는 법

1. GitHub 저장소로 들어갑니다.
2. 위쪽 메뉴에서 `Actions`를 누릅니다.
3. 왼쪽 목록에서 `Experience Translation Queue`를 누릅니다.
4. 오른쪽 `Run workflow`를 누릅니다.
5. `repeat_count`는 보통 `5`를 고릅니다.
6. 아래 `Run workflow`를 한 번 더 누릅니다.

끝입니다.

---

## 2. `repeat_count`는 뭘 고르면 되나

- `1`: 테스트만 해볼 때
- `5`: 보통 이걸 누르면 됨
- `10`: 번역이 많이 밀린 것 같을 때

이 workflow는 queue가 비면 중간에 자동으로 멈춥니다.

---

## 3. 성공했는지 보는 법

실행된 GitHub Actions를 열어서 로그를 봅니다.

이런 식으로 나오면 정상입니다.

```json
{"success":true,"completed":3,"failed":0,"retried":0,"cancelled":0,"processed":3}
```

뜻:
- `processed`: 이번에 실제 처리한 번역 개수
- `completed`: 끝난 개수

이것도 정상입니다.

```json
{"success":true,"completed":0,"failed":0,"retried":0,"cancelled":0,"processed":0}
```

뜻:
- 지금 처리할 번역이 없다는 뜻입니다

---

## 4. `CRON_SECRET`는 뭐냐

이건 어디서 받아오는 값이 아닙니다.

직접 하나 만드는 비밀번호입니다.

중요:
- GitHub에도 넣고
- Vercel에도 넣고
- 두 곳에 **똑같은 값**을 넣어야 합니다

예시:

```text
3f4c8b2d9e1a7c6f5b4a3d2e1f0a9b8c
```

이런 긴 랜덤 문자열이면 됩니다.

---

## 5. `CRON_SECRET` 값 만드는 법

아무 랜덤 문자열을 직접 만들어도 되고, 터미널에서 이렇게 만들어도 됩니다.

```bash
openssl rand -hex 32
```

출력된 값을 복사해 두면 됩니다.

---

## 6. GitHub에는 어디에 넣나

1. GitHub 저장소로 들어갑니다.
2. 상단 `Settings`를 누릅니다.
3. 왼쪽 메뉴에서 `Secrets and variables`를 누릅니다.
4. `Actions`를 누릅니다.
5. `New repository secret`를 누릅니다.
6. Name에는 `CRON_SECRET`
7. Secret에는 아까 만든 랜덤 문자열
8. `Add secret`를 누릅니다.

`PROD_URL`도 같은 곳에 넣어야 합니다.

- Name: `PROD_URL`
- Secret: 운영 주소
- 예: `https://your-production-domain.com`

---

## 7. Vercel에는 어디에 넣나

여기서 말하는 `운영 서버 환경변수`는 지금 프로젝트 기준으로 `Vercel 환경변수`를 뜻합니다.

1. Vercel 프로젝트로 들어갑니다.
2. `Settings`를 누릅니다.
3. `Environment Variables`를 누릅니다.
4. `CRON_SECRET` 항목을 추가합니다.
5. Key는 `CRON_SECRET`로 적습니다.
6. Value는 GitHub에 넣은 것과 **완전히 같은 값**으로 적습니다.
7. 저장합니다.
8. 필요하면 재배포합니다.

---

## 8. 언제 이 설정이 필요한가

아래 같은 에러가 나오면 이 설정부터 보면 됩니다.

- `Unauthorized`

이 뜻은 거의 항상 아래 둘 중 하나입니다.

- GitHub의 `CRON_SECRET` 값이 틀림
- Vercel의 `CRON_SECRET` 값이 틀림

즉, 두 곳 값이 서로 정확히 같아야 합니다.

---

## 9. 제일 쉬운 운영 방식

- 평소에는 자동 실행에 맡깁니다.
- 번역이 안 된 것 같으면 GitHub `Actions`에서 직접 `Run workflow` 누릅니다.
- 헷갈리면 그냥 `repeat_count=5`로 실행하면 됩니다.
