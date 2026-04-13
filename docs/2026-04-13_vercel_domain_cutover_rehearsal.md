# Vercel Domain Cutover Rehearsal

## Summary
- 이 문서는 `www.locally-travel.com`을 `locally-web` Vercel 프로젝트로 붙이는 실제 실행 리허설 문서다.
- 목적은 cutover 당일에 결정을 다시 하지 않게 만드는 것이다.
- 기본 운영 선택은 아래처럼 고정한다.
  - primary production domain: `www.locally-travel.com`
  - apex `locally-travel.com`: `www.locally-travel.com`으로 영구 redirect
  - `NEXT_PUBLIC_SITE_URL`: `https://www.locally-travel.com`
- 이번 문서는 코드 변경이 아니라 운영 실행 문서다.

## Current Snapshot
- date: `2026-04-13`
- Vercel project: `locally-web`
- project id: `prj_bUhlyw1uuWD3Uxl01Kv4ut5jeFrz`
- team id: `team_GFZxhmQVWml3ox1z4NyBTSLo`
- current project domains: custom domain 없음, `*.vercel.app` alias만 사용 중
- latest production deployment는 cutover 직전에 반드시 `READY`인지 다시 확인한다

## Live Preflight Findings
- 점검 시각 기준 latest production deployment는 `READY`였다.
  - deployment id: `dpl_5Qfm75rrY7PJtHVP8GG2tV19p5sk`
  - deployment url: `locally-irjgz1jyi-locallys-projects-b062321b.vercel.app`
- project domain 상태
  - custom domain 없음
  - 현재 확인된 project alias
    - `locally-web.vercel.app`
    - `locally-web-locallys-projects-b062321b.vercel.app`
    - `locally-web-git-main-locallys-projects-b062321b.vercel.app`
- 실제 응답 확인 결과
  - `https://locally-web.vercel.app/robots.txt`는 `200`
  - `https://locally-web.vercel.app/sitemap.xml`는 `200`
  - `https://locally-web.vercel.app/ads.txt`는 `404`
  - `robots.txt`와 `sitemap.xml`은 현재 `https://locally-web.vercel.app` 기준 URL을 내보내고 있다
  - unique deployment URL은 root와 `sitemap.xml`에서 Vercel Authentication이 보였으므로, cutover 전 smoke 기준 URL로 쓰지 않는다
- 현재 해석
  - AdSense는 아직 비활성 상태로 보는 게 맞다
  - SEO base URL은 아직 `locally-web.vercel.app`로 정상 정렬돼 있다
  - cutover 전 공식 smoke 기준 base URL은 `locally-web.vercel.app` 또는 이후의 custom domain이어야 한다

## Source Of Truth
- preflight checklist: [docs/domain-cutover-preflight-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/domain-cutover-preflight-checklist.md:1)
- AdSense cutover: [docs/adsense-cutover-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/adsense-cutover-checklist.md:1)
- SEO ops: [docs/2026-04-13_locally_content_search_console_ops_checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_locally_content_search_console_ops_checklist.md:1)
- site URL single source: [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)
- live smoke base URL runner: [scripts/run-live-smoke.mjs](/Users/hyungeunseanson/Documents/서비스/locally-web/scripts/run-live-smoke.mjs:94)
- live smoke helper: [tests/e2e/helpers/liveBaseUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/helpers/liveBaseUrl.ts:1)

## Decision Lock
- `www`를 primary로 쓴다.
  - 이유: SEO canonical, 광고, 운영 문서, 사용자 공유 링크를 한 도메인으로 단순화하기 쉽다.
- apex는 redirect-only로 쓴다.
  - redirect target: `https://www.locally-travel.com`
  - redirect status: `301`
- cutover 당일에 아래를 동시에 바꾸지 않는다.
  - domain만 먼저 바꾸고 env는 나중에
  - env만 먼저 바꾸고 domain은 나중에
- 반드시 `domain 연결 -> env 전환 -> redeploy -> smoke` 순서로 간다.

## Rehearsal Steps
### 1. Cutover 시작 전 정지 조건 확인
- Vercel production latest deployment가 `READY`인지 확인한다.
- 이전 사이트 운영자가 DNS 변경 가능 상태인지 확인한다.
- `www.locally-travel.com`과 `locally-travel.com` 둘 다 수정 가능한지 확인한다.
- 결제/광고 cutover를 같은 날 열지 않을 경우, 그 env들은 그대로 둔다.

### 2. `www` domain 추가
- Vercel dashboard 또는 CLI에서 `www.locally-travel.com`을 현재 project에 추가한다.
- Vercel 공식 기준으로 domain add 후 verification/DNS requirement를 확인한다.
- DNS는 Vercel이 보여주는 현재 요구값을 그대로 사용한다.
  - `www`는 보통 CNAME이지만, 실제 값은 `inspect` 결과를 기준으로 확정한다.
