# Domain Cutover Preflight Checklist

## Summary
- 이 문서는 `www.locally-travel.com`을 현재 `locally-web` Vercel 프로젝트로 가져오기 직전의 사전 점검표다.
- 목적은 단순하다.
  - 도메인 연결 당일에 `SEO / 광고 / 결제 / 라이브 검증`이 서로 다른 도메인을 보지 않게 미리 잠그는 것
  - 코드 수정 없이 `도메인 연결 + env 전환 + 재배포`만으로 전환 가능한 상태를 만드는 것
- 이번 전환의 검색엔진 의미도 같이 고정한다.
  - 이 작업은 `새 도메인으로 사이트를 옮기는 site move`가 아니라, `같은 공개 URL(www.locally-travel.com)을 새 호스팅/Vercel 프로젝트로 옮기는 host migration`에 가깝다
  - 따라서 Google Search Console의 Change of Address tool 대상이 아니다
- 현재 기준 사실
  - Vercel project: `locally-web`
  - project id: `prj_bUhlyw1uuWD3Uxl01Kv4ut5jeFrz`
  - team id: `team_GFZxhmQVWml3ox1z4NyBTSLo`
  - custom domain은 아직 연결되지 않았고, 현재 project domain은 `*.vercel.app`만 존재한다
  - latest production deployment는 `READY` 상태다

## Source Of Truth
- site URL single source: [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)
- root metadata / canonical base: [app/layout.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/layout.tsx:54)
- robots / sitemap: [app/robots.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/robots.ts:1), [app/sitemap.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/sitemap.ts:131)
- OG image base URL: [app/opengraph-image.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/opengraph-image.tsx:1)
- AdSense cutover contract: [docs/adsense-cutover-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/adsense-cutover-checklist.md:1)
- Vercel cutover rehearsal: [docs/2026-04-13_vercel_domain_cutover_rehearsal.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_vercel_domain_cutover_rehearsal.md:1)
- production env input sheet: [docs/2026-04-13_cutover_day_production_env_input_sheet.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_cutover_day_production_env_input_sheet.md:1)
- remaining product risks close-out: [docs/2026-04-13_cutover_remaining_product_risks.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_cutover_remaining_product_risks.md:1)
- external console parity audit: [docs/2026-04-13_external_console_parity_audit.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_external_console_parity_audit.md:1)
- Search Console / Naver ops contract: [docs/2026-04-13_locally_content_search_console_ops_checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-13_locally_content_search_console_ops_checklist.md:1)
- NicePay cutover contract: [docs/payments/nicepay-cutover-checklist.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/payments/nicepay-cutover-checklist.md:1)
- live smoke launcher: [scripts/run-live-smoke.mjs](/Users/hyungeunseanson/Documents/서비스/locally-web/scripts/run-live-smoke.mjs:94)

## Preflight Checks
### 1. Vercel / Domain Ownership
- `www.locally-travel.com`과 필요 시 apex `locally-travel.com`의 DNS 수정 권한이 실제로 있는지 확인한다.
- 현재 이전 사이트가 같은 도메인을 쓰고 있으므로, cutover 창구와 TTL 조정 가능 여부를 먼저 확인한다.
- Vercel 공식 기준으로 apex와 `www`는 별도 project domain으로 다뤄질 수 있으므로 둘 다 연결 전략을 정한다.
  - 기본 권장안: `www.locally-travel.com`을 primary production domain으로 사용
  - apex `locally-travel.com`은 `www`로 redirect
- Vercel project의 latest production deployment가 성공 상태인지 cutover 직전에 다시 확인한다.
  - 실패한 production 배포 상태에서는 domain add가 막힐 수 있다

### 2. Site URL / SEO / Metadata Parity
- `NEXT_PUBLIC_SITE_URL`은 cutover 전까지 현재 실제 운영 도메인 기준으로 유지한다.
- cutover 시점에만 `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`으로 바꾼다.
- 아래 surface들이 모두 `NEXT_PUBLIC_SITE_URL`에 묶여 있으므로, 이 env가 바뀌면 같이 전환된다고 본다.
  - metadataBase
  - canonical / alternates
  - `robots.txt` 내 sitemap 링크
  - `sitemap.xml`
  - OG image base URL
  - email absolute links
- cutover 전 금지
  - 도메인은 아직 이전 사이트인데 `NEXT_PUBLIC_SITE_URL`만 미리 `www.locally-travel.com`으로 바꾸는 것
- 검색엔진 운영 원칙
  - 이번 전환은 Google의 `Change of Address` 대상이 아니다
  - 이유는 최종 공개 URL을 `www.locally-travel.com`으로 계속 유지할 계획이기 때문이다
  - 즉 검색엔진에는 “새 도메인으로 이사”를 알리는 것이 아니라, 새 배포가 같은 canonical URL을 계속 안정적으로 응답한다는 사실이 더 중요하다
  - `www`와 apex를 함께 쓰더라도, 공식 primary는 `www` 하나로 잠그고 apex는 `301` redirect만 둔다

