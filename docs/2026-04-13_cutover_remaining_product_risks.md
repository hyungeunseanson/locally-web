# `www.locally-travel.com` Cutover Remaining Product Risks

## Summary
- 이 문서는 `www.locally-travel.com` cutover 전까지 남아 있는 실제 제품 리스크를 current code + current docs + 얇은 rerun 기준으로 잠그는 close-out 문서다.
- 현재 기준 결론은 아래처럼 정리된다.
  - core runtime은 대체로 준비돼 있다
  - 가장 큰 남은 blocker는 앱 코드가 아니라 `OAuth / PG / 외부 콘솔 허용 URL parity`다
  - 앱 안쪽에서 남아 있는 리스크는 `silent old-alias fallback 운영 리스크` 정도로 더 좁혀졌다
- 최신 얇은 rerun 결과
  - `29-sitemap`
  - `171-live-base-url-contract`
  - `62-community-author-modal`
  - 결과: `8 passed`

## Result Snapshot
| Risk | Source of truth | Current verification | Result | Notes |
| --- | --- | --- | --- | --- |
| OAuth / PG external parity | `LoginModal`, `/auth/callback`, external console parity audit | static audit + auth rerun | 부분 보장 | blocker 범위는 `Google / Kakao / Supabase / PortOne current live path`로 좁혔지만, operator evidence는 아직 없다 |
| Live smoke / legacy domain drift | `tests/e2e/helpers/liveBaseUrl.ts`, `171`, `29`, `62` | `171`, `29`, `62` | 정상 | live helper는 env 없을 때 명시적으로 실패하고, domain-sensitive assertion은 configured site URL 기준으로 잠겼다 |
| Silent old-alias fallback | `app/utils/siteUrl.ts`, `app/opengraph-image.tsx` | static audit + live preflight docs | 부분 보장 | 앱이 깨지지는 않지만, env/redeploy 미반영 시 old alias가 조용히 계속 노출될 수 있다 |

## Detailed Findings

### 1. `P0` external console / allowlist parity가 여전히 가장 큰 실제 blocker다
- source of truth
  - [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:219)
  - [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
  - [docs/2026-04-13_external_console_parity_audit.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_external_console_parity_audit.md:1)
  - [docs/domain-cutover-preflight-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/domain-cutover-preflight-checklist.md:1)
- 현재 코드 의미
  - social login은 `window.location.origin/auth/callback?next=...`로 시작한다
  - `/auth/callback`은 현재 요청 host 기준으로 세션 교환 후 복귀한다
  - 현재 운영 기준 card provider는 `portone`이고, cutover blocker audit도 `PortOne current live path`까지만 포함한다
- 실제 리스크
  - Google OAuth, Kakao OAuth, Supabase redirect allowlist에 `https://www.locally-travel.com/auth/callback`가 없으면 cutover 후 로그인 복귀가 실패할 수 있다
  - PortOne current live path가 새 도메인 production origin에서 막히면 cutover 후 카드 결제가 실패할 수 있다
- 현재 판정
  - `부분 보장`
  - 이유: blocker 범위는 좁혔지만, 외부 콘솔의 실제 등록 상태는 저장소만으로 확인할 수 없다
- close-out 기준
  - operator evidence로 `준비됨 / cutover 직전 필요 / blocker` 중 하나를 붙여야 한다

### 2. live smoke / domain-sensitive assertion drift는 이번 패스로 닫혔다
- source of truth
  - [tests/e2e/helpers/liveBaseUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/helpers/liveBaseUrl.ts:1)
  - [tests/e2e/171-live-base-url-contract.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/171-live-base-url-contract.spec.ts:1)
  - [tests/e2e/29-sitemap.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/29-sitemap.spec.ts:1)
  - [tests/e2e/62-community-author-modal.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/62-community-author-modal.spec.ts:1)
- 현재 동작
  - live helper는 `PLAYWRIGHT_LIVE_BASE_URL` 우선, 없으면 `NEXT_PUBLIC_SITE_URL`, 둘 다 없으면 `null`을 반환한다
  - live 실행이 실제로 필요한 경로는 env가 없을 때 즉시 에러를 던진다
  - sitemap / community structured data assertion은 configured `NEXT_PUBLIC_SITE_URL` 기준으로 기대값을 계산한다
- rerun 결과
  - `171` green
  - `29` green
  - `62` green
- 현재 판정
  - `정상`

### 3. `NEXT_PUBLIC_SITE_URL` 미반영 시 앱은 버티지만 old alias가 조용히 남을 수 있다
- source of truth
  - [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)
  - [app/opengraph-image.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/opengraph-image.tsx:8)
  - [app/utils/publicMetadata.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/publicMetadata.ts:1)
- 현재 동작
  - `NEXT_PUBLIC_SITE_URL`가 비어 있으면 fallback으로 `https://locally-web.vercel.app`를 쓴다
  - metadata / canonical / robots / sitemap / OG / email absolute link는 대부분 이 helper를 통해 같은 값을 본다
- 실제 리스크
  - cutover day에 env 저장 또는 redeploy 반영이 꼬여도 앱이 아예 죽지는 않는다
  - 대신 canonical/OG/sitemap이 조용히 old alias를 계속 내보낼 수 있어 운영자가 늦게 눈치챌 수 있다
- 현재 판정
  - `부분 보장`
  - 즉 코드 버그라기보다 `runtime verification 강화 필요` 영역이다

## What Is Already Safe
- 대부분의 public metadata / canonical / OG / structured data absolute URL은 `NEXT_PUBLIC_SITE_URL` 단일 source를 따른다
- OAuth 복귀 라우트와 browser-side payment return은 현재 origin 기반이라 앱 내부 하드코딩 도메인 리스크는 크지 않다
- cutover 기준 문서 세트는 이미 정리돼 있다
  - [docs/domain-cutover-preflight-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/domain-cutover-preflight-checklist.md:1)
  - [docs/2026-04-13_external_console_parity_audit.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_external_console_parity_audit.md:1)
  - [docs/2026-04-13_vercel_domain_cutover_rehearsal.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_vercel_domain_cutover_rehearsal.md:1)
  - [docs/2026-04-13_cutover_day_production_env_input_sheet.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_cutover_day_production_env_input_sheet.md:1)

## Recommended Next Order
1. external console parity를 operator evidence로 닫는다
   - Google OAuth
   - Kakao OAuth
   - Supabase Site URL / redirect allowlist
   - PortOne current live path
2. cutover day pass 기준을 env 저장이 아니라 live response 기준으로만 운영한다

## Final Verdict
- 현재 기준으로 앱 core runtime은 cutover-ready에 가깝다
- 남은 진짜 blocker는 `외부 콘솔 허용 URL parity`
- 앱 안쪽에서 다음으로 정리할 가치가 큰 것은 `silent old-alias fallback 운영 리스크`
