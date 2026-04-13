# `www.locally-travel.com` External Console Parity Audit

## Summary
- 이 문서는 `www.locally-travel.com` cutover 전에 확인해야 하는 마지막 `P0` 외부 콘솔 parity를 현재 운영 경로 기준으로 잠그는 close-out 문서다.
- 이번 감사의 blocker 범위는 아래 4개만 포함한다.
  - Google OAuth
  - Kakao OAuth
  - Supabase Auth redirect / Site URL
  - PortOne current live path
- 이번 감사에서 제외한다.
  - NicePay direct provider flip
  - PayPal console parity
  - AdSense 승인/등록
- 현재 확인 가능한 기준 사실
  - Vercel project `locally-web`에는 아직 custom domain이 없고 `*.vercel.app` domain만 연결돼 있다
  - latest production deployment는 `READY`다
  - social login redirect owner는 `window.location.origin/auth/callback?next=...`다
  - 서버 callback owner는 `/auth/callback`이다
  - 카드 provider 기본값은 `portone`이다

## Current Runtime Anchor
- Vercel project
  - project id: `prj_bUhlyw1uuWD3Uxl01Kv4ut5jeFrz`
  - team id: `team_GFZxhmQVWml3ox1z4NyBTSLo`
  - current project domains:
    - `locally-web.vercel.app`
    - `locally-web-locallys-projects-b062321b.vercel.app`
    - `locally-web-git-main-locallys-projects-b062321b.vercel.app`
  - custom domain: 아직 없음
  - latest production deployment: `READY`
- app-side source of truth
  - social login redirect: [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:219)
  - auth callback return owner: [app/auth/callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/auth/callback/route.ts:1)
  - card provider boundary: [app/utils/payments/card/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/server.ts:1)
  - PortOne runtime contract: [app/utils/portone/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/portone/server.ts:1)

## Result Snapshot
| Surface | Code source of truth | External console field to verify | Current observed state | Target | Result |
| --- | --- | --- | --- | --- | --- |
| Google OAuth | `LoginModal` + `/auth/callback` | OAuth client redirect URI | 저장소/현재 환경에서는 콘솔 값 확인 불가. operator evidence 미첨부 | `https://www.locally-travel.com/auth/callback` | `cutover 직전 필요` |
| Kakao OAuth | `LoginModal` + `/auth/callback` | Redirect URI | 저장소/현재 환경에서는 콘솔 값 확인 불가. operator evidence 미첨부 | `https://www.locally-travel.com/auth/callback` | `cutover 직전 필요` |
| Supabase Auth | `/auth/callback` + auth flow docs | Site URL, Redirect URLs | 저장소/현재 환경에서는 콘솔 값 확인 불가. operator evidence 미첨부 | Site URL=`https://www.locally-travel.com`, Redirect URLs에 최소 `https://www.locally-travel.com/auth/callback` 포함 | `cutover 직전 필요` |
| PortOne current live path | card provider=`portone`, PortOne REST verify | domain / allow origin / callback 관련 필드 유무 자체 | 저장소/현재 환경에서는 PortOne 콘솔 값 확인 불가. 현재 코드상 provider는 `portone` | domain 관련 필드가 있으면 `www.locally-travel.com` 기준, 없으면 `not applicable` 증거 확보 | `cutover 직전 필요` |

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

## Thin Verification Already Reconfirmed
- `tests/e2e/108-login-flow-guidance.spec.ts`
- `tests/e2e/128-auth-success-transition.spec.ts`
- 결과: `8 passed`
- 이 rerun이 보장하는 것
  - `/login`의 `returnUrl` 정규화
  - 보호 페이지에서 로그인 후 canonical resume
  - auth success transition이 current callback ownership과 계속 맞물린다는 점

## Final Verdict
- 현재 운영 기준 cutover blocker는 여전히 `외부 콘솔 parity`다.
- 다만 blocker 범위는 이제 명확히 좁혀졌다.
  - Google OAuth
  - Kakao OAuth
  - Supabase Auth
  - PortOne current live path
- 이 문서에 operator evidence가 붙기 전까지는 최종 판정을 `부분 보장`으로 유지한다.
- 위 4개가 모두 `준비됨` 또는 안전한 `cutover 직전 필요`로만 설명되면, 외부 콘솔 parity는 close-out 가능하다.
