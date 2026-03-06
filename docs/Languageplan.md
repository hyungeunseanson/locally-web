Claude’s Plan
About / Become-a-Host 페이지 i18n 번역 구현 계획
Context
/about와 /become-a-host 페이지의 모든 UI 텍스트가 한국어로 하드코딩되어 있어,
영어/일본어/중국어 사용자에게는 번역 없이 노출됨.
기존 LanguageContext 시스템(t() + useLanguage hook)을 활용해
Airbnb 스타일로 모든 사용자 노출 텍스트를 완전 번역한다.

수정 대상 파일 (3개)
파일	역할
app/context/LanguageContext.tsx	번역 키 ~100개 추가 (4개 언어)
app/about/page.tsx	useLanguage 연결, 하드코딩 텍스트 → t() 치환
app/become-a-host/page.tsx	동일
전제: 기존 i18n 시스템

// 사용 패턴
import { useLanguage } from '@/app/context/LanguageContext';
const { t, lang } = useLanguage();
// 두 파일 모두 이미 'use client' → 추가 작업 불필요
네이밍 컨벤션: snake_case, 카테고리 접두사 (about_, become_)

[STEP 1] LanguageContext.tsx — 번역 키 추가
app/context/LanguageContext.tsx 각 언어 블록(ko, en, ja, zh)에 아래 키 삽입.
기존 키 마지막 항목 뒤에 추가.

