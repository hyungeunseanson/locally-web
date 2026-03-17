# Locally 커뮤니티 운영 전략 보고안

## 요약
- 권고안: `4개 언어별 완전 분리 커뮤니티`로 시작하지 않는다. `하나의 커뮤니티 엔진 + 한국어/일본어 2개 운영 레인 + 영어/중국어 읽기/번역 지원`으로 시작한다.
- 이유: 여행 커뮤니티는 언어보다 `목적지`와 `질문 밀도`가 활성화를 만든다. 초기에 4분할하면 글 수가 희석되어 커뮤니티가 죽는다.
- 1차 목표: `한국인 일본여행자`와 `일본 현지/일본어 가능 로컬/호스트`가 만나는 질문·동행·현지정보 허브.
- 2차 목표: booking/experience/service로 이어지는 전환 퍼널을 커뮤니티 안에 심는다.

## 현재 Locally 진단
- 강점: `Q&A / 동행 / 현지 꿀팁 / locally_content` 축이 이미 있고, 댓글/좋아요/조회수/검색/인기 정렬/작성자 프로필 모달/익명 작성까지 구현돼 있다. [app/community/page.tsx#L32](/Users/sonhyungeun/Documents/locally-web/app/community/page.tsx#L32) [app/types/community.ts#L3](/Users/sonhyungeun/Documents/locally-web/app/types/community.ts#L3)
- 강점: `동행`에는 날짜/도시 구조화 필드가 있고 `locally_content`는 운영팀 시드 콘텐츠 채널로 바로 활용 가능하다. [app/community/write/PostEditor.tsx#L67](/Users/sonhyungeun/Documents/locally-web/app/community/write/PostEditor.tsx#L67)
- 약점: 데이터 모델에 `locale`, `country`, `city`, `trip_stage`, `tag`, `report_state`가 없다. 지금은 카테고리만 있고 목적지 밀도를 만들 수 없다. [supabase_community_migration.sql#L6](/Users/sonhyungeun/Documents/locally-web/supabase_community_migration.sql#L6)
- 약점: 댓글의 `is_selected`는 스키마와 타입에 있지만 실제 Q&A 채택 UX가 없다. [supabase_community_migration.sql#L31](/Users/sonhyungeun/Documents/locally-web/supabase_community_migration.sql#L31) [app/types/community.ts#L35](/Users/sonhyungeun/Documents/locally-web/app/types/community.ts#L35)
- 약점: locale alternate 메타는 있으나 커뮤니티 UI 텍스트는 한국어 중심이라 다국어 운영 준비가 안 돼 있다. [app/community/page.tsx#L60](/Users/sonhyungeun/Documents/locally-web/app/community/page.tsx#L60)
- 약점: 신고/제재/신규 유저 스로틀링이 없고, AI 봇은 코드만 있고 실제 사용자 UUID가 비어 있다. [app/api/bot/auto-post/route.ts#L5](/Users/sonhyungeun/Documents/locally-web/app/api/bot/auto-post/route.ts#L5) [app/api/bot/auto-comment/route.ts#L7](/Users/sonhyungeun/Documents/locally-web/app/api/bot/auto-comment/route.ts#L7)

## 외부 사례에서 확인한 운영 원리
- `Tripadvisor`: 2025년 3월 18일 공개한 2025 Transparency Report 기준, 2024년에 포럼 글 약 260만 건, 회원 답변 약 25.7만 건이 올라왔다. 핵심은 강한 비상업 규칙, 중복 게시 금지, 포럼 언어 준수, AI 생성 리뷰 제거다. https://tripadvisor.mediaroom.com/2025-03-18-Tripadvisors-2025-Transparency-Report-reveals-strong-review-submissions-and-improved-fraud-detection https://www.tripadvisor.com/Trust-lvZWuQ2603YY.html
- `Reddit r/travel`: 2026년 1월 1일 아카이브 기준 구독자 14,113,208명. FAQ 검색 선행, 국가/도시를 포함한 구체적 제목, 예산/날짜/관심사 작성 규칙이 강하고, 2025년 11월 29일에는 분쟁이 많은 스레드에 `Travelers Only` 모드를 도입했다. https://archive.ph/2026.01.01-035531/https%3A/old.reddit.com/r/travel/ https://www.reddit.com/r/travel/comments/1p9uu3u/introducing_travelers_only_mode/
- `FlyerTalk`: 최근 홈 기준 884,281명 회원, 36,949,141개 포스트. 여행 일반 커뮤니티가 아니라 `마일/항공/호텔`이라는 고의도 문제를 깊게 파는 전문가 집단이라 충성도가 높다. 신규 회원은 링크/PM/게시량 제한으로 스팸을 막는다. https://www.flyertalk.com/ https://www.flyertalk.com/forum/technical-support-feedback/1882508-new-member-posting-restriction-url-link-image.html
- `4travel`: 일본 최대급 여행 커뮤니티 포털을 표방하고, `여행기/후기/Q&A/行ってきます/랭킹`을 한 흐름으로 묶는다. 목적지별 가이드와 개인 기여도 랭킹이 재방문 루프를 만든다. https://4travel.jp/help/service/ https://ssl.4travel.jp/help/guideline/qa/ https://4travel.jp/
- `穷游`: 중국의 초기 대형 출국여행 커뮤니티로, 포럼 인덱스에서 `공략/유기/결伴/转让/讨论`를 지역별로 나누고 `커뮤니티 가이드`와 `책임 있는 여행` 규칙을 전면에 둔다. https://bbs.qyer.com/index.php https://nav.qyer.com/bbsguide https://rt.qyer.com/
- `马蜂窝`: 공식 App 설명에서 `상억 여행자 경험`, `공략 질문 실시간 답변`, `결伴`, `주말 모임`을 전면에 내세운다. 즉 여행 커뮤니티의 핵심은 후기보다 `의사결정 도움`과 `동행 연결`이다. https://apps.apple.com/cn/app/%E9%A9%AC%E8%9C%82%E7%AA%9D-%E5%85%A8%E7%90%83%E6%97%85%E6%B8%B8%E6%94%BB%E7%95%A5-%E6%97%85%E8%A1%8C%E5%BA%A6%E5%81%87%E9%85%92%E5%BA%97%E9%A2%84%E8%AE%A2/id406596432
- `오사카홀릭`: 2026년 1월 8일 기사 기준 약 70만 회원. 일본 여행이라는 단일 주제 집중만으로 결제/제휴 상품까지 연결됐다. 이건 “큰 커뮤니티”보다 “문제가 선명한 커뮤니티”가 강하다는 증거다. https://www.etnews.com/20260108000181

## Locally에 대한 최종 권고
- 커뮤니티 구조는 `언어 중심 4분할`이 아니라 `목적지 중심 + 언어 레인`으로 간다.
- 오픈 범위는 `한국어 작성`, `일본어 작성`, `영어/중국어 읽기 + 번역`으로 시작한다.
- 메인 홈은 `도쿄/오사카/교토/후쿠오카/서울/부산` 같은 도시 허브로 나누고, 각 허브 안에서 `질문`, `동행`, `현지 실시간`, `후기/루트`, `로컬리 픽`으로 다시 나눈다.
- `동행`은 별도 강한 vertical로 취급한다. 일반 피드 한 탭이 아니라 날짜/도시/성별 선호/연령대/시간대/안전 가이드가 있는 반구조화 게시판으로 키운다.
- `Q&A`는 채택 답변, 해결됨 배지, 중복 질문 연결을 넣어 검색 자산으로 만든다.
- `locally_content`는 운영팀/호스트/검증된 로컬이 쓰는 에디토리얼 레인으로 유지하되, 일반 UGC와 섞이지 않게 라벨을 강하게 준다.
- AI는 `번역, 요약, FAQ 묶음, 모더레이터 보조`에만 쓴다. 사람인 척 글/댓글을 뿌리는 운영은 시작하지 않는다.

## 구현 스펙
- 데이터 모델 추가: `post_locale`, `source_locale`, `destination_country`, `destination_city`, `trip_stage(pre_trip|during_trip|post_trip)`, `post_format(question|companion|tip|report|editorial)`, `solved_comment_id`, `report_count`, `moderation_status`, `translated_locales`.
- 공개 인터페이스 추가:
  - `/community?locale=ko|ja|en|zh&city=tokyo&format=question&stage=pre_trip`
  - 글쓰기 템플릿: `질문`, `동행`, `후기`, `실시간 제보`
  - 댓글 액션: `채택`, `신고`, `번역 보기`
  - 작성자 뱃지: `Verified Host`, `Local Guide`, `Recent Traveler`
- 기본 운영 규칙:
  - 한 글은 한 원문 언어만 가진다.
  - 다른 언어는 자동 번역 카드로 노출하되 원문 링크를 항상 함께 보여준다.
  - 상업적 홍보, 외부 연락 유도, 무리한 모집, 중복 업로드는 삭제한다.
  - 신규 유저는 링크/이미지/대량 댓글에 제한을 둔다.
  - 동행 게시물은 자동 만료와 안전 안내를 필수로 둔다.

## 90일 운영 로드맵
- 1단계 0-30일: 도쿄/오사카 허브만 연다. `질문`, `동행`, `현지 실시간`, `로컬리 픽` 4개만 운영한다. 운영팀이 매일 5~10개 시드 글을 직접 올리고, 호스트/로컬 파워유저 20~30명을 초대해 답변을 채운다.
- 2단계 31-60일: Q&A 채택, 신고 큐, 번역 보기, 도시 필터, 해결됨 정렬을 넣는다. 예약 완료 유저에게 `여행 전 질문 1개`, 여행 종료 유저에게 `현지 팁 1개`를 요청한다.
- 3단계 61-90일: 일본어 레인을 오픈하고, 한국어 인기글 중 번역 적합한 것만 큐레이션한다. 영어/중국어는 전체 오픈 대신 베스트 글 번역 소비부터 검증한다.

## 활성화 장치
- 첫 방문 시 도시 선택으로 피드를 좁혀 정보 밀도를 높인다.
- 경험/서비스 상세페이지 아래에 `이 도시 질문 보기`와 `호스트에게 물어보기 전 커뮤니티에서 먼저 보기`를 붙인다.
- 예약 후 3일 전에는 `이번 주 도쿄에서 이것 물어본 사람 많아요` 같은 목적지형 리마인드를 보낸다.
- 후기 유저에게는 `나중에 같은 질문에 답할 수 있는 배지`를 준다. 포인트보다 정체성이 더 중요하다.
- 운영팀은 주 1회 `이번 주 도시별 핫이슈`를 발행한다. 이것이 검색 유입과 재방문을 동시에 만든다.

## 테스트 케이스와 수용 기준
- 한국어 질문이 `도쿄 / 여행 전 / 질문`으로 저장되고 같은 도시 피드에 즉시 노출된다.
- 일본어 사용자 기본 피드는 일본어 원문 우선, 한국어 글은 번역 카드로만 보인다.
- Q&A에서 작성자가 댓글을 채택하면 글 상태가 `해결됨`으로 바뀌고 정렬 필터에 반영된다.
- 동행 글은 날짜가 지나면 자동 내려가고, 신고 누적 시 운영 큐로 이동한다.
- 신규 계정은 링크/과도한 이미지 업로드/연속 댓글이 제한된다.
- 운영 KPI:
  - 30일 내 질문당 첫 답변 중앙값 6시간 이하
  - 질문 글의 35% 이상이 24시간 내 답변 1개 이상 확보
  - 여행 후 후기 작성 전환율 8% 이상
  - 동행 글 신고율 2% 이하
  - 한국어 허브에서 자연 유입 대비 재방문율 25% 이상

## 명시적 가정과 기본값
- 1차 시장은 한국 거주 일본 여행자와 일본 현지 응답자다.
- 초기에는 전담 모더레이터가 많지 않다고 가정하고, `도시 2개 + 카테고리 4개`로 좁혀 시작한다.
- 실제 live DB의 현재 게시글 수와 최근 활동량은 이 환경에서 Supabase DNS 접근이 실패해 검증하지 못했다. 따라서 현황 비교는 코드베이스 구조 기준이다.
- 기본값은 `하나의 커뮤니티 엔진`, `두 개의 활성 언어 레인`, `네 개 언어 지원`, `도시 우선 정보 구조`다.
