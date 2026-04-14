# `www.locally-travel.com` External Console Parity Audit

## Summary
- 이 문서는 `www.locally-travel.com` cutover 전에 확인해야 하는 마지막 `P0` 외부 콘솔 parity를 현재 운영 경로 기준으로 잠그는 close-out 문서다.
- `2026-04-14` live 재확인 기준, 현재 project domain / latest deployment / app-side callback owner는 모두 다시 검증했다.
- 이번 close-out에서 operator가 잠가야 하는 surface는 아래 5개다.
  - Vercel custom domain
  - Google OAuth
  - Kakao OAuth
  - Supabase Auth redirect / Site URL
  - PortOne current live path
- 이번 감사에서 제외한다.
  - NicePay direct provider flip
  - PayPal console parity
  - AdSense 승인/등록
- 현재 확인 가능한 기준 사실
  - 현재 repo에서 확인되는 public site URL anchor는 `https://locally-web.vercel.app`다
  - `https://www.locally-travel.com`은 아직 current runtime owner가 아니라 cutover target이다
  - Vercel project `locally-web`에는 아직 custom domain이 없고 `*.vercel.app` domain만 연결돼 있다
  - latest production deployment는 `READY`다
  - social login redirect owner는 `window.location.origin/auth/callback?next=...`다
  - 서버 callback owner는 `/auth/callback`이다
  - 카드 provider 기본값은 `portone`이다
  - 따라서 현재 남은 일은 “앱 코드 수정”이 아니라 “cutover 시점에 Vercel custom domain을 연결하고, 외부 콘솔에 새 production origin을 허용하는지 증빙하는 것”이다

## Current Runtime Anchor
- Vercel project
  - project id: `prj_bUhlyw1uuWD3Uxl01Kv4ut5jeFrz`
  - team id: `team_GFZxhmQVWml3ox1z4NyBTSLo`
  - framework: `nextjs`
  - live flag: `false`
  - current project domains:
    - `locally-web.vercel.app`
    - `locally-web-locallys-projects-b062321b.vercel.app`
    - `locally-web-git-main-locallys-projects-b062321b.vercel.app`
  - custom domain: 아직 없음
  - latest production deployment:
    - id: `dpl_9GdxYgsHRfWUS2B6KBniL59ozcNf`
    - url: `locally-id8l00z63-locallys-projects-b062321b.vercel.app`
    - state: `READY`
    - target: `production`
