# AdSense Cutover Checklist

## Summary
- 현재 프로젝트는 공개 페이지의 `데스크탑·모바일 반응형 전역 하단` 광고 슬롯을 AdSense에 연결할 수 있게 준비된 상태입니다.
- 기본값은 안전하게 비활성입니다.
  - `NEXT_PUBLIC_ADSENSE_ENABLED`가 없거나 `true`가 아니면 광고 스크립트가 로드되지 않습니다.
  - footer slot env가 비어 있으면 광고와 빈 공간이 모두 나타나지 않습니다.
  - `/ads.txt`도 AdSense client id가 없으면 `404`로 숨겨집니다.
- 2026-07-31 AdSense 콘솔 확인 결과 `자동 광고`와 `자동 최적화`가 켜져 있습니다.
  - DNS가 Vercel로 완전히 안정화되기 전에는 기존 아임웹 광고에 영향을 줄 수 있으므로 변경하지 않습니다.
  - 신규 사이트 광고를 활성화하기 직전에 두 설정을 모두 끄고 수동 footer 슬롯만 사용합니다.
- cutover 목표는 `코드 수정 없이` 아래 4가지만 바꾸는 것입니다.
  - 최종 도메인 연결
  - Vercel env 입력
  - AdSense 사이트/도메인 확인
  - 최종 smoke check
- same-domain 운영 원칙도 같이 잠급니다.
  - 이미 기존 웹사이트에서 같은 `www.locally-travel.com` 도메인을 같은 AdSense 계정으로 운영 중이면, cutover 뒤에도 기본적으로 그 site ownership을 재사용하는 쪽이 가장 단순합니다
  - 반대로 현재 AdSense 계정에 그 도메인이 없거나 `Ready` 상태가 아니라면, 그때만 새 site 추가/검토 요청이 필요합니다

## Source Of Truth
- 조건부 AdSense 로드 경계: [DesktopFooterAdSlot.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/DesktopFooterAdSlot.tsx)
- env / slot 해석 helper: [app/utils/adsense.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/adsense.ts:1)
- 반응형 전역 하단 슬롯: [app/components/DesktopFooterAdSlot.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/DesktopFooterAdSlot.tsx:1)
- 공개 경로 판정: [app/utils/desktopFooterAd.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/desktopFooterAd.ts:1)
- `ads.txt` 공개 경로: [app/ads.txt/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/ads.txt/route.ts:1)
- 롤백용 legacy 커뮤니티 슬롯 owner: [app/community/components/CommunityAdSlot.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/components/CommunityAdSlot.tsx:1)
- 현재 site URL single source: [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)

## Env Contract
- 필수 env
  - `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
  - `NEXT_PUBLIC_ADSENSE_ENABLED=true`
  - `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...`
- `NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT`
- 사용하지 않는 커뮤니티 수동 슬롯 env는 입력하지 않습니다.
  아래 값들은 향후 커뮤니티 광고를 다시 사용할 때만 선택적으로 설정합니다.
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT`
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_BOTTOM_SLOT`
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_SIDEBAR_SLOT`
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_BOTTOM_SLOT`
- 현재 제품 의미
  - 콘텐츠가 충분한 공개 페이지 데스크탑·모바일: 공통 푸터 아래 반응형 1개
  - 공개 커뮤니티 목록·indexable 상세와 `/services/intro`도 공통 슬롯 사용
  - 사이트맵, 관리자, 회원 전용, 작성, 예약·결제, `noindex` 화면: 0개
  - 광고가 없는 커뮤니티 화면에는 placeholder나 빈 광고 공간도 표시하지 않음
  - 공개 개인정보처리방침: `https://www.locally-travel.com/privacy`

## Cutover Day Checklist
1. Vercel에 최종 도메인 `www.locally-travel.com`을 이 프로젝트로 연결합니다.
   아직 기존 사이트가 live라면 DNS cutover 전 preview/production 대상과 TTL 상태를 먼저 확인합니다.
2. `NEXT_PUBLIC_SITE_URL`을 최종 도메인으로 바꿉니다.
   production runtime은 더 이상 legacy alias fallback을 허용하지 않으므로, cutover 전까지는 현재 운영 owner를 env에 그대로 두고 cutover 시점에만 `https://www.locally-travel.com`으로 교체합니다.
   이 값이 잘못되거나 비어 있으면 production은 fail-closed 되므로, domain 연결과 env 저장, redeploy 반영을 같은 배치로 확인해야 합니다.
3. AdSense에서 최종 도메인의 현재 상태를 먼저 확인합니다.
   - 이미 같은 AdSense 계정의 `Sites` 목록에 `www.locally-travel.com`이 있고 상태가 `Ready`면 새 site를 다시 만들지 않습니다
   - 없다면 그때만 새 site로 추가하고 검토를 요청합니다
   - 핵심은 `vercel.app`를 광고 사이트 owner로 삼는 것이 아니라 최종 운영 도메인만 owner로 두는 것입니다
   - 계정의 Auto ads와 자동 최적화를 모두 OFF로 바꿉니다. 이번 구현은 수동 footer 슬롯만 관리합니다
   - Google 인증 CMP의 유럽 규정 메시지와 미국 주 규정 메시지를 게시하고 개인정보처리방침 URL을 `/privacy`로 설정합니다
4. Vercel production env에 AdSense env를 입력합니다.
   먼저 `NEXT_PUBLIC_ADSENSE_CLIENT_ID`와 `NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT`을 넣고, 마지막에만 `NEXT_PUBLIC_ADSENSE_ENABLED=true`를 켭니다.