About 페이지 키 (56개)
키	ko	en	ja	zh
about_hero_title_1	여행은	Travel is	旅は	旅行就是
about_hero_title_2	살아보는 거야.	about living it.	生きてみること。	去生活体验。
about_hero_desc	유명한 관광지가 아닌, 현지인의 일상 속으로.\n전 세계의 이웃들이 당신을 기다립니다.	Not famous sights, but into a local's daily life.\nNeighbors around the world are waiting for you.	有名な観光地ではなく、地元の人の日常へ。\n世界中のご近所さんがあなたを待っています。	不是著名景点，而是融入当地人的日常生活。\n全世界的邻居都在等待着你。
about_cta_explore	여행 둘러보기	Explore Trips	旅を探す	浏览旅行
about_cta_host	호스트 되기	Become a Host	ホストになる	成为房东
about_mockup_search	어디로 떠나세요?	Where are you going?	どこへ行きますか？	您要去哪里？
about_mockup_search_sub	현지인 체험 검색	Search local experiences	地元体験を検索	搜索本地体验
about_mockup_heading_1	내일 도쿄에서	Experiences in Tokyo	明日東京で	明日在东京
about_mockup_heading_2	진행되는 체험	tomorrow	開催される体験	进行的体验
about_mockup_time	오전 10시	10:00 AM	午前10時	上午10点
about_mockup_card_title_1	마린과 함께하는	Bakery Tour	マリンと行く	玛琳的
about_mockup_card_title_2	도쿄 빵집 투어	with Marine	東京パン屋ツアー	东京面包店之旅
about_mockup_card_price	₩35,000 / 인	₩35,000 / person	₩35,000 / 人	₩35,000 / 人
about_stats_title	가장 사랑받는 로컬 커뮤니티	The Most Loved Local Community	最も愛されるローカルコミュニティ	最受欢迎的本地社区
about_stats_desc	전 세계 여행자와 호스트가 만들어가는 따뜻한 연결	Warm connections built by travelers and hosts worldwide	世界中の旅人とホストが作る温かいつながり	全球旅行者与房东共同创造的温暖连接
about_listing_title	당신의 취향을 발견하세요	Discover Your Taste	あなたの好みを見つけよう	发现你的喜好
about_listing_desc	가이드북에는 없는, 오직 로컬리에서만 가능한 경험들.	Experiences not in guidebooks, only possible on Locally.	ガイドブックにない、Locallyだけの体験。	在导览书中找不到的，只有Locally才能体验的经历。
about_listing_see_all	모든 체험 보기	See All Experiences	すべての体験を見る	查看全部体验
about_listing_per_person	/ 인	/ person	/ 人	/ 人
about_card1_title	미쿠의 도쿄 기치조지 투어	Miku's Tokyo Kichijoji Tour	みくの東京吉祥寺ツアー	美玖的东京吉祥寺之旅
about_card2_title	유스케의 도쿄 빈티지 투어	Yusuke's Tokyo Vintage Tour	ゆうすけの東京ヴィンテージツアー	祐介的东京复古之旅
about_card3_title	사치의 교토 데마치야나기 워킹	Sachi's Kyoto Demachiyanagi Walk	さちの京都出町柳ウォーキング	幸子的京都出町柳步行之旅
about_card4_title	마유의 8시간 도쿄 정복 투어	Mayu's 8-Hour Tokyo Conquest Tour	まゆの8時間東京制覇ツアー	茉悠的8小时东京征服之旅
about_card5_title	카나의 오사카 텐마 이자카야	Kana's Osaka Tenma Izakaya	かなの大阪天満居酒屋	加奈的大阪天满居酒屋
about_card6_title	유우카의 홋카이도 비에이 워킹	Yuuka's Hokkaido Biei Walk	ゆうかの北海道美瑛ウォーキング	结花的北海道美瑛步行之旅
about_feat1_title_1	여행 전부터 시작되는	Connected with locals	旅の前から始まる	旅行前就开始的
about_feat1_title_2	현지인과의 소통	before your trip	地元の人とのつながり	与当地人的交流
about_feat1_desc	예약 전에도, 후에도 궁금한 점은 언제든 물어보세요.\n맛집 추천부터 복장 팁까지, 호스트가 친절하게 알려드립니다.	Ask anything before or after booking.\nFrom restaurant tips to dress codes, your host is here to help.	予約前でも後でも、疑問はいつでも聞いてください。\nグルメ情報から服装のヒントまで、ホストが丁寧に教えます。	预订前后随时提问。\n从美食推荐到穿着建议，房东都会热心解答。
about_chat_host_name	Kana 호스트	Host Kana	Kanaホスト	房东Kana
about_chat_online	● 온라인	● Online	● オンライン	● 在线
about_chat_host_msg	안녕하세요! 예약해주셔서 감사합니다. 혹시 못 드시는 음식이 있으신가요? 🍜	Hi! Thanks for booking. Do you have any dietary restrictions? 🍜	こんにちは！ご予約ありがとうございます。苦手な食べ物はありますか？🍜	您好！感谢预订。请问您有什么饮食禁忌吗？🍜
about_chat_guest_msg	네! 해산물은 조금 어려워요. 고기 위주로 부탁드려도 될까요?	I can't eat seafood. Could we focus on meat dishes?	はい！魚介類が少し苦手です。お肉中心にお願いできますか？	我对海鲜有些不适应，可以以肉食为主吗？
about_feat2_title_1	복잡한 계획 없이	Travel freely	複雑な計画なしに	无需繁琐计划
about_feat2_title_2	떠나는 자유로움	without complex plans	떠나는 자유로움	自由出发
about_feat2_desc	일일이 검색하고 예약할 필요 없습니다.\n현지 호스트가 검증한 최적의 코스로 편안하게 즐기세요.	No need to search and book everything yourself.\nRelax and enjoy the best routes curated by local hosts.	いちいち検索して予約する必要はありません。\n地元ホストが厳選した最適なコースで快適にお楽しみください。	无需逐一搜索和预订。\n轻松享受当地房东精心策划的最佳路线。
about_booking_confirmed	예약 확정됨	Booking Confirmed	予約確定	预订已确认
about_booking_number	예약번호 #LC-882910	Booking #LC-882910	予約番号 #LC-882910	预订号 #LC-882910
about_booking_exp_label	체험	Experience	体験	体验
about_booking_date_label	일시	Date & Time	日時	日期
about_booking_exp_name	오사카 텐마 투어	Osaka Tenma Tour	大阪天満ツアー	大阪天满之旅
about_booking_date_val	5월 24일, 18:00	May 24, 6:00 PM	5月24日 18:00	5月24日 18:00
about_booking_pax_label	인원	Guests	人数	人数
about_booking_pax_val	2명	2 guests	2名	2人
about_trust_title	안전한 여행을 위한 약속	Our Promise for Safe Travel	安全な旅のための約束	安全旅行的承诺
about_trust_id_title	신원 인증	Identity Verification	本人確認	身份认证
about_trust_id_desc	모든 호스트와 게스트는 엄격한 신원 확인 절차를 거칩니다.	All hosts and guests go through a rigorous identity verification process.	すべてのホストとゲストは厳格な本人確認を経ます。	所有房东和客人都经过严格的身份验证程序。
about_trust_pay_title	안전 결제	Secure Payments	安全決済	安全支付
about_trust_pay_desc	체험이 완료될 때까지 결제 대금은 안전하게 보호됩니다.	Your payment is securely held until the experience is complete.	体験が完了するまで、お支払い代金は安全に保護されます。	在体验完成之前，您的付款将受到安全保护。
about_trust_support_title	24시간 지원	24/7 Support	24時間サポート	24小时支持
about_trust_support_desc	여행 중 문제가 생기면 언제든 글로벌 지원팀이 도와드립니다.	Our global support team is available anytime you need help during your trip.	旅行中に問題が起きたら、いつでもグローバルサポートチームがお手伝いします。	旅途中遇到问题，全球支持团队随时为您提供帮助。
about_faq_title	자주 묻는 질문	Frequently Asked Questions	よくある質問	常见问题
about_faq1_q	Locally는 어떤 서비스인가요?	What is Locally?	Locallyとはどんなサービスですか？	Locally是什么服务？
about_faq1_a	Locally는 전 세계 현지인(로컬)과 여행자를 연결하는 플랫폼입니다. 단순한 가이드 투어가 아닌, 현지인의 삶과 문화를 직접 경험하고 소통하는 '진짜 여행'을 지향합니다.	Locally is a platform connecting travelers with locals around the world. We go beyond guided tours to offer authentic experiences of local life and culture.	Locallyは世界中の地元の人（ローカル）と旅行者をつなぐプラットフォームです。単なるガイドツアーではなく、地元の人の生活と文化を直接体験する「本物の旅」を目指しています。	Locally是一个将全球当地人与旅行者连接起来的平台。不仅仅是导览，而是让您直接体验当地人的生活和文化的"真实旅行"。
about_faq2_q	일본어를 못해도 괜찮나요?	Do I need to speak Japanese?	日本語が話せなくても大丈夫ですか？	不会日语也可以吗？
about_faq2_a	네, 가능합니다! 한국어가 가능한 일본인 호스트나, 현지에 거주하는 한국인 호스트가 진행하는 체험이 많습니다. 언어 걱정 없이 편하게 즐기세요.	Yes! Many hosts speak your language or are native speakers living locally. Enjoy the experience without any language worries.	はい、大丈夫です！韓国語が話せる日本人ホストや、現地在住の韓国人ホストが進行する体験がたくさんあります。言語の心配なく楽しんでください。	完全可以！很多房东会说您的语言，或者是居住在当地的外籍房东。请放心享受，无需担心语言问题。
about_faq3_q	결제는 안전한가요?	Is payment secure?	支払いは安全ですか？	支付安全吗？
about_faq3_a	모든 결제는 Locally의 암호화된 보안 시스템을 통해 안전하게 처리됩니다. 예약금은 체험이 정상적으로 종료된 후에 호스트에게 지급되므로 안심하셔도 좋습니다.	All payments are processed securely through Locally's encrypted system. Your payment is held and only released to the host after the experience is successfully completed.	すべての支払いはLocallyの暗号化されたセキュリティシステムで安全に処理されます。予約金は体験が正常に終了した後にホストに支払われるので、安心してください。	所有付款均通过Locally加密安全系统处理。预订款项在体验成功完成后才会转给房东，请放心。
about_faq4_q	예약 취소 및 환불 규정은 어떻게 되나요?	What is the cancellation and refund policy?	予約キャンセル・返金規定はどうなっていますか？	取消和退款政策是什么？
about_faq4_a	호스트가 설정한 환불 정책에 따라 달라집니다. 일반적으로 체험 7일 전까지는 전액 환불이 가능하며, 자세한 내용은 각 체험 페이지 하단에서 확인하실 수 있습니다.	It depends on the host's refund policy. Generally, full refunds are available up to 7 days before the experience. Check the experience page for details.	ホストが設定した返金ポリシーによって異なります。一般的に体験7日前までは全額返金が可能で、詳細は各体験ページ下部でご確認いただけます。	取决于房东设定的退款政策。一般情况下，体验7天前可全额退款，详情请在各体验页面底部查看。
about_faq5_q	나도 호스트가 될 수 있나요?	Can I become a host?	私もホストになれますか？	我也可以成为房东吗？
about_faq5_a	물론입니다! 현지에 거주하며 나만의 특별한 이야기나 재능이 있다면 누구나 호스트가 될 수 있습니다. 상단 '호스트 되기' 메뉴를 통해 신청해주세요.	Absolutely! Anyone living locally with a unique story or talent can become a host. Apply through the "Become a Host" menu above.	もちろんです！現地に住んでいて、自分だけの特別なストーリーや才能があれば誰でもホストになれます。上部の「ホストになる」メニューから申し込んでください。	当然可以！只要居住在当地，有独特的故事或才能，任何人都可以成为房东。请通过上方的"成为房东"菜单申请。
about_footer_title_1	지금 바로 Locally와	Start your journey	今すぐLocallyと	立即与Locally
about_footer_title_2	함께하세요.	with Locally.	一緒に始めましょう。	一起出发。
about_footer_cta_explore	여행 시작하기	Start Exploring	旅を始める	开始旅行
about_footer_cta_host	호스트 되기	Become a Host	ホストになる	成为房东
Become-a-Host 페이지 키 (42개)
키	ko	en	ja	zh
become_hero_title_1	좋아하는 일을 하며	Earn	好きなことをしながら	做自己喜欢的事
become_hero_title_highlight	수입	income	収入	创造收入
become_hero_title_2	을 올리세요.	doing what you love.	を得ましょう。	。
become_hero_desc	수많은 외국인 게스트의 시선을 사로잡을\n독특한 로컬리 체험을 만들어 보세요.	Create a unique Locally experience\nthat captivates guests from around the world.	多くの外国人ゲストを惹きつける\nユニークなLocallyの体験を作りましょう。	创造独特的Locally体验，\n吸引来自世界各地的游客。
become_hero_cta_start	시작하기	Get Started	始める	立即开始
become_hero_cta_status	내 신청 현황 확인	Check My Application	申請状況を確認	查看我的申请
become_mockup_search	검색을 시작해 보세요	Start searching...	検索してみましょう	开始搜索
become_mockup_heading_1	내일 서울에서	Experiences in Seoul	明日ソウルで	明日在首尔
become_mockup_heading_2	진행되는 체험	tomorrow	開催される体験	进行的体验
become_mockup_time	오전 10시	10:00 AM	午前10時	上午10点
become_mockup_card_title	건축가와 함께하는 북촌 산책	Bukchon Walk with an Architect	建築家と行く北村散策	与建筑师同游北村
become_mockup_card_price	₩45,000 / 인	₩45,000 / person	₩45,000 / 人	₩45,000 / 人
become_benefits_title_1	어디서도 만나볼 수 없는	Host experiences	どこにもない	举办无与伦比的
become_benefits_title_2	독특한 체험을 호스팅하세요	found nowhere else	ユニークな体験をホスティングしよう	独特体验
become_feat1_title	내가 사는 도시의 매력 소개	Share Your City's Charm	住んでいる街の魅力を紹介	展示你所在城市的魅力
become_feat1_desc	랜드마크, 박물관, 문화 명소를 둘러보는 특별한 일정을 준비해 보세요.	Create a special itinerary visiting landmarks, museums, and cultural spots.	ランドマーク、博物館、文化スポットを巡る特別なスケジュールを準備しましょう。	准备一个游览地标、博物馆和文化景点的特别行程。
become_feat2_title	좋아하는 것으로 수익 창출	Turn Your Passion into Income	好きなことで収益化	将爱好转化为收入
become_feat2_desc	맛집 탐방, 등산, 쇼핑 등 평소 즐기던 활동을 하며 쏠쏠한 부수입을 만드세요.	Earn extra income doing activities you love, like dining out, hiking, or shopping.	グルメ巡り、登山、ショッピングなど普段楽しんでいる活動をしながら副収入を得ましょう。	通过您日常喜爱的活动，如美食探店、登山、购物等，获得额外收入。
become_feat3_title	내 일정에 맞춘 자유로운 활동	Flexible Schedule, Your Way	自分のスケジュールに合わせた自由な活動	按照自己的时间灵活安排
become_feat3_desc	주말, 평일 저녁, 혹은 한 달에 한 번. 내가 원하는 시간에만 투어를 오픈하세요.	Open tours on weekends, weekday evenings, or just once a month — whatever works for you.	週末、平日の夜、または月に一度。自分の好きな時間だけツアーを公開しましょう。	周末、工作日晚上，或者一个月一次——完全按照您的时间表开放活动。
become_chat_name	Alexi 님	Alexi	Alexiさん	Alexi
become_chat_status	예약 완료 · 5월 22일	Booked · May 22	予約完了 · 5月22日	已预订 · 5月22日
become_chat_guest_msg	안녕하세요! 이번 주말 투어 정말 기대돼요. 혹시 채식 메뉴 추천도 가능할까요? 🥗	Hi! I'm so excited for this weekend's tour. Can you recommend vegetarian options? 🥗	こんにちは！今週末のツアーがとても楽しみです。ベジタリアンメニューの紹介もできますか？🥗	您好！我非常期待这个周末的活动。您能推荐素食餐厅吗？🥗
become_chat_host_msg	물론이죠! 비건 옵션이 훌륭한 식당 리스트를 이미 준비해뒀습니다 :)	Of course! I've already prepared a list of restaurants with great vegan options :)	もちろんです！すでに素晴らしいヴィーガンオプションのあるレストランリストを準備してあります :)	当然！我已经准备好了一份提供优质素食选择的餐厅列表 :)
become_comm_title	게스트와 간편한 소통	Easy Communication with Guests	ゲストとの簡単なコミュニケーション	与客人轻松沟通
become_comm_desc	앱 내 채팅 기능을 통해 전 세계 게스트와 실시간으로 대화하세요.\n개인 연락처 노출 걱정 없이 안전하게 소통할 수 있습니다.	Chat with guests worldwide in real time through the in-app messaging.\nCommunicate safely without exposing personal contact info.	アプリ内チャット機能を通じて世界中のゲストとリアルタイムで会話しましょう。\n個人の連絡先を公開する心配なく安全にコミュニケーションが取れます。	通过应用内聊天功能与全球客人实时交流。\n无需担心个人联系方式泄露，安全沟通。
become_payout_title	투명하고 신속한 정산	Transparent & Fast Payouts	透明で迅速な精算	透明快速的结算
become_payout_desc	체험이 완료되면 다음 달 바로 입금됩니다.\n복잡한 절차 없이 수익을 확인하고 관리하세요.	Get paid the following month after your experience is complete.\nTrack and manage your earnings with ease.	体験が完了したら翌月すぐに入金されます。\n複雑な手続きなしに収益を確認・管理してください。	体验完成后次月即可到账。\n无需繁琐手续，轻松查看和管理收益。
become_payout_label	5월 정산 예정 금액	May Payout Estimate	5月の精算予定金額	五月预计结算金额
become_payout_account_label	지급 계좌	Payout Account	支払口座	收款账户
become_payout_account_val	카카오뱅크 **** 1234	Bank **** 1234	カカオバンク **** 1234	银行 **** 1234
become_payout_date_label	다음 지급일	Next Payout Date	次回支払日	下次结算日
become_payout_date_val	내일	Tomorrow	明日	明天
become_faq_title	자주 묻는 질문	Frequently Asked Questions	よくある質問	常见问题
become_faq1_q	외국어를 원어민처럼 잘해야 하나요?	Do I need to speak a foreign language fluently?	外国語をネイティブのように話せる必要はありますか？	需要像母语者一样流利地说外语吗？
become_faq1_a	아니요! 기본적인 의사소통만 가능하다면 충분합니다. 번역기 앱을 활용해도 괜찮습니다. 중요한 건 언어 실력보다 친절한 마음과 즐거운 분위기입니다.	Not at all! Basic communication is enough. Translation apps work great too. What matters most is a kind heart and a fun atmosphere, not language skill.	いいえ！基本的なコミュニケーションが取れれば十分です。翻訳アプリを活用しても大丈夫。大切なのは言語力より、親切な心と楽しい雰囲気です。	完全不需要！基本的沟通能力就足够了，使用翻译软件也没问题。重要的是友善的态度和愉快的氛围，而非语言水平。
become_faq2_q	자격증이 필요한가요?	Do I need a certification or license?	資格証が必要ですか？	需要资格证书吗？
become_faq2_a	전문 가이드 자격증은 필수가 아닙니다. 로컬리는 '현지인 친구' 컨셉의 여행을 지향합니다. 다만, 특정 전문 지식이 필요한 투어라면 관련 내용을 소개에 적어주세요.	Professional guide certification is not required. Locally is all about the "local friend" concept. However, if specialized knowledge is required for your tour, please mention it in your profile.	専門ガイドの資格証は必須ではありません。Locallyは「地元の友人」コンセプトの旅を目指しています。ただし、特定の専門知識が必要なツアーの場合は、紹介文に記載してください。	不需要专业导游资格证。Locally追求"本地朋友"概念的旅行。但如果您的活动需要特定专业知识，请在简介中注明。
become_faq3_q	수수료는 얼마인가요?	What is the commission fee?	手数料はいくらですか？	佣金是多少？
become_faq3_a	호스트 수수료는 20%입니다. 설정하신 금액의 80%가 정산됩니다. 게스트에게는 별도의 플랫폼 수수료가 부과됩니다.	The host commission is 20%. You receive 80% of the price you set. Guests are charged a separate platform fee.	ホスト手数料は20%です。設定した金額の80%が精算されます。ゲストには別途プラットフォーム手数料が請求されます。	房东佣金为20%。您设定价格的80%将结算给您。客人另行收取平台服务费。
become_cta_title	지금 바로 시작해보세요	Start Right Now	今すぐ始めましょう	立即开始
become_cta_desc	당신의 평범한 하루가 누군가에게는 잊지 못할 추억이 됩니다.	Your ordinary day can become someone's unforgettable memory.	あなたのごく普通の一日が、誰かにとって忘れられない思い出になります。	您平凡的一天，可能成为别人难忘的回忆。
become_cta_btn_start	호스트 등록하기	Register as Host	ホスト登録する	注册成为房东
become_cta_btn_status	내 신청 현황 확인	Check My Application	申請状況を確認	查看我的申请
[STEP 2] about/page.tsx — 텍스트 치환
파일 상단에 추가:


