# Cutover Day Production Env Input Sheet

## Summary
- 이 문서는 `www.locally-travel.com` cutover 당일에 Vercel production env에 실제로 넣을 값만 한 장으로 정리한 실행 시트다.
- 목적은 단순하다.
  - cutover 당일에 무엇을 바꾸고 무엇을 그대로 둘지 헷갈리지 않게 하기
  - `NEXT_PUBLIC_SITE_URL`, live smoke base URL, AdSense env를 잘못된 순서로 저장하는 실수를 막기
- 이 문서는 코드 변경 문서가 아니다.
  - 대상은 `production env 입력 순서`와 `값`이다
  - 최종 smoke와 DNS/domain 연결 순서는 기존 cutover 문서를 따른다

## Source Of Truth
- preflight: [docs/domain-cutover-preflight-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/domain-cutover-preflight-checklist.md:1)
- rehearsal: [docs/2026-04-13_vercel_domain_cutover_rehearsal.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_vercel_domain_cutover_rehearsal.md:1)
- AdSense: [docs/adsense-cutover-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/adsense-cutover-checklist.md:1)
- site URL owner: [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)
- live smoke base URL owner: [scripts/run-live-smoke.mjs](/Users/hyungeunseanson/Documents/서비스/locally-web/scripts/run-live-smoke.mjs:94)
- live domain response gate owner: [scripts/check-live-domain-parity.mjs](/Users/hyungeunseanson/Documents/서비스/locally-web/scripts/check-live-domain-parity.mjs:1)
- AdSense env owner: [app/utils/adsense.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/adsense.ts:1)

## Current Runtime Baseline
- live 응답 기준 현재 production runtime 해석은 아래처럼 잠근다.
  - effective `NEXT_PUBLIC_SITE_URL`: `https://locally-web.vercel.app`
  - effective AdSense state: off
  - official pre-cutover smoke base URL: `https://locally-web.vercel.app`
- 따라서 cutover 당일에는 이 기준에서 아래 target 값으로 옮긴다고 이해하면 된다.

## Decision Lock
- primary production domain은 `https://www.locally-travel.com`이다.
- apex `https://locally-travel.com`은 redirect-only다.
- production env는 domain verification이 끝난 뒤에만 바꾼다.
- 광고를 같은 날 열지 않으면 AdSense env는 손대지 않는다.
- payment, mail, Supabase, auth 관련 env는 이번 묶음에서 건드리지 않는다.

## Production Env Sheet
### 1. 반드시 바꾸는 값
| key | current runtime 기준 | target value | when |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://locally-web.vercel.app` | `https://www.locally-travel.com` | domain verification 완료 직후 |
| `PLAYWRIGHT_LIVE_BASE_URL` | 비어 있거나 기존 smoke 값 | `https://www.locally-travel.com` | live smoke를 새 도메인 기준으로 돌릴 때 |

### 2. 광고를 여는 날에만 넣는 값
| key | target value | note |
| --- | --- | --- |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | `ca-pub-...` | 기존 AdSense publisher 기준 |
| `NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT` | slot id | 숫자 문자열 |
| `NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_BOTTOM_SLOT` | slot id | 숫자 문자열 |
| `NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_SIDEBAR_SLOT` | slot id | 숫자 문자열 |
| `NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_BOTTOM_SLOT` | slot id | 숫자 문자열 |
| `NEXT_PUBLIC_ADSENSE_ENABLED` | `true` | 항상 마지막에만 저장 |

### 3. 이번 cutover에서 건드리지 않는 값
- `CARD_PAYMENT_PROVIDER`
- `PORTONE_*`
- `NICEPAY_*`
- `PAYPAL_*`
- `SUPABASE_*`
- `GMAIL_*`
- `ADMIN_GMAIL_*`
- 기타 mail, cron, analytics, feature flag env

## Input Order
### A. 광고를 아직 열지 않는 경우
1. `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
2. 필요 시 `PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com`
3. production redeploy
4. smoke

### B. 광고도 같은 날 여는 경우
1. `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
2. 필요 시 `PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com`
3. `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
4. 4개 community slot env
5. 마지막에만 `NEXT_PUBLIC_ADSENSE_ENABLED=true`
6. production redeploy
7. `ads.txt`와 community 슬롯 smoke

## Copy Blocks
### 1. No-AdSense Cutover
```dotenv
NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com
PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com
```

### 2. AdSense Included Cutover
```dotenv
NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com
PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-REPLACE_ME
NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT=REPLACE_ME
NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_BOTTOM_SLOT=REPLACE_ME
NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_SIDEBAR_SLOT=REPLACE_ME
NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_BOTTOM_SLOT=REPLACE_ME
NEXT_PUBLIC_ADSENSE_ENABLED=true
```

## No-Go Rules
- `www.locally-travel.com` verification이 끝나기 전에 `NEXT_PUBLIC_SITE_URL`를 먼저 바꾸지 않는다.
- `NEXT_PUBLIC_ADSENSE_ENABLED=true`를 slot/client env보다 먼저 켜지 않는다.
- cutover 당일에 payment provider env까지 같이 바꾸지 않는다.
- unique deployment URL을 smoke target으로 쓰지 않는다.

## Immediate Smoke After Redeploy
- `https://www.locally-travel.com/`
- `https://www.locally-travel.com/community`
- `https://www.locally-travel.com/robots.txt`
- `https://www.locally-travel.com/sitemap.xml`
- `https://www.locally-travel.com/ads.txt` if AdSense enabled

## Pass Criteria
- canonical / sitemap / OG base URL이 `https://www.locally-travel.com` 기준으로 바뀐다.
- apex는 `https://www.locally-travel.com`으로 redirect 된다.
- `scripts/run-live-smoke.mjs`가 새 도메인을 base URL로 읽는다.
- `node scripts/check-live-domain-parity.mjs`가 통과한다.
- 광고를 연 날이면 `/ads.txt`가 `200`이고, community slot이 실제 AdSense branch를 탄다.

## Operator Note
- 이 시트는 “입력값”만 정리한 문서다.
- DNS 레코드 값, Vercel domain verification, Search Console 제출 순서는 기존 rehearsal/preflight 문서를 따른다.