5. redeploy 합니다.
   이번 구조는 env 기반이므로, 값만 바꾸고 새 배포가 나가면 코드 수정 없이 활성화됩니다.
6. `ads.txt`를 먼저 확인합니다.
   `https://www.locally-travel.com/ads.txt`가 `google.com, pub-..., DIRECT, f08c47fec0942fa0` 한 줄로 열려야 합니다.
7. 페이지 소스와 슬롯 초기화를 확인합니다.
   홈, 회사 페이지, 공개 체험·커뮤니티 상세, 서비스 소개에서 AdSense 스크립트와 전역 `<ins class="adsbygoogle">`가 정확히 1개 들어가는지 확인합니다.
   사이트맵, 로그인·결제·작성·회원 전용·`noindex` 화면에는 광고 DOM이 없어야 합니다.
   직접 접속 기준으로 광고 제외 화면에는 AdSense script도 없어야 합니다.
8. 실제 노출 smoke를 합니다.
   광고가 즉시 안 보이더라도, DOM 주입과 콘솔 오류 유무를 먼저 봅니다.
   AdSense 승인은 즉시 반영되지 않을 수 있으므로 `스크립트 로드 성공`과 `slot 초기화 오류 없음`을 우선 통과 기준으로 둡니다.

## AdSense Site Decision
- case 1. 기존 same-domain site가 같은 AdSense 계정에 이미 있음
  - 가장 쉬운 경로입니다
  - `www.locally-travel.com`의 기존 site ownership을 유지하고, 새 프로젝트 쪽에서는 도메인 cutover + env + redeploy만 수행합니다
  - 이 경우 핵심 확인은 아래 셋입니다
    - 새 페이지에 publisher id가 동일하게 들어가는지
    - `/ads.txt`가 같은 publisher id로 응답하는지
    - 공개 데스크탑 페이지 하단에 실제 `<ins class="adsbygoogle">`가 렌더되는지
- case 2. 같은 계정에 site가 없거나 Ready가 아님
  - `www.locally-travel.com`을 새 site로 추가하고 검토를 요청합니다
  - 이 경우 cutover 직후 즉시 광고가 뜨지 않아도 이상이 아닐 수 있습니다
  - 공식 가이드 기준으로 site review는 며칠 이상 걸릴 수 있고, 경우에 따라 더 길어질 수 있습니다
- case 3. 다른 AdSense 계정에만 묶여 있음
  - cutover 전에 어느 계정을 최종 owner로 쓸지부터 정리해야 합니다
  - 서로 다른 계정에서 같은 도메인 운영 의미가 충돌하면 이번 cutover 번들은 열지 않는 편이 안전합니다

## Verification
- 요청 기반 확인
  - `GET /ads.txt`가 200이어야 합니다.
  - `robots.txt`, `sitemap.xml`, canonical이 모두 `www.locally-travel.com` 기준으로 보이는지 확인합니다.
- 화면 확인
  - 콘텐츠가 충분한 공개 페이지 데스크탑·모바일: 공통 푸터 아래 1개
  - 사이트맵, 관리자, 회원 전용, 작성, 예약·결제, `noindex` 화면: 0개
- DOM/콘솔 확인
  - `view-source:` 또는 devtools에서 `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` 스크립트가 로드되는지
  - 각 광고 슬롯 내부에 `<ins class="adsbygoogle">`가 있는지
  - `adsbygoogle.push()` 관련 오류가 없는지
- 시간 기대치
  - `ads.txt` 변경은 즉시 반영되지 않을 수 있습니다
  - Google 측 `ads.txt` 크롤 반영과 site review 반영은 짧게는 수일, 길게는 더 오래 걸릴 수 있으므로, cutover 당일의 pass 기준은 `코드/도메인/ads.txt/DOM 계약 정상`으로 잡는 것이 맞습니다

## Rollback
- 가장 안전한 rollback은 `NEXT_PUBLIC_ADSENSE_ENABLED=false` 또는 env 제거 후 redeploy 입니다.
- slot env만 제거해도 해당 자리만 placeholder/no-op로 돌아갑니다.
- `ads.txt`를 즉시 숨겨야 하면 `NEXT_PUBLIC_ADSENSE_CLIENT_ID`를 제거하고 redeploy 하면 됩니다.

## Defaults Locked
- 이번 cutover는 `자동 광고`가 아니라 `수동 슬롯`만 기준입니다.
- AdSense 계정의 Auto ads와 자동 최적화는 OFF로 유지합니다.
- 광고 surface는 콘텐츠가 충분한 공개 페이지의 데스크탑·모바일 공통 푸터 아래로 한정합니다.
- 사용하지 않는 커뮤니티 광고 슬롯은 활성화하지 않습니다.
- 커뮤니티 데이터, 댓글/좋아요/조회수, SEO 메타 구조는 이번 cutover에서 건드리지 않습니다.

## Official References
- AdSense ads.txt guide
  - <https://support.google.com/adsense/answer/7532444?hl=en>
- AdSense ads.txt crawl timing and troubleshooting
  - <https://support.google.com/adsense/answer/7679060?hl=en>
- AdSense add a new site to your sites list
  - <https://support.google.com/adsense/answer/12169212?hl=en>
- AdSense site management
  - <https://support.google.com/adsense/answer/12131223?hl=en>
