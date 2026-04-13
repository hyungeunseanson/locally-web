# AdSense Cutover Checklist

## Summary
- 현재 프로젝트는 `로컬리 콘텐츠` 광고 슬롯만 AdSense에 연결할 수 있게 1차 준비가 끝난 상태입니다.
- 기본값은 안전하게 비활성입니다.
  - `NEXT_PUBLIC_ADSENSE_ENABLED`가 없거나 `true`가 아니면 전역 스크립트가 로드되지 않습니다.
  - slot env가 비어 있으면 기존 placeholder만 보이고 실제 광고는 뜨지 않습니다.
  - `/ads.txt`도 AdSense client id가 없으면 `404`로 숨겨집니다.
- cutover 목표는 `코드 수정 없이` 아래 4가지만 바꾸는 것입니다.
  - 최종 도메인 연결
  - Vercel env 입력
  - AdSense 사이트/도메인 확인
  - 최종 smoke check

## Source Of Truth
- 전역 AdSense 로드 경계: [app/layout.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/layout.tsx:126)
- env / slot 해석 helper: [app/utils/adsense.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/adsense.ts:1)
- `ads.txt` 공개 경로: [app/ads.txt/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/ads.txt/route.ts:1)
- 목록/상세 광고 슬롯 owner: [app/community/components/CommunityAdSlot.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/components/CommunityAdSlot.tsx:1)
- 목록 광고 배치: [app/community/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/page.tsx:396)
- 상세 광고 배치: [app/community/[id]/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/community/%5Bid%5D/page.tsx:392)
- 현재 site URL single source: [app/utils/siteUrl.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/siteUrl.ts:1)

## Env Contract
- 필수 env
  - `NEXT_PUBLIC_SITE_URL=https://www.locally-travel.com`
  - `NEXT_PUBLIC_ADSENSE_ENABLED=true`
  - `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-...`
- 커뮤니티 수동 슬롯 env
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT`
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_BOTTOM_SLOT`
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_SIDEBAR_SLOT`
  - `NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_BOTTOM_SLOT`
- 현재 제품 의미
  - 목록 데스크탑: 우측 1개 + 하단 1개
  - 목록 모바일: 하단 1개
  - 상세 데스크탑: 우측 1개 + 하단 1개
  - 상세 모바일: 하단 1개

## Cutover Day Checklist
1. Vercel에 최종 도메인 `www.locally-travel.com`을 이 프로젝트로 연결합니다.
   아직 기존 사이트가 live라면 DNS cutover 전 preview/production 대상과 TTL 상태를 먼저 확인합니다.
2. `NEXT_PUBLIC_SITE_URL`을 최종 도메인으로 바꿉니다.
   기본 fallback은 `https://locally-web.vercel.app`이므로, 이 값이 바뀌지 않으면 canonical/robots/sitemap/ads.txt가 모두 임시 도메인을 계속 가리킵니다.
3. AdSense에서 최종 도메인을 사이트로 확인합니다.
   임시 Vercel 도메인이 아니라 실제 운영 도메인 기준으로 승인/연결 상태를 맞춥니다.
4. Vercel production env에 AdSense env를 입력합니다.
   먼저 `NEXT_PUBLIC_ADSENSE_CLIENT_ID`와 4개 slot id를 넣고, 마지막에만 `NEXT_PUBLIC_ADSENSE_ENABLED=true`를 켭니다.
5. redeploy 합니다.
   이번 구조는 env 기반이므로, 값만 바꾸고 새 배포가 나가면 코드 수정 없이 활성화됩니다.
6. `ads.txt`를 먼저 확인합니다.
   `https://www.locally-travel.com/ads.txt`가 `google.com, pub-..., DIRECT, f08c47fec0942fa0` 한 줄로 열려야 합니다.
7. 페이지 소스와 슬롯 초기화를 확인합니다.
   `/community?category=locally_content`
   `/community/[id]`의 locally content 상세
   두 경로 모두에서 AdSense 스크립트와 `<ins class="adsbygoogle">`가 들어가는지 확인합니다.
8. 실제 노출 smoke를 합니다.
   광고가 즉시 안 보이더라도, DOM 주입과 콘솔 오류 유무를 먼저 봅니다.
   AdSense 승인은 즉시 반영되지 않을 수 있으므로 `스크립트 로드 성공`과 `slot 초기화 오류 없음`을 우선 통과 기준으로 둡니다.

## Verification
- 요청 기반 확인
  - `GET /ads.txt`가 200이어야 합니다.
  - `robots.txt`, `sitemap.xml`, canonical이 모두 `www.locally-travel.com` 기준으로 보이는지 확인합니다.
- 화면 확인
  - 목록 데스크탑: 우측 1개 + 하단 1개
  - 목록 모바일: 하단 1개
  - 상세 데스크탑: 우측 1개 + 하단 1개
  - 상세 모바일: 하단 1개
- DOM/콘솔 확인
  - `view-source:` 또는 devtools에서 `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` 스크립트가 로드되는지
  - 각 광고 슬롯 내부에 `<ins class="adsbygoogle">`가 있는지
  - `adsbygoogle.push()` 관련 오류가 없는지

## Rollback
- 가장 안전한 rollback은 `NEXT_PUBLIC_ADSENSE_ENABLED=false` 또는 env 제거 후 redeploy 입니다.
- slot env만 제거해도 해당 자리만 placeholder/no-op로 돌아갑니다.
- `ads.txt`를 즉시 숨겨야 하면 `NEXT_PUBLIC_ADSENSE_CLIENT_ID`를 제거하고 redeploy 하면 됩니다.

## Defaults Locked
- 이번 cutover는 `자동 광고`가 아니라 `수동 슬롯`만 기준입니다.
- 광고 surface는 `locally_content` 공개 목록/상세로 한정합니다.
- 커뮤니티 데이터, 댓글/좋아요/조회수, SEO 메타 구조는 이번 cutover에서 건드리지 않습니다.