import { useLanguage } from '@/app/context/LanguageContext';
AboutPage() 함수 내 첫 줄에:


const { t } = useLanguage();
FAQItem 컴포넌트는 string을 props로 받으므로 호출부에서 t() 적용.

주요 치환 목록 (줄 번호는 현재 파일 기준)
위치	Before	After
L61-62	여행은 <br/><span>살아보는 거야.</span>	{t('about_hero_title_1')} <br/><span>{t('about_hero_title_2')}</span>
L68-69	설명 문단	{t('about_hero_desc').split('\n').map(...)} 또는 dangerouslySetInnerHTML 대신 <br/> 포함 JSX
L75	여행 둘러보기	{t('about_cta_explore')}
L80	호스트 되기	{t('about_cta_host')}
L96	어디로 떠나세요?	{t('about_mockup_search')}
L97	현지인 체험 검색	{t('about_mockup_search_sub')}
L101	내일 도쿄에서<br/>진행되는 체험	{t('about_mockup_heading_1')}<br/>{t('about_mockup_heading_2')}
L108	오전 10시	{t('about_mockup_time')}
L115	마린과 함께하는<br/>도쿄 빵집 투어	{t('about_mockup_card_title_1')}<br/>{t('about_mockup_card_title_2')}
L116	₩35,000 / 인	{t('about_mockup_card_price')}
L149	stats h2	{t('about_stats_title')}
L150	stats p	{t('about_stats_desc')}
L175	취향 h2	{t('about_listing_title')}
L177	취향 p	{t('about_listing_desc')}
L180	모든 체험 보기	{t('about_listing_see_all')}
L253	/ 인	{t('about_listing_per_person')}
6개 카드 title 필드	한국어 제목	t('about_card1_title') ...
L274	Kana 호스트, ● 온라인	t()
L277	호스트 메시지	t('about_chat_host_msg')
L280	게스트 메시지	t('about_chat_guest_msg')
L289	feat1 h3	{t('about_feat1_title_1')}<br/>{t('about_feat1_title_2')}
L291-292	feat1 p	{t('about_feat1_desc')} (줄바꿈: <br/> 처리)
L303	feat2 h3	{t('about_feat2_title_1')}<br/>{t('about_feat2_title_2')}
L305-306	feat2 p	{t('about_feat2_desc')}
L316-322	예약 모달 내용	각각 t()
L337	trust h2	{t('about_trust_title')}
L342-354	3개 카드 제목/설명	t()
L361	FAQ h2	{t('about_faq_title')}
L363-382	5개 FAQItem	props에 t() 적용
L389-390	footer h2	{t('about_footer_title_1')}<br/>{t('about_footer_title_2')}
L395	여행 시작하기	{t('about_footer_cta_explore')}
L400	호스트 되기	{t('about_footer_cta_host')}
줄바꿈 처리 패턴 (desc처럼 \n 포함 키):