- 이 단계에서 멈춰야 하는 조건
  - domain이 다른 프로젝트에 이미 연결돼 있음
  - verification challenge가 unresolved 상태
  - latest production deployment가 실패 상태로 바뀜

### 3. apex domain 추가 및 redirect 설정
- `locally-travel.com`도 같은 project에 추가한다.
- apex는 serving이 아니라 redirect-only로 설정한다.
  - redirect target: `www.locally-travel.com`
  - redirect status: `301`
- 이 단계에서도 DNS는 Vercel이 요구하는 record를 기준으로 넣는다.
  - apex는 보통 A record 또는 nameserver delegation 경로가 될 수 있으므로 hardcode하지 않는다.

### 4. DNS / verification 확인
- `www`와 apex 둘 다 `verified` 상태인지 확인한다.
- propagation이 끝나기 전에는 env를 바꾸지 않는다.
- 확인 기준
  - `www.locally-travel.com` 접속 시 Vercel production deployment를 본다
  - `locally-travel.com` 접속 시 `www.locally-travel.com`으로 이동한다

### 5. Production env 전환
- domain verification이 끝난 뒤에만 production env를 바꾼다.
- 최소 env 전환값
  - `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
  - 필요 시 `PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com`
- 같은 날 광고를 열면 추가 env
  - `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
  - 4개 커뮤니티 slot env
  - 마지막에만 `NEXT_PUBLIC_ADSENSE_ENABLED=true`
- 같은 날 결제 provider 전환까지 하지 않는다면 payment env는 손대지 않는다.

### 6. Production redeploy
- env 저장 후 production redeploy를 명시적으로 한 번 수행한다.
- cutover 기준은 “DNS만 바뀜”이 아니라 “DNS + env + latest production redeploy까지 완료됨”이다.

### 7. Immediate smoke
- 브라우저에서 즉시 확인
  - `https://www.locally-travel.com/`
  - `https://www.locally-travel.com/search`
  - `https://www.locally-travel.com/community`
  - locally content 상세 1건
  - `https://www.locally-travel.com/robots.txt`
  - `https://www.locally-travel.com/sitemap.xml`
  - `https://www.locally-travel.com/ads.txt` if AdSense enabled
- 확인 항목
  - page source canonical이 `www.locally-travel.com`
  - OG URL과 structured data URL이 `www.locally-travel.com`
  - `robots.txt`의 sitemap 링크가 새 도메인
  - `sitemap.xml` 내부 URL이 새 도메인
  - apex 접속 시 `www`로 간다
- 중요한 기준
  - smoke target은 `custom domain` 또는 `locally-web.vercel.app` 같은 project alias를 쓴다
  - `locally-irjgz1jyi-...vercel.app` 같은 unique deployment URL은 Vercel Authentication이 걸릴 수 있으므로 운영 smoke 기준 URL로 쓰지 않는다

### 8. Live smoke
- 공식 smoke 기준은 `scripts/run-live-smoke.mjs`다.
- 실행 전 env
  - `PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com`
- 이유
  - 이 스크립트는 env 기반으로 동작한다
  - 개별 live spec은 이제 helper를 통해 같은 값을 본다
- cutover 당일 최소 smoke 권장
  - `node scripts/run-live-smoke.mjs --bundle gate`
- noisy/shared bundle은 운영 노이즈를 감수할 수 있을 때만 별도로 돌린다.

## Stop / No-Go Conditions
- latest production deployment가 `READY`가 아님
- Vercel에서 domain verification이 끝나지 않음
- apex redirect가 확인되지 않음
- `NEXT_PUBLIC_SITE_URL` 변경 후 redeploy가 반영되지 않음
- canonical/robots/sitemap이 예전 도메인을 계속 가리킴
- login/payment redirect가 `vercel.app`나 이전 사이트 도메인으로 튐

## Rollback
- 가장 먼저 되돌릴 것은 DNS/domain mapping이다.
- 광고만 문제면 `NEXT_PUBLIC_ADSENSE_ENABLED=false` 후 redeploy
- metadata mismatch면 `NEXT_PUBLIC_SITE_URL` 값을 먼저 확인
- smoke가 불안정하면 `PLAYWRIGHT_LIVE_BASE_URL`이 새 도메인인지 확인

## Operational Notes
- Vercel 공식 문서상 domain add는 latest production deployment가 성공 상태여야 안전하다.
- domain을 project에 추가해도 verification이 끝나기 전에는 alias로 실제 serving되지 않을 수 있다.
- DNS record 값은 문서의 예시를 하드코딩하지 않고, Vercel domain inspect가 보여주는 현재 요구값을 그대로 쓴다.
- 이번 리허설의 핵심은 “코드 배포”가 아니라 “도메인/환경/재배포 순서”다.

## Official References
- Vercel custom domain setup
  - <https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel domain inspect
  - <https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel add domain API
  - <https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project>
