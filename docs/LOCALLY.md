# 1. 한 줄 정의
- 1문장 버전: Locally는 한국·일본을 중심으로, 현지 호스트의 취향과 동네 감각이 담긴 체험을 예약하게 하고, 일부 여행 마찰은 요청형 현지 서비스로 보완하는 로컬 여행 플랫폼이다.
- 3문장 버전: Confirmed: 공개 메인 표면은 `체험`과 `서비스`의 2축이다 ([app/components/HomeHero.tsx:302](../app/components/HomeHero.tsx#L302), [app/components/HomeHero.tsx:311](../app/components/HomeHero.tsx#L311), [new home](https://locally-web.vercel.app/)). Confirmed: 하지만 검색·홈·체험 상세·예약 구조의 중심은 여전히 로컬 호스트 체험이다 ([app/page.tsx:13](../app/page.tsx#L13), [app/api/search/experiences/route.ts:222](../app/api/search/experiences/route.ts#L222), [app/utils/structuredData.ts:37](../app/utils/structuredData.ts#L37)). Confirmed: 서비스 축은 범용 서비스 마켓이 아니라 `일본 현지 동행/통역 맞춤 의뢰`와 `일본 전화 예약·문의 대행` 중심의 좁고 운영형인 2차 축이다 ([app/constants.ts:18](../app/constants.ts#L18), [app/services/intro/page.tsx:15](../app/services/intro/page.tsx#L15), [app/proxy-bookings/new/page.tsx:42](../app/proxy-bookings/new/page.tsx#L42)).
- 1문단 버전: Confirmed: Locally의 실제 제품 정체성은 “전 세계 로컬 커뮤니티”나 “올인원 여행 슈퍼앱”이 아니라, 한국·일본 권역에서 로컬 호스트가 여는 체험을 중심으로 여행자를 연결하는 예약 플랫폼이다. Strong inference: 여기에 일본 여행의 실무적 마찰을 풀기 위한 요청형 동행/통역, 전화 예약 대행이 덧붙어 있어, 브랜드는 체험 중심이어야 하지만 사업은 일부 운영형 서비스까지 포함하는 하이브리드 구조다. Confirmed: 따라서 About나 브랜드 카피는 `현지 사람·취향·동네 감각`을 중심축으로 삼고, 서비스/대행/콘텐츠/회사 페이지는 그 축을 흐리지 않도록 위계를 분명히 해야 한다 ([app/become-a-host2/hostLandingFaq.ts:26](../app/become-a-host2/hostLandingFaq.ts#L26), [app/context/LanguageContext.tsx:264](../app/context/LanguageContext.tsx#L264), [old site](https://www.locally-travel.com/), [new about](https://locally-web.vercel.app/about)).

# 2. Locally는 정확히 어떤 서비스인가
- Confirmed: 핵심 서비스는 로컬 호스트가 올린 체험을 도시·언어·시간·유형 기준으로 발견하고 예약하는 마켓플레이스다 ([app/search/page.tsx:62](../app/search/page.tsx#L62), [app/search/searchContract.ts:38](../app/search/searchContract.ts#L38), [app/api/search/experiences/route.ts:222](../app/api/search/experiences/route.ts#L222)).
- Confirmed: 핵심 가치 제안은 “관광지 체크리스트”보다 “현지인이 실제로 좋아하는 동네의 취향과 일상”에 접속하게 해주는 것이다 ([app/page.tsx:20](../app/page.tsx#L20), [app/become-a-host2/hostLandingFaq.ts:26](../app/become-a-host2/hostLandingFaq.ts#L26), [app/about/AboutEditorialContent.tsx:203](../app/about/AboutEditorialContent.tsx#L203)).
- Confirmed: 사용자가 얻는 결과는 `현지 호스트와의 체험`, `예약 후 메시지`, `트립 관리`, `리뷰`, `완료 후 정산/후기`까지 이어지는 폐쇄형 여행 실행 흐름이다 ([app/api/guest/trips/route.ts:29](../app/api/guest/trips/route.ts#L29), [app/api/host/start-chat/route.ts:15](../app/api/host/start-chat/route.ts#L15), [app/experiences/[id]/page.tsx:273](../app/experiences/%5Bid%5D/page.tsx#L273)).
- Confirmed: 경쟁 서비스와 다른 점은 `한일 중심`, `호스트의 취향/시선 강조`, `운영형 서비스 보조축`, `호스트 심사/신원 확인`이다 ([app/host/create/localization.ts:27](../app/host/create/localization.ts#L27), [app/api/host/register/submit/route.ts:226](../app/api/host/register/submit/route.ts#L226), [app/services/intro/page.tsx:22](../app/services/intro/page.tsx#L22)).
- Confirmed: Locally가 실제로 “파는 것”은 `투어 상품`만이 아니라, 1차적으로는 `현지 호스트의 시간·동선·취향이 담긴 체험`, 2차적으로는 `여행 실행을 돕는 현지 실무 지원`이다 ([app/constants.ts:18](../app/constants.ts#L18), [app/types/service.ts:54](../app/types/service.ts#L54), [app/proxy-bookings/new/page.tsx:75](../app/proxy-bookings/new/page.tsx#L75)).
- Strong inference: 그래서 이 서비스는 “Airbnb Experiences 같은 경험 마켓”에 더 가깝지만, 실제 사업 구조는 `경험 마켓 + 운영형 로컬 지원 서비스`까지 포함한다. 순수 경험 플랫폼으로만 쓰면 서비스 축을 누락하고, 반대로 “여행 플랫폼 전반”으로 쓰면 과장된다.

# 3. 핵심 사용자 정의
- 1차 핵심 사용자: Confirmed: 한국어권 여행자, 특히 일본 여행에서 `현지 취향 체험`과 `언어/예약 장벽 해소`를 동시에 원하는 사람들이다. 근거는 일본 동행 서비스 카피가 거의 전부 한국어 사용자 pain point에 맞춰져 있고, 전화 예약 대행도 일본 현지 업체 대응을 전면에 두기 때문이다 ([app/context/LanguageContext.tsx:1130](../app/context/LanguageContext.tsx#L1130), [app/services/intro/page.tsx:22](../app/services/intro/page.tsx#L22), [app/proxy-bookings/new/page.tsx:1380](../app/proxy-bookings/new/page.tsx#L1380)).
- 이들에게 중요한 것: `관광보다 생활감`, `언어 불안 감소`, `검증된 호스트`, `예약 후 소통 가능성`. 먹히는 카피는 `현지인의 취향`, `동네`, `언어 걱정 없이`, `여행 전부터 메시지`. 안 먹히는 카피는 `글로벌 커뮤니티`, `세상을 연결`, `올인원 여행`.
- 2차 사용자: Confirmed: 한국과 일본에 거주하며 자기 동네/취향을 체험으로 운영하려는 호스트다. 이들은 전문 가이드보다 “내가 좋아하는 일상”을 상품화하는 사람으로 정의된다 ([app/become-a-host2/hostLandingFaq.ts:26](../app/become-a-host2/hostLandingFaq.ts#L26), [app/become-a-host/page.tsx:9](../app/become-a-host/page.tsx#L9)).
- 이들에게 중요한 것: `과도한 전문성 요구 없음`, `심사/안전/정산`, `운영 가능한 일정만 열기`, `대시보드로 예약·문의·정산 관리`. 먹히는 카피는 `당신의 동네와 취향`, `많이 열기보다 책임 있게 운영`, `일상 기반 체험`. 안 먹히는 카피는 `누구나 바로 투어 사업자`, `전문 가이드 수준`.
- 잠재 사용자: Strong inference: 일본→한국 여행자, 영어/중국어권 한국·일본 여행자도 제품상 수용 가능하다. 다만 현재 repo/live 증거는 `가능하다` 수준이지 `주력이다`까지는 아니다 ([app/host/create/localization.ts:38](../app/host/create/localization.ts#L38), [app/context/LanguageContext.tsx:2558](../app/context/LanguageContext.tsx#L2558)).
- Unknown / needs manual confirmation: 실제 매출 기준 1차 수요가 `한국인→일본`인지, `한일 양방향`인지, `영어/중국어 인바운드`가 얼마나 큰지는 코드만으로 확정 불가하다.

# 4. 현재 제품 범위 맵
- Core: Confirmed: `Experiences`. 홈/검색/상세/결제/트립/리뷰/호스트 프로필 전체가 여기에 맞춰 설계되어 있다 ([app/page.tsx](../app/page.tsx), [app/search/page.tsx](../app/search/page.tsx), [app/experiences/[id]/page.tsx](../app/experiences/%5Bid%5D/page.tsx)). 브랜드 서사를 가장 강화한다.
- Important but secondary: Confirmed: `Local companion / interpretation custom request`. 결제 후 호스트 모집, 지원, 선택, 매칭, 완료로 이어지는 실서비스다 ([app/types/service.ts:6](../app/types/service.ts#L6), [app/api/services/requests/route.ts:291](../app/api/services/requests/route.ts#L291), [app/api/services/select-host/route.ts:87](../app/api/services/select-host/route.ts#L87)). 브랜드를 보완할 수 있지만, 전면에 나오면 체험 브랜드를 흐릴 수 있다.
- Adjacent / peripheral: Confirmed: `Japan phone reservation / inquiry support`. 유료이며 운영팀·현지팀 중심의 대행 서비스다 ([app/proxy-bookings/new/page.tsx:42](../app/proxy-bookings/new/page.tsx#L42), [app/api/proxy-bookings/route.ts:113](../app/api/proxy-bookings/route.ts#L113)). 실수요는 있을 수 있으나, 메인 브랜드 내러티브를 강화하기보다 분산시킨다.
- Adjacent / peripheral: Confirmed: `Community/Content`. 현재는 오픈 커뮤니티가 아니라 Locally 콘텐츠 중심이다 ([app/community/categoryMeta.ts:8](../app/community/categoryMeta.ts#L8), [app/community/page.tsx:73](../app/community/page.tsx#L73)). “커뮤니티 브랜드”를 주장하기에는 근거가 약하다.
- Legacy / muddying the brand: Confirmed: `Newsroom`, `Investors`, old-site utility stack. 하드코딩 수치·가짜 링크·과장된 글로벌 지표가 많아 현재 브랜드를 가장 흐린다 ([app/company/news/page.tsx:9](../app/company/news/page.tsx#L9), [app/company/investors/page.tsx:19](../app/company/investors/page.tsx#L19), [old site](https://www.locally-travel.com/)).

# 5. 서비스 표면에서 확인된 주요 상품/기능
- Experiences: Confirmed. 검색 유형, 도시 필터, 체험 상세, 결제, 리뷰, 트립이 모두 체험 중심이다 ([app/search/searchContract.ts:38](../app/search/searchContract.ts#L38), [app/search/page.tsx:62](../app/search/page.tsx#L62), [app/api/payment/nicepay-callback/route.ts:153](../app/api/payment/nicepay-callback/route.ts#L153)). 제품 정체성은 기본적으로 체험 플랫폼이다.
- Services: Confirmed. 서비스는 request-first이며, 결제 후 `open`, 호스트 지원, 고객 선택, 매칭으로 진행된다 ([app/components/HomePageClient.tsx:155](../app/components/HomePageClient.tsx#L155), [app/api/services/requests/route.ts:291](../app/api/services/requests/route.ts#L291), [app/services/[requestId]/ServiceRequestClient.tsx:26](../app/services/%5BrequestId%5D/ServiceRequestClient.tsx#L26)). 이는 “일반 상품 상세→즉시 예약”과 다른 운영형 서비스 정체성을 뜻한다.
- Messaging: Confirmed. 체험도 서비스도 메시지 스레드가 핵심 운영 장치다 ([app/api/host/start-chat/route.ts:15](../app/api/host/start-chat/route.ts#L15), [app/services/[requestId]/ServiceRequestClient.tsx:116](../app/services/%5BrequestId%5D/ServiceRequestClient.tsx#L116)). Locally는 소셜 앱은 아니지만, 예약 전후 메시지가 중요하다.
- Booking: Confirmed. 체험은 카드/PayPal/무통장, 서비스도 카드/PayPal/무통장 흐름이 있다 ([app/api/payment/nicepay-callback/route.ts:153](../app/api/payment/nicepay-callback/route.ts#L153), [app/api/payment/paypal/capture-order/route.ts:131](../app/api/payment/paypal/capture-order/route.ts#L131), [app/api/admin/bookings/confirm-payment/route.ts:69](../app/api/admin/bookings/confirm-payment/route.ts#L69), [app/api/services/payment/paypal/capture-order/route.ts:114](../app/api/services/payment/paypal/capture-order/route.ts#L114)).
- Calendar / trips: Confirmed. 체험은 날짜/시간/수용 인원 기반이고, 완료 후 trip으로 관리된다 ([app/api/guest/trips/route.ts:102](../app/api/guest/trips/route.ts#L102), [app/host/experiences/[id]/dates/page.tsx](../app/host/experiences/%5Bid%5D/dates/page.tsx)). 이는 “콘텐츠 탐색”이 아니라 실제 실행형 예약 제품임을 뜻한다.
- Search / filters: Confirmed. 공개 검색은 경험만 대상으로 하고, 도시도 8개 대표 도시로 압축돼 있다 ([app/search/page.tsx:62](../app/search/page.tsx#L62), [app/api/search/experiences/route.ts:199](../app/api/search/experiences/route.ts#L199)). 서비스는 검색형이 아니라 요청형이다.
- Languages: Confirmed. 경험 지원 언어는 한국어/영어/일본어/중국어, 서비스도 같은 언어 배열을 사용한다 ([app/host/create/localization.ts:79](../app/host/create/localization.ts#L79), [app/services/request/page.tsx:13](../app/services/request/page.tsx#L13)). 다국어 지원은 있지만 운영 범위는 전세계가 아니다.
- City coverage: Confirmed. 운영 데이터 구조는 한국·일본만 명시한다 ([app/host/create/localization.ts:27](../app/host/create/localization.ts#L27), [app/utils/serviceRequestLocation.ts:7](../app/utils/serviceRequestLocation.ts#L7)). Strong inference: 현재 실운영 지리 범위는 사실상 한일이다.
- Safety / payment / refund: Confirmed. 호스트 심사·신분증·정산 계좌, 체험 취소율 계산, 서비스 취소 검토 흐름이 코드화돼 있다 ([app/api/host/register/submit/route.ts:226](../app/api/host/register/submit/route.ts#L226), [app/utils/bookingCancellationPolicy.ts:79](../app/utils/bookingCancellationPolicy.ts#L79), [app/api/services/cancel/route.ts:279](../app/api/services/cancel/route.ts#L279)).
- Host onboarding: Confirmed. 호스트는 승인형이며, 한국인/일본인만 신청 UI가 열려 있다 ([app/host/register/localization.ts:195](../app/host/register/localization.ts#L195), [app/api/host/register/submit/route.ts:223](../app/api/host/register/submit/route.ts#L223)).
- Community/forum if real: Confirmed: “실제 오픈 포럼”이라고 부르기 어렵다. 현재는 `COMMUNITY_OPEN=false`로 Locally 콘텐츠 전용에 가깝다 ([app/community/categoryMeta.ts:8](../app/community/categoryMeta.ts#L8)).

# 6. 브랜드 포지셔닝 진단
- Confirmed: Locally는 지금 겉으로는 “감성적인 로컬 체험 브랜드”처럼 보이지만, 코드와 IA를 읽으면 `체험 중심 + 운영형 서비스 혼합 플랫폼`이다.
- Confirmed: Locally는 무엇으로 보여야 하는가에 대한 가장 안전한 답은 `한일 중심 로컬 체험 브랜드`다. 서비스/전화대행은 존재하지만 메인 정의가 되면 제품이 흐려진다 ([app/utils/structuredData.ts:39](../app/utils/structuredData.ts#L39), [app/become-a-host2/hostLandingFaq.ts:26](../app/become-a-host2/hostLandingFaq.ts#L26)).
- Confirmed: 현재 가장 강한 축은 `현지 사람`, `동네`, `취향`, `관광보다 생활`이다 ([app/page.tsx:20](../app/page.tsx#L20), [app/about/AboutEditorialContent.tsx:97](../app/about/AboutEditorialContent.tsx#L97)).
- Confirmed: 현재 가장 흐리는 요소는 `global/community/investor/news/company` 과장, 그리고 `서비스`라는 넓은 라벨 아래 실제 좁은 일본 특화 운영 서비스가 숨어 있는 점이다 ([app/company/investors/page.tsx:19](../app/company/investors/page.tsx#L19), [app/company/news/page.tsx:77](../app/company/news/page.tsx#L77), [app/constants.ts:18](../app/constants.ts#L18)).
- Confirmed: old site와 new site 차이는 명확하다. old site는 `투어/eSIM/전화예약/키즈케어/팝업스태프/설문인터뷰`까지 섞인 넓고 잡다한 일본 관련 유틸 허브처럼 보이고, new site는 체험 중심의 프리미엄 로컬 여행 브랜드로 정리하려고 한다. 그러나 footer·company·community·service가 여전히 새 브랜드를 탁하게 만든다 ([old site](https://www.locally-travel.com/), [new home](https://locally-web.vercel.app/), [app/components/SiteFooter.tsx:48](../app/components/SiteFooter.tsx#L48)).

# 7. 카피/브랜드 언어 분석
- Confirmed: 이 브랜드에 맞는 톤은 `짧고 단정한 선언 + 바로 이어지는 구체적 설명`이다. 추상 미션보다 `누구와`, `어느 도시에서`, `어떤 시간을 보내는지`가 먼저 나와야 한다.
- 권장 헤드라인 스타일: 1개 개념만 말하는 6~14단어 수준. `현지인과 함께하는 진짜 로컬 여행`은 맞고, `전 세계 이웃들과 만드는 따뜻한 연결`은 과하다 ([app/page.tsx:13](../app/page.tsx#L13), [app/about/AboutEditorialContent.tsx:98](../app/about/AboutEditorialContent.tsx#L98)).
- Confirmed: 코어 카피는 `사람/도시/취향` 순으로 리드하는 게 맞다. 서비스 카피만 예외적으로 `문제/해결/신뢰` 순으로 가는 게 맞다 ([app/context/LanguageContext.tsx:2577](../app/context/LanguageContext.tsx#L2577), [app/proxy-bookings/new/page.tsx:1380](../app/proxy-bookings/new/page.tsx#L1380)).
- 금지해야 할 표현: `전 세계 현지인`, `가장 사랑받는 커뮤니티`, `올인원 여행`, `24시간 글로벌 지원팀`, `누구나 어디서나`, `AI가 완벽한 여행을 만든다`. 현재 repo/live 근거가 약하거나 없다.
- 과장되기 쉬운 표현: `현지인 친구`, `살아보는 여행`, `커뮤니티`. 이 표현들은 쓸 수는 있지만, 제품이 보장하는 것은 `체험 예약`과 `메시지/운영`이지 `친구 관계`나 `오픈 커뮤니티`가 아니다.
- 실제 서비스보다 앞서나가는 위험 문장: `호스트가 설정한 다양한 환불 정책`, `전 세계 도시에서 운영`, `여행 전 과정을 다 해결`, `모든 게스트 신원 엄격 인증`. 코드 기준으로는 틀리거나 입증이 부족하다 ([app/about/AboutEditorialContent.tsx:372](../app/about/AboutEditorialContent.tsx#L372), [app/utils/bookingCancellationPolicy.ts:79](../app/utils/bookingCancellationPolicy.ts#L79)).
- Apple/Airbnb 스타일을 참고할 때 원칙: `미학은 가져오되 스케일 과장은 버릴 것`, `한 문장당 한 약속만`, `추상어보다 제품 표면을 먼저`, `증명 불가능한 숫자·글로벌성·커뮤니티성은 삭제`, `서비스 축은 About 본문 후반부나 별도 맥락에서만 다룰 것`.

# 8. 현재 About 페이지 진단
- 맞는 점: Confirmed. `여행은 살아보는 거야`, `동네의 리듬`, `취향 발견`, `호스트와의 소통`은 제품 핵심과 잘 맞는다 ([app/about/AboutEditorialContent.tsx:89](../app/about/AboutEditorialContent.tsx#L89), [app/about/AboutEditorialContent.tsx:231](../app/about/AboutEditorialContent.tsx#L231), [new about](https://locally-web.vercel.app/about)).
- 틀린 점: Confirmed. `전 세계의 이웃`, `가장 사랑받는 로컬 커뮤니티`, `전 세계 현지인과 여행자`는 현재 코드/운영 범위를 넘는다 ([app/about/AboutEditorialContent.tsx:97](../app/about/AboutEditorialContent.tsx#L97), [app/about/AboutEditorialContent.tsx:172](../app/about/AboutEditorialContent.tsx#L172), [app/about/AboutEditorialContent.tsx:360](../app/about/AboutEditorialContent.tsx#L360)).
- 너무 넓은 점: Confirmed. About는 글로벌 플랫폼/커뮤니티처럼 말하지만, 실제 운영 지리는 한일이고, 서비스 구조는 체험+일본 특화 운영 서비스다 ([app/host/create/localization.ts:27](../app/host/create/localization.ts#L27), [app/services/intro/page.tsx:22](../app/services/intro/page.tsx#L22)).
- 너무 약한 점: Confirmed. 무엇을 실제로 예약하는지, 어떤 체험이 많은지, 왜 한일 중심인지, 왜 일본 언어/전화 서비스가 붙는지 설명이 없다.
- 오해를 부르는 점: Confirmed. 환불 FAQ가 실제 정책과 다르고, “호스트가 설정한 정책”이라고 써 있다. 실제로는 고정 환불 정책 helper가 있다 ([app/about/AboutEditorialContent.tsx:372](../app/about/AboutEditorialContent.tsx#L372), [app/host/create/localization.ts:133](../app/host/create/localization.ts#L133), [app/utils/bookingCancellationPolicy.ts:83](../app/utils/bookingCancellationPolicy.ts#L83)).
- 남겨야 할 것: `hero 철학`, `taste pillars`, `호스트와의 메시지`, `현지인과 보내는 시간` 서사.
- 지워야 할 것: `커뮤니티 과장`, `global 과장`, `검증 안 된 숫자`, `24시간 글로벌 지원`, `잘못된 환불 FAQ`.
- 뒤로 미뤄야 할 것: 안전/지원/회사 정보는 본문 후반부. 먼저 “Locally가 정확히 무엇을 하는지”를 정의해야 한다.
- 데이터/통계 블록: Confirmed. `Active Hosts 800+ / Cities 5 / Countries 3 / Avg Rating 4.9`는 코드에 하드코딩돼 있고 데이터 소스가 없다 ([app/about/AboutEditorialContent.tsx:176](../app/about/AboutEditorialContent.tsx#L176)). 라이브 SSR 표면에서도 `0+ / 0 / 0 / 0`으로 시작한다는 점까지 감안하면, 현재 상태로는 증명 블록이 아니라 장식 블록이다 ([new about](https://locally-web.vercel.app/about)).

# 9. About 페이지 카피를 쓰기 전에 반드시 알아야 하는 사실
- Confirmed: Locally의 중심 상품은 체험 예약이다. 서비스는 존재하지만 보조축이다.
- Confirmed: 서비스는 범용 “로컬 서비스 마켓”이 아니라 일본 특화 요청형 동행/통역 + 전화 예약 대행이 핵심이다.
- Confirmed: 운영 지리 범위는 코드상 한국/일본뿐이다.
- Confirmed: 호스트는 승인형이고, 호스트 신청 UI도 한국인/일본인만 전제로 한다.
- Confirmed: 커뮤니티는 현재 오픈 포럼이 아니라 Locally 콘텐츠에 가깝다.
- Confirmed: 체험 브랜드의 가장 강한 진실은 `현지 사람의 취향과 동네 감각`이다.
- Confirmed: legal text는 Locally를 `여행사`로 다룬다. 브랜드 카피가 marketplace 톤이어도 법적 포지션과 충돌할 수 있다 ([app/constants/legalText.ts:293](../app/constants/legalText.ts#L293)).
- Unknown / needs manual confirmation: 실제 host 수, 실제 city/country 수, 실제 rating, 실제 24/7 support 여부, 실제 주력 국가별 고객 비중.
- Strong inference: About는 traveler-facing이어야 하며, host recruitment/investor/news/community 이야기가 앞에 나오면 제품 정의가 흐려진다.

# 10. 충돌/모순/불확실성 목록
| Topic | User-asserted | Repo/live confirmed | Risk if copy is written wrong | Needed confirmation |
|---|---|---|---|---|
| 서비스 본질 | Airbnb Experiences-like | 체험 중심은 맞지만, 실제로는 `체험 + 요청형 서비스 + 전화대행` 구조 | 체험만 쓰면 서비스 축 누락, 플랫폼으로 넓히면 과장 | 서비스 매출 비중과 브랜드 내 위상 |
| 타깃 지역 | 한국↔일본 + 글로벌 인바운드 | 코드상 운영 국가는 한국/일본만 명시, 서비스는 특히 일본 특화 | 글로벌 브랜드처럼 쓰면 허위 과장 | 실제 사용자 국가 비중 |
| About의 글로벌성 | traveler-facing global brand | About는 `전 세계`를 말하지만, repo는 한일 중심 | 신뢰 하락, 제품 오인 | 글로벌 확장 여부 |
| Community | community/forum도 있는 브랜드 | `COMMUNITY_OPEN=false`, 현재는 로컬리 콘텐츠 중심 | “커뮤니티 브랜드” 오판 | 오픈 포럼 재개 계획 |
| 서비스 범위 | broader local services maybe | 홈의 `서비스` 라벨보다 실제는 매우 좁은 2개 축 | 범용 서비스 플랫폼처럼 보이게 됨 | 향후 서비스 확장 계획 |
| 환불 정책 | flexible / host-set maybe | 실제는 고정 정책 helper, About/FAQ 일부는 불일치 | 법적/고객 CS 리스크 | 단일 환불 정책 유지 여부 |
| 신뢰/안전 | strong verification/support | 호스트 심사/결제 보호는 확인되지만 `모든 게스트 엄격 인증`, `24시간 글로벌 지원`은 미확인 | 과장 광고 위험 | 실제 guest KYC / support ops |
| 법적 포지션 | marketplace 느낌 | legal text는 `여행사`로 규정 | About 카피가 법무와 충돌 | 회사가 원하는 공식 법적 자기정의 |
| old vs new brand | new premium traveler brand | old site는 tours/eSIM/phone reservation 등 넓은 유틸 허브 | 브랜드 분산 | old domain의 향후 역할 |
| 수치/증거 | About stats likely proof | 800+/5/3/4.9, Investors 1.2M+/45는 코드 하드코딩 | About 신뢰 붕괴 | 실제 검증 가능한 수치 |

# 11. About 페이지용 핵심 인풋 요약
- brand in one line: Locally는 한일 중심으로, 현지 호스트의 취향과 동네 감각을 여행자에게 연결하는 로컬 체험 브랜드다.
- 3 core promises: `관광보다 생활에 가까운 체험`, `검증된 호스트와의 예약·소통`, `일부 여행 마찰은 요청형 현지 서비스로 보완`.
- 3 things Locally is NOT: `전 세계 오픈 로컬 커뮤니티`, `올인원 여행 슈퍼앱`, `범용 로컬 서비스 마켓`.
- primary audience: 1차는 한국어권 여행자, 특히 일본 여행에서 로컬 체험과 언어 장벽 해소를 함께 원하는 사람. 2차는 한일 로컬 호스트.
- strongest proof points: 홈 메타와 검색/상세/예약 구조의 체험 중심성, host landing FAQ의 “취향과 일상” 정의, 서비스 intro/request의 일본 특화 운영형 구조 ([app/page.tsx:13](../app/page.tsx#L13), [app/become-a-host2/hostLandingFaq.ts:26](../app/become-a-host2/hostLandingFaq.ts#L26), [app/services/intro/page.tsx:22](../app/services/intro/page.tsx#L22)).
- risky assumptions to avoid: `global`, `community-led`, `all cities`, `24/7 global support`, `all guests verified`, `flexible host-defined refund`, `broad services platform`.
- recommended narrative order for About: `무엇을 예약하는 서비스인가` → `왜 현지 사람의 취향이 중요한가` → `어떤 체험이 많은가` → `왜 한일 중심인가` → `예약 후 신뢰/소통 구조` → `보조 서비스는 무엇인가` → `호스트와 회사 이야기`.

최종 서비스 정의 제안
Locally는 한국과 일본을 중심으로, 현지 호스트가 직접 여는 체험을 통해 여행자를 동네의 취향과 생활감에 연결하고, 일부 여행 실행 장벽은 요청형 동행·전화대행 서비스로 보완하는 로컬 여행 플랫폼이다.

이 정의를 바탕으로 About 카피를 써도 되는지 여부: NO

아직 필요한 것
- 실제 검증 가능한 지표: active hosts, active cities/countries, rating, 이용자 수
- 실제 주력 고객 비중: 한국→일본 vs 일본→한국 vs 영어/중국어 인바운드
- 회사의 공식 법적 포지션: 여행사 vs 마켓플레이스 vs 하이브리드
- 서비스 축의 브랜드 위상: About 본문에 넣을지, 별도 섹션/별도 제품군으로 둘지
- community/news/investors를 실제 브랜드 자산으로 유지할지, 축소/분리할지 결정