// 간단한 2줄 → 명시적 <br/> 분리 (가독성 우선)
<p>
  {t('about_feat1_desc').split('\n')[0]}<br/>
  {t('about_feat1_desc').split('\n')[1]}
</p>
[STEP 3] become-a-host/page.tsx — 텍스트 치환
파일 상단에 추가:


import { useLanguage } from '@/app/context/LanguageContext';
BecomeHostPage() 함수 내 최상단에:


const { t } = useLanguage();
FeatureItem / FAQItem 컴포넌트는 string props를 받으므로, 호출부에서 t() 적용.

주요 치환 목록
위치	Before	After
L75-76	좋아하는 일을 하며<br/><span>수입</span>을 올리세요.	{t('become_hero_title_1')}<br/><span className="text-rose-600">{t('become_hero_title_highlight')}</span>{t('become_hero_title_2')}
L79-80	히어로 설명	{t('become_hero_desc').split('\n')[0]}<br/>{t('become_hero_desc').split('\n')[1]}
L87	hasApplication ? "내 신청 현황 확인" : "시작하기"	hasApplication ? t('become_hero_cta_status') : t('become_hero_cta_start')
L97	검색바 placeholder	{t('become_mockup_search')}
L98	모바일 heading	{t('become_mockup_heading_1')}<br/>{t('become_mockup_heading_2')}
L102	오전 10시	{t('become_mockup_time')}
L106	카드 제목	{t('become_mockup_card_title')}
L107	카드 가격	{t('become_mockup_card_price')}
L127-128	혜택 h2	{t('become_benefits_title_1')}<br/>{t('become_benefits_title_2')}
L131-133	3개 FeatureItem	title/desc에 t()
L146	Alexi 님 / 예약 완료	t()
L148-149	채팅 메시지	t()
L153	소통 h3	{t('become_comm_title')}
L154	소통 p	{t('become_comm_desc').split('\n')[0]}<br/>{...split('\n')[1]}
L159	정산 h3	{t('become_payout_title')}
L160	정산 p	split('\n') 처리
L164-168	정산 모달 내용	t()
L178	FAQ h2	{t('become_faq_title')}
L180-182	3개 FAQItem	q/a에 t()
L187	CTA h2	{t('become_cta_title')}
L188	CTA p	{t('become_cta_desc')}
L193	hasApplication ? "내 신청 현황 확인" : "호스트 등록하기"	hasApplication ? t('become_cta_btn_status') : t('become_cta_btn_start')
회귀 방지 체크
항목	영향 여부
AirbnbCounter 컴포넌트	변경 없음 (숫자 로직)
FAQItem 컴포넌트 (about)	내부 구조 변경 없음, 호출부 props만 변경
FeatureItem / FAQItem 컴포넌트 (become)	내부 구조 변경 없음, 호출부 props만 변경
handleStartClick 로직	변경 없음
Supabase 쿼리	변경 없음
스타일/레이아웃	변경 없음 (클래스명 유지)
통계 라벨 (Active Hosts, Cities 등)	이미 영문 → 유지 (영문 브랜딩)
"Travel like a local with locals" 슬로건	영문 브랜딩 → 유지
"Locally Cover" 브랜드명	유지
검증 방법
브라우저 언어 스위처로 en/ja/zh 전환 → /about 전체 텍스트 번역 확인
/become-a-host 동일 확인
ko 다시 전환 → 한국어 원문 정상 표시 확인
버튼 클릭 동작 (여행 둘러보기, 호스트 되기, 시작하기 등) 회귀 없음 확인
FAQ 토글 동작 정상 확인