### 3. 광고 / AdSense 준비
- AdSense는 현재 `로컬리 콘텐츠 수동 슬롯`만 준비돼 있다.
- cutover 직전까지는 다음 기본값 유지가 안전하다.
  - `NEXT_PUBLIC_ADSENSE_ENABLED` 비활성
  - 또는 client/slot env 미입력
- cutover day에는 아래 순서만 허용한다.
  1. 도메인 연결
  2. `NEXT_PUBLIC_SITE_URL` 변경
  3. `NEXT_PUBLIC_ADSENSE_CLIENT_ID`와 slot env 입력
  4. 마지막에 `NEXT_PUBLIC_ADSENSE_ENABLED=true`
  5. redeploy
- `/ads.txt`는 client id가 없으면 404이므로, 광고 cutover 전에는 숨겨져 있어도 정상으로 본다.

### 4. 결제 / 외부 연동 경계
- 현재 카드결제는 운영 기준 `portone` default이고, NicePay direct는 cutover checklist가 별도로 있다.
- 도메인 전환 전 반드시 확인할 것
  - PG 콘솔에 등록된 return/notification URL이 이전 사이트 도메인에 묶여 있지 않은지
  - PortOne / NicePay / PayPal 운영 계정에서 도메인 allowlist 또는 callback 등록이 필요한지
  - 현재 클라이언트 결제 페이지는 `window.location.origin` 또는 `new URL(request.url).origin`을 쓰는 경로가 섞여 있으므로, production 도메인 실제 응답 origin이 새 도메인으로 바뀌는지만 확인하면 된다
- 특히 확인할 경계
  - experience card launch / relay
  - service payment complete redirect
  - proxy inquiry redirect and payment callback

### 5. 라이브 검증 경계
- `scripts/run-live-smoke.mjs`는 `PLAYWRIGHT_LIVE_BASE_URL` 또는 `NEXT_PUBLIC_SITE_URL`을 읽는다.
- 하지만 일부 live E2E는 아직 `https://locally-web.vercel.app`를 하드코딩하고 있다.
  - `tests/e2e/03-live-host-signup-registration.spec.ts`
  - `tests/e2e/04-live-host-experience-create.spec.ts`
  - `tests/e2e/05-live-guest-booking-messaging-support.spec.ts`
  - `tests/e2e/23-live-guest-post-booking.spec.ts`
  - `tests/e2e/31-live-guest-trip-cancel.spec.ts`
- 따라서 cutover day에 live smoke를 돌릴 계획이면, 이 hardcoded base URL들을 먼저 정리하거나 이번 전환에는 `scripts/run-live-smoke.mjs` 기반 smoke만 공식 기준으로 쓴다.

## Cutover Day Sequence
1. Vercel에 `www.locally-travel.com`을 현재 project에 연결한다.
2. apex `locally-travel.com` 처리 정책을 확정한다.
   기본값은 `www` redirect다.
3. DNS propagation과 verification 상태를 확인한다.
4. production env를 아래 순서로 갱신한다.
   - `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
   - 필요 시 `PLAYWRIGHT_LIVE_BASE_URL=https://www.locally-travel.com`
   - 광고를 같이 열면 AdSense env 입력
5. production redeploy
6. 아래 URL을 즉시 smoke 한다.
   - `/`
   - `/search`
   - `/community`
   - representative `/community/[id]`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/ads.txt` if AdSense enabled
7. 결제/로그인/이메일 absolute link를 샘플링한다.

## Acceptance Checks
- 브라우저 주소창 기준 production이 새 도메인에서 정상 응답한다.
- page source 기준 canonical, OG URL, structured data URL이 새 도메인을 가리킨다.
- `robots.txt`의 sitemap 링크가 새 도메인이다.
- `sitemap.xml` 내부 URL이 새 도메인이다.
- AdSense를 열었다면 `/ads.txt`가 200이고, 커뮤니티 슬롯에 `<ins class="adsbygoogle">`가 들어간다.
- payment / auth redirect가 이전 `vercel.app`로 튀지 않는다.
- sample email CTA absolute link가 새 도메인이다.

## Rollback
- 가장 안전한 rollback은 DNS와 domain mapping을 이전 상태로 되돌리는 것이다.
- 광고만 문제면 `NEXT_PUBLIC_ADSENSE_ENABLED=false`로 끄고 redeploy 한다.
- SEO mismatch면 우선 `NEXT_PUBLIC_SITE_URL`과 latest production deployment를 확인한다.
- cutover day 이슈의 1순위 의심 지점은 코드보다 아래 셋이다.
  - domain mapping
  - `NEXT_PUBLIC_SITE_URL`
  - redeploy 반영 여부

## Follow-up Recommended
- Vercel project에 apex / `www` 중 무엇을 primary로 둘지 운영 결론 확정
- PortOne / NicePay / PayPal / AdSense 콘솔의 production domain 등록 상태 재확인

## Official References
- Vercel custom domain setup
  - <https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel project domain API
  - <https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project>
- Google site move with URL changes
  - <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>
- Google Change of Address tool
  - <https://support.google.com/webmasters/answer/9370220?hl=en>