- app-side source of truth
  - current repo-configured public site URL: `https://locally-web.vercel.app`
  - cutover target encoded in tests/docs: `https://www.locally-travel.com`
  - social login redirect: [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:219)
  - auth callback return owner: [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
  - runtime site URL guard: [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)
  - card provider boundary: [app/utils/payments/card/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/server.ts:1)
  - PortOne runtime contract: [app/utils/portone/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/portone/server.ts:1)

## Domain Truth Split
- current runtime anchor
  - checked env 기준 `NEXT_PUBLIC_SITE_URL`은 `https://locally-web.vercel.app`다
  - OAuth redirect는 특정 도메인 하드코딩이 아니라 current origin을 따라간다
  - `/auth/callback`은 current request host 기준으로 복귀한다
- cutover target anchor
  - `https://www.locally-travel.com`은 tests/docs에 잠긴 target production owner다
  - 아직 Vercel project domain list에는 붙어 있지 않다
- 따라서 이번 문서의 핵심은 “코드가 어느 도메인을 owner로 삼는가”와 “운영자가 어떤 외부 콘솔 값을 맞춰야 하는가”를 분리해서 보는 것이다

## Repo-Side Close-out
- 이번 패스에서 repo 기준으로 이미 닫힌 사실
  - 소셜 로그인 redirect는 provider별 하드코딩 도메인이 아니라 현재 origin 기준이다.
  - `/auth/callback`은 현재 request host 기준으로 복귀하며, 상대 `next`만 허용하도록 정규화돼 있다.
  - `siteUrl` helper는 production에서 legacy alias fallback 없이 `NEXT_PUBLIC_SITE_URL`만 owner로 사용한다.
  - 카드결제 current provider는 `portone`이고, 코드상 기본 owner는 새 custom domain에 묶여 있지 않다.
  - checked env와 Vercel project domains를 같이 보면, current runtime owner는 아직 `vercel.app`이고 `www.locally-travel.com` cutover는 아직 전 단계다.
- 따라서 현재 남은 parity 리스크는 아래 둘뿐이다.
  - 외부 OAuth/Auth/PG 콘솔이 `https://www.locally-travel.com`을 허용하는지
  - cutover 직전에 Vercel custom domain 연결과 해당 콘솔 값 반영이 실제로 끝났는지

## Result Snapshot
| Surface | Code source of truth | External console field to verify | Current observed state | Target | Result |
| --- | --- | --- | --- | --- | --- |
| Vercel custom domain | Vercel project domain list + `NEXT_PUBLIC_SITE_URL` owner | project domain connection | `www.locally-travel.com`은 아직 project domain list에 없다 | project에 `www.locally-travel.com` 연결 | `cutover 직전 필요` |
| Google OAuth | `LoginModal` + `/auth/callback` | OAuth client redirect URI | 코드상 redirect owner는 current origin 기반이고 current public site anchor는 `https://locally-web.vercel.app`다. 콘솔 값은 저장소에서 확인 불가 | `https://www.locally-travel.com/auth/callback` | `cutover 직전 필요` |
| Kakao OAuth | `LoginModal` + `/auth/callback` | Redirect URI | 코드상 redirect owner는 current origin 기반이고 current public site anchor는 `https://locally-web.vercel.app`다. 콘솔 값은 저장소에서 확인 불가 | `https://www.locally-travel.com/auth/callback` | `cutover 직전 필요` |
| Supabase Auth | `/auth/callback` + auth flow docs | Site URL, Redirect URLs | callback owner는 current host 기반이고 repo-configured site URL은 `https://locally-web.vercel.app`다. 콘솔 값은 저장소에서 확인 불가 | Site URL=`https://www.locally-travel.com`, Redirect URLs에 최소 `https://www.locally-travel.com/auth/callback` 포함 | `cutover 직전 필요` |
| PortOne current live path | card provider=`portone`, PortOne REST verify | domain / allow origin / callback 관련 필드 유무 자체 | 저장소/현재 환경에서는 PortOne 콘솔 값 확인 불가. 현재 코드상 provider는 `portone`, readiness owner는 `NEXT_PUBLIC_PORTONE_IMP_CODE` + server secret pair다 | domain 관련 필드가 있으면 `www.locally-travel.com` 기준, 없으면 `not applicable` 증거 확보 | `cutover 직전 필요` |

## What Is Not A Repo Blocker Anymore
- 아래 항목은 이번 패스 기준으로 “앱 코드 문제”가 아니라 “외부 설정/운영 타이밍 문제”로 분류한다.
  - Google/Kakao login callback owner 자체
  - Supabase callback route 자체
  - PortOne current provider 선택 자체
  - production site URL helper의 legacy fallback 여부 자체
  - Vercel production deployment health 자체
- 즉, 지금 코드베이스 안에서 더 수정한다고 닫히는 종류의 P0는 아니다. 남은 일은 cutover day에 콘솔 값을 맞추고 증빙을 붙이는 것이다.

## Detailed Checks

### 1. Google OAuth
- source of truth
  - [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:219)
  - [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
- 코드 의미
  - Google login 시작점은 `window.location.origin/auth/callback?next=...`
  - callback 성공 후 현재 request host 기준으로 복귀한다
- 콘솔에서 확인할 값
  - OAuth client의 authorized redirect URI
- target
  - `https://www.locally-travel.com/auth/callback`
- 판정 규칙
  - 이미 들어 있으면 `준비됨`
  - cutover 직전에 추가만 하면 되면 `cutover 직전 필요`
  - old domain만 있고 수정 권한/승인 문제가 있으면 `blocker`

### 2. Kakao OAuth
- source of truth
  - [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:219)
  - [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
- 코드 의미
  - Kakao login도 Google과 같은 callback owner를 쓴다
- 콘솔에서 확인할 값
  - Kakao Developers Redirect URI
- target
  - `https://www.locally-travel.com/auth/callback`
- 판정 규칙
  - Google과 동일

### 3. Supabase Auth
- source of truth
  - [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
  - [docs/2026-04-12_account_auth_self_service_e2e_audit.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-12_account_auth_self_service_e2e_audit.md:1)
- 코드 의미
  - callback route는 `next`를 상대경로로 정규화하고 현재 host 기준으로 돌려보낸다
  - 따라서 Supabase 쪽 Site URL / Redirect URLs가 새 도메인을 받아야 한다
- 콘솔에서 확인할 값
  - Site URL
  - Redirect URLs
- target
  - Site URL: `https://www.locally-travel.com`
  - Redirect URLs: 최소 `https://www.locally-travel.com/auth/callback`
  - cutover 전 운영 안전을 위해 현재 `vercel.app` callback이 아직 필요하면 일시 공존은 허용하되, 최종 production owner는 `www.locally-travel.com`로 잠근다
- 판정 규칙
  - Site URL과 Redirect URLs가 둘 다 설명 가능해야 `준비됨`
  - 새 값 추가만 남았으면 `cutover 직전 필요`
  - provider 제약/권한 문제로 넣을 수 없으면 `blocker`

### 4. PortOne Current Live Path
- source of truth
  - [app/utils/payments/card/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/server.ts:1)
  - [app/utils/portone/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/portone/server.ts:1)
  - [docs/2026-04-11_experience_guest_booking_payment_e2e_audit.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/2026-04-11_experience_guest_booking_payment_e2e_audit.md:1)
- 코드 의미
  - current provider는 `portone`
  - readiness는 `NEXT_PUBLIC_PORTONE_IMP_CODE`, `PORTONE_API_KEY`, `PORTONE_API_SECRET` 기준이다
  - browser return과 complete redirect는 현재 production origin 아래에서 작동해야 한다
- 콘솔에서 확인할 값
  - PortOne 콘솔에 실제로 domain / allow origin / callback 관련 설정 항목이 있는지
  - 있다면 새 도메인을 넣어야 하는지
- target
  - 관련 필드가 있으면 `www.locally-travel.com` 기준으로 설명 가능해야 한다
  - 관련 필드가 없으면 `not applicable`로 캡처 증거를 남긴다
- 판정 규칙
  - 새 도메인 기준이 이미 설명 가능하면 `준비됨`
  - cutover 직전에 값 변경만 남았으면 `cutover 직전 필요`
  - old domain 전용 고정, 심사/승인 대기, 권한 부재면 `blocker`

## Evidence Capture Format
- Google Cloud Console
  - redirect URI가 보이는 화면 1장
- Kakao Developers
  - Redirect URI가 보이는 화면 1장
- Supabase Auth
  - Site URL / Redirect URLs가 함께 보이는 화면 1장
- PortOne
  - domain / allow origin / callback 관련 필드가 있으면 그 화면 1장
  - 그런 항목이 없으면 “없음”이 확인되는 운영 화면 1장

## Evidence Tracker
| Surface | Current verdict | Attachment label | Last checked | Status owner |
| --- | --- | --- | --- | --- |
| Vercel custom domain | `cutover 직전 필요` | `vercel-custom-domain-www-locally-travel-com` | `2026-04-14` | operator |
| Google OAuth | `cutover 직전 필요` | `google-oauth-redirect-www-locally-travel-com` | `2026-04-14` | operator |
| Kakao OAuth | `cutover 직전 필요` | `kakao-oauth-redirect-www-locally-travel-com` | `2026-04-14` | operator |
| Supabase Auth | `cutover 직전 필요` | `supabase-auth-site-url-and-redirects-www-locally-travel-com` | `2026-04-14` | operator |
| PortOne current live path | `cutover 직전 필요` | `portone-domain-or-not-applicable-www-locally-travel-com` | `2026-04-14` | operator |

## Release Gate
- surface별 결과는 현재 모두 `cutover 직전 필요`로 설명 가능하다.
- 다만 operator attachment가 아직 비어 있으므로, 현재 release/cutover 판정은 `operational hold`다.
- 이 hold는 코드 결함 때문이 아니라 아래 증빙 공란 때문이다.
  - Vercel custom domain 연결 캡처
  - Google/Kakao redirect URI 캡처
  - Supabase Site URL / Redirect URLs 캡처
  - PortOne domain field 또는 not-applicable 캡처
- 따라서 repo 안에서 추가 코드 수정으로 이 hold를 해소하지 않는다.

## Operator Checklist
- cutover 전에는 아래 5개가 모두 설명 가능해야 한다.
  - Vercel에 `www.locally-travel.com`이 project domain으로 연결돼 있다
  - Google OAuth redirect URI에 `https://www.locally-travel.com/auth/callback`이 있다
  - Kakao Redirect URI에 `https://www.locally-travel.com/auth/callback`이 있다
  - Supabase Site URL이 `https://www.locally-travel.com`이고 Redirect URLs에 callback이 있다
  - PortOne 콘솔이 새 domain에서 막히지 않는다고 설명 가능하거나, domain field가 애초에 없다는 증거가 있다

## Current Practical Verdict
- 지금 시점 기준으로는 “현재 `vercel.app` 운영”에는 blocker가 없다.
- 다만 “`www.locally-travel.com`으로 오늘 바로 cutover 가능한가?”라는 질문에는 아직 `아니오`다.
- 이유는 코드가 아니라 아래 두 가지 운영 증빙이 아직 비어 있기 때문이다.
  - cutover 시점에 Vercel project에 `www.locally-travel.com` custom domain을 실제 연결할 준비가 끝났는지
  - Google/Kakao/Supabase/PortOne 쪽에서 새 production owner를 허용하는지
- 즉, `custom domain을 지금 바로 붙이는 것`이 이번 close-out의 목표는 아니다.
- 이번 close-out의 목표는 `cutover 당일에 무엇을 어디서 바꿔야 하는지`를 모호함 없이 문서로 잠그는 것이다.

## Thin Verification Already Reconfirmed
- `tests/e2e/108-login-flow-guidance.spec.ts`
- `tests/e2e/128-auth-success-transition.spec.ts`
- 결과: `8 passed`
- 이 rerun이 보장하는 것
  - `/login`의 `returnUrl` 정규화
  - 보호 페이지에서 로그인 후 canonical resume
  - auth success transition이 current callback ownership과 계속 맞물린다는 점

## Final Verdict
- 현재 운영 기준 cutover blocker는 `cutover 시점 Vercel custom domain 연결`과 `외부 콘솔 parity evidence`다.
- 다만 blocker 범위는 이제 명확히 아래 5개 surface로 좁혀졌다.
  - Vercel custom domain
  - Google OAuth
  - Kakao OAuth
  - Supabase Auth
  - PortOne current live path
- 현재 surface별 설명은 모두 `cutover 직전 필요`로 정리되지만, operator evidence attachment가 아직 비어 있으므로 오늘 기준 최종 판정은 `operational hold`다.
- 이 hold는 `code blocker`가 아니라 `ops evidence gap`이다.
- 위 5개 attachment가 모두 채워지고 상태가 `준비됨` 또는 설명 가능한 `cutover 직전 필요`로만 남으면, 외부 콘솔 parity는 close-out 가능하다.
