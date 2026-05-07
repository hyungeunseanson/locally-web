import type { HostLandingLocale } from "./hostLandingAssets";

type HostLandingFaqItem = {
    question: string;
    answer: string;
};

type HostLandingFaqGroup = {
    title: string;
    items: HostLandingFaqItem[];
};

type HostLandingFaqContent = {
    sectionTitle: string;
    groups: HostLandingFaqGroup[];
};

export const HOST_LANDING_FAQ: Record<HostLandingLocale, HostLandingFaqContent> = {
    ko: {
        sectionTitle: "자주 묻는 질문과 답변",
        groups: [
            {
                title: "자주 하는 질문",
                items: [
                    {
                        question: "어떤 체험이 로컬리에 잘 맞나요?",
                        answer:
                            "로컬리는 자격증 기반의 투어보다, 실제로 그 동네를 즐기고 소개할 수 있는 호스트의 취향과 시선을 더 중요하게 봅니다. 단골 카페와 로컬 맛집을 함께 도는 코스, 동네 산책, 공예·원데이 클래스, 패션·빈티지 숍 투어처럼 '내가 좋아하는 일상'이 드러나는 체험이 잘 맞습니다.",
                    },
                    {
                        question: "외국어를 유창하게 해야 하나요?",
                        answer:
                            "필수는 아닙니다. 기본적인 응대가 가능하고, 필요한 경우 번역 앱이나 사전 안내 메시지로 소통할 수 있으면 충분합니다. 언어 실력보다 더 중요한 건 게스트를 편안하게 맞이하고 체험 흐름을 안정적으로 이끄는 태도입니다.",
                    },
                    {
                        question: "전문 가이드 자격이나 영업허가가 필요한가요?",
                        answer:
                            "로컬리에서 진행하는 일반적인 취향 기반 체험은 별도의 가이드 자격증이나 영업허가를 전제로 하지 않습니다. 다만 음식 제조, 운송, 전문 레슨처럼 별도 규정이 적용될 수 있는 활동은 실제 운영 방식에 맞게 사전에 확인해야 합니다.",
                    },
                ],
            },
            {
                title: "호스팅 기본사항",
                items: [
                    {
                        question: "호스트가 준비해야 할 기본 정보는 무엇인가요?",
                        answer:
                            "체험 소개, 진행 장소, 예상 소요 시간, 포함·불포함 사항, 준비물, 최대 인원, 예약 가능 일정이 기본입니다. 게스트가 '누구와 어떤 시간을 보내게 되는지'를 바로 이해할 수 있도록 한눈에 읽히는 설명이 중요합니다.",
                    },
                    {
                        question: "예약은 어떻게 관리하나요?",
                        answer:
                            "호스트 대시보드에서 예약 현황, 문의, 일정 조율, 정산 흐름을 한 번에 확인하는 방식입니다. 게스트별 특이사항이나 요청사항도 한곳에서 정리할 수 있도록 운영 흐름을 단순하게 가져가는 게 로컬리 방향입니다.",
                    },
                    {
                        question: "한 달에 많이 열지 않아도 괜찮나요?",
                        answer:
                            "괜찮습니다. 주말 중심, 월 몇 회 운영처럼 호스트 일정에 맞춰 시작해도 됩니다. 처음부터 과하게 열기보다, 실제로 소화 가능한 일정과 인원으로 시작하는 쪽이 후기와 재방문에 더 유리합니다.",
                    },
                ],
            },
            {
                title: "지원 절차",
                items: [
                    {
                        question: "지원 후에는 어떤 순서로 진행되나요?",
                        answer:
                            "기본 신청서 제출 후, 체험 콘셉트와 운영 방식이 로컬리 방향과 맞는지 확인합니다. 필요하면 소개 문구, 일정 구성, 사진 자료를 조금 더 다듬어 달라고 요청할 수 있고, 정리되면 등록과 공개 단계로 넘어갑니다.",
                    },
                    {
                        question: "사진이나 상세 설명은 어느 정도까지 준비해야 하나요?",
                        answer:
                            "완벽한 브랜드 소개서 수준까지는 필요 없습니다. 다만 게스트가 체험 장면을 상상할 수 있을 정도의 사진과, 진행 흐름이 보이는 설명은 꼭 있어야 합니다. 이 페이지처럼 비주얼 톤이 좋을수록 전환에 유리합니다.",
                    },
                    {
                        question: "이미 운영 중인 체험을 옮겨와도 되나요?",
                        answer:
                            "가능합니다. 다만 기존 플랫폼 설명을 그대로 복사하기보다, 로컬리 톤에 맞게 더 개인적이고 매거진처럼 읽히는 방식으로 다시 정리하는 게 좋습니다. 호스트의 결, 공간의 분위기, 게스트가 남길 기억을 중심으로 바꾸는 쪽이 적합합니다.",
                    },
                ],
            },
            {
                title: "정산 및 운영",
                items: [
                    {
                        question: "정산은 언제 확인할 수 있나요?",
                        answer:
                            "예약이나 결제 직후 바로 정산되는 것이 아니라, 체험이 완료된 뒤 정산 대기 흐름으로 반영됩니다. 호스트는 대시보드에서 진행 중 예상 수익과 정산 대기 상태를 구분해 확인할 수 있습니다.",
                    },
                    {
                        question: "수수료는 어떻게 적용되나요?",
                        answer:
                            "호스트가 설정한 가격을 기준으로 플랫폼 운영 수수료가 반영됩니다. 세부 정산 정책은 실제 운영 단계에서 안내하지만, 체험 가격을 잡을 때는 이동 시간, 준비 비용, 응대 시간까지 포함해서 보는 것이 좋습니다.",
                    },
                    {
                        question: "취소나 일정 변경 요청은 어떻게 대응하면 좋나요?",
                        answer:
                            "로컬리는 체험 소개 단계에서 집합 장소, 준비물, 변경 가능 범위를 최대한 명확하게 적는 것을 권장합니다. 운영 중에는 메시지 응답 속도와 사전 안내 품질이 만족도에 직접 연결되기 때문에, 표준 안내 문구를 미리 준비해두는 편이 효율적입니다.",
                    },
                ],
            },
        ],
    },
    en: {
        sectionTitle: "Frequently asked questions",
        groups: [
            {
                title: "Common questions",
                items: [
                    {
                        question: "What kind of experience works well on Locally?",
                        answer:
                            "Locally is less about licensed tours and more about a host's point of view: the places they genuinely enjoy and know well. Experiences that feel close to everyday local life tend to resonate most, whether that is a favorite cafe route, a neighborhood walk, a craft session, or a vintage shopping stop.",
                    },
                    {
                        question: "Do I need to be fluent in another language?",
                        answer:
                            "Not necessarily. If you can welcome guests with confidence and handle the basics, that is often enough. Translation apps and clear pre-trip messages can fill the gaps. What matters more is making guests feel comfortable and guiding the experience with a calm, reliable rhythm.",
                    },
                    {
                        question: "Do I need a guide license or business permit?",
                        answer:
                            "In most cases, lifestyle-led experiences on Locally do not require a separate guide license or business permit. That said, activities tied to food production, transportation, or specialist instruction may follow different rules, so it is important to check what applies to the way you plan to host.",
                    },
                ],
            },
            {
                title: "Hosting essentials",
                items: [
                    {
                        question: "What basic information should a host prepare?",
                        answer:
                            "You will want the essentials in place: what the experience is, where it happens, how long it takes, what is included, what guests should bring, the maximum group size, and when it is available. The best listings make it easy to picture both the host and the time guests will share with them.",
                    },
                    {
                        question: "How do I manage reservations?",
                        answer:
                            "Reservations are handled through the host dashboard, where you can keep track of bookings, guest questions, schedule coordination, and payout status in one place. The goal is to keep operations simple, so the practical details stay organized without taking over your hosting flow.",
                    },
                    {
                        question: "Is it okay if I only host a few times a month?",
                        answer:
                            "Yes. You can begin in a way that fits your schedule, whether that means weekends only or just a handful of dates each month. Starting with a pace you can comfortably deliver usually leads to better reviews and a steadier hosting rhythm than opening too many dates too soon.",
                    },
                ],
            },
            {
                title: "Application process",
                items: [
                    {
                        question: "What happens after I apply?",
                        answer:
                            "Once you submit the application, the team reviews whether your concept and hosting style fit the direction of Locally. If needed, we may ask you to refine the description, schedule flow, or photo materials a little further. After that, the listing moves into setup and publishing.",
                    },
                    {
                        question: "How much do I need to prepare for photos and descriptions?",
                        answer:
                            "You do not need a polished brand deck. What matters is having photos that help guests imagine the atmosphere and copy that clearly shows how the experience unfolds. Strong visuals and a clear narrative tend to help guests feel ready to book.",
                    },
                    {
                        question: "Can I bring over an experience I already run elsewhere?",
                        answer:
                            "Yes. In most cases, it works best to adapt it rather than copy the listing over as-is. On Locally, the strongest pages feel more personal and editorial, with the host's character, the mood of the place, and the memory guests will take home at the center.",
                    },
                ],
            },
            {
                title: "Payouts and operations",
                items: [
                    {
                        question: "When can I see payout details?",
                        answer:
                            "Payouts are not reflected immediately when a booking is made or paid. They move into the payout-waiting flow after the experience is completed, and hosts can separate in-progress expected earnings from pending payouts in the dashboard.",
                    },
                    {
                        question: "How are platform fees applied?",
                        answer:
                            "Platform fees are applied based on the price you set for the experience. The detailed payout policy is shared during onboarding, but when you decide on pricing, it helps to account for your prep time, travel time, materials, and guest communication as part of the work.",
                    },
                    {
                        question: "How should I handle cancellations or schedule-change requests?",
                        answer:
                            "The best approach starts on the listing itself. Clear meeting-point details, what to bring, and what can or cannot be adjusted help prevent confusion later. During hosting, fast replies and consistent pre-trip messages make a real difference, so it is worth preparing a few standard replies in advance.",
                    },
                ],
            },
        ],
    },
    ja: {
        sectionTitle: "よくあるご質問",
        groups: [
            {
                title: "よくいただくご質問",
                items: [
                    {
                        question: "Locallyでは、どんな体験がよく選ばれますか？",
                        answer:
                            "Locallyでは、資格ベースのツアーよりも、その街を本当に楽しみ、紹介できるホスト自身の視点や好みを大切にしています。行きつけのカフェやローカルなお店をめぐる時間、街歩き、クラフトや1日クラス、ヴィンテージショップ巡りのように、自分らしい日常が伝わる体験がよく合います。",
                    },
                    {
                        question: "外国語が流暢でないと難しいですか？",
                        answer:
                            "必須ではありません。基本的な案内ができて、必要に応じて翻訳アプリや事前メッセージを使ってやり取りできれば十分です。語学力以上に大切なのは、ゲストが安心できる雰囲気をつくり、体験を落ち着いて進められることです。",
                    },
                    {
                        question: "ガイド資格や営業許可は必要ですか？",
                        answer:
                            "Locallyで扱う一般的なライフスタイル型の体験では、ガイド資格や営業許可を前提としない場合がほとんどです。ただし、飲食の提供、送迎、専門レッスンなど別の規定が関わる内容については、実際の運営方法に合わせて事前確認が必要です。",
                    },
                ],
            },
            {
                title: "ホスティングの基本",
                items: [
                    {
                        question: "ホストが準備しておくべき基本情報は何ですか？",
                        answer:
                            "体験の紹介、開催場所、所要時間、含まれるもの・含まれないもの、持ち物、最大人数、予約可能日程が基本になります。誰とどんな時間を過ごせるのかがひと目で伝わる、わかりやすい説明が大切です。",
                    },
                    {
                        question: "予約はどのように管理しますか？",
                        answer:
                            "予約状況、問い合わせ、日程調整、精算の流れは、ホストダッシュボードでまとめて確認できます。ゲストごとの特記事項やリクエストも一か所で整理できるようにし、運営の流れをできるだけシンプルに保つのがLocallyの考え方です。",
                    },
                    {
                        question: "月に数回だけの開催でも大丈夫ですか？",
                        answer:
                            "もちろん大丈夫です。週末中心や月に数回など、ご自身のペースに合わせて始められます。最初から無理に多くの日程を開けるより、きちんと届けられる日程と人数で始めるほうが、レビューや再予約にもつながりやすくなります。",
                    },
                ],
            },
            {
                title: "申請の流れ",
                items: [
                    {
                        question: "申請後はどのような流れで進みますか？",
                        answer:
                            "基本申請を送信いただいた後、体験のコンセプトや運営スタイルがLocallyの方向性と合っているかを確認します。必要に応じて、紹介文や日程構成、写真素材を少し整えていただくことがあります。その後、掲載準備と公開の段階へ進みます。",
                    },
                    {
                        question: "写真や詳細説明はどの程度まで準備すればいいですか？",
                        answer:
                            "完成されたブランド資料のようなものまでは必要ありません。ただ、ゲストが体験の空気感を思い描ける写真と、流れが伝わる説明は必要です。ビジュアルの雰囲気と説明のわかりやすさがそろうほど、予約への後押しになります。",
                    },
                    {
                        question: "すでに他で運営している体験を持ち込めますか？",
                        answer:
                            "はい、可能です。ただし、既存の掲載文をそのまま移すより、Locallyらしいトーンに合わせて少し書き直すのがおすすめです。ホストの人柄、場所の空気、ゲストが持ち帰る記憶が伝わる形に整えると、より相性のよいページになります。",
                    },
                ],
            },
            {
                title: "精算と運営",
                items: [
                    {
                        question: "精算の状況はいつ確認できますか？",
                        answer:
                            "精算は予約や決済の直後に反映されるのではなく、体験完了後に精算待ちの流れへ反映されます。ホストはダッシュボードで、進行中の見込み収益と精算待ちの状態を分けて確認できます。",
                    },
                    {
                        question: "手数料はどのように適用されますか？",
                        answer:
                            "手数料は、ホストが設定した体験価格を基準に反映されます。詳細な精算ポリシーは実際の運営段階で案内されますが、価格を決める際には移動時間、準備コスト、ゲスト対応の時間まで含めて考えるのがおすすめです。",
                    },
                    {
                        question: "キャンセルや日程変更の相談にはどう対応するとよいですか？",
                        answer:
                            "いちばん大切なのは、掲載ページの段階で集合場所、持ち物、変更できる範囲をできるだけ明確にしておくことです。運営中は返信の早さと事前案内の質が満足度に直結するため、よく使う案内文をあらかじめ用意しておくとスムーズです。",
                    },
                ],
            },
        ],
    },
    zh: {
        sectionTitle: "常见问题解答",
        groups: [
            {
                title: "常见问题",
                items: [
                    {
                        question: "什么样的体验更适合发布在 Locally？",
                        answer:
                            "Locally看重的不是持证导览式行程，而是房东真正熟悉并愿意分享的在地视角。像常去的咖啡馆路线、街区散步、手作或一日课程、复古店巡游这类能展现你日常喜好的体验，通常会更适合这里。",
                    },
                    {
                        question: "一定要外语很流利吗？",
                        answer:
                            "不一定。只要你能完成基本接待，并在需要时借助翻译工具或行前说明与客人沟通，通常就足够了。比语言更重要的是，让客人感到放松安心，并把整段体验带得顺畅稳定。",
                    },
                    {
                        question: "需要导游资格或营业许可吗？",
                        answer:
                            "在Locally上，大多数生活方式导向的体验并不以导游证或营业许可为前提。不过，如果内容涉及餐饮制作、运输接送或专业教学等可能受到单独规定约束的活动，就需要根据实际运营方式提前确认。",
                    },
                ],
            },
            {
                title: "开始接待前的基础事项",
                items: [
                    {
                        question: "房东需要先准备哪些基本信息？",
                        answer:
                            "最基本的内容包括体验介绍、进行地点、预计时长、包含与不包含的内容、需要携带的物品、最大人数以及可预约日程。最重要的是，让客人一眼就能明白自己会和谁一起度过怎样的一段时间。",
                    },
                    {
                        question: "预订是怎么管理的？",
                        answer:
                            "你可以在房东后台统一查看预订状态、咨询、时间协调和结算进度。客人的特殊说明或额外请求也能集中整理。Locally希望把运营流程尽量做得清晰简单，让你把更多注意力放在接待本身。",
                    },
                    {
                        question: "如果我一个月只开放几次也可以吗？",
                        answer:
                            "当然可以。你完全可以按照自己的节奏开始，比如只在周末开放，或每月只做几场。与其一开始排得很满，不如先从自己真正能稳定接待的时间和人数开始，这通常更有利于评价和复购。",
                    },
                ],
            },
            {
                title: "申请流程",
                items: [
                    {
                        question: "提交申请后，会按什么流程进行？",
                        answer:
                            "提交基础申请后，团队会先确认你的体验概念和运营方式是否符合Locally的方向。如果有需要，我们可能会请你再补充或润色一下介绍文案、行程结构或照片素材。整理完成后，就会进入上架准备和公开阶段。",
                    },
                    {
                        question: "照片和详细说明需要准备到什么程度？",
                        answer:
                            "不需要做到完整品牌提案的程度，但一定要让客人能够想象体验现场的氛围，并清楚了解体验是如何展开的。图片质感和叙述清晰度越好，通常越有助于转化。",
                    },
                    {
                        question: "已经在别的平台运营的体验，也可以搬过来吗？",
                        answer:
                            "可以。不过比起原样复制，更建议按照Locally的语气重新整理。这里更适合把房东本人的气质、空间的氛围，以及客人最后会带走的记忆放在页面中心，让整段体验读起来更有人味，也更像一本精选故事。",
                    },
                ],
            },
            {
                title: "结算与运营",
                items: [
                    {
                        question: "什么时候可以查看结算进度？",
                        answer:
                            "结算不会在预订或付款后立刻反映，而是在体验完成后进入待结算流程。房东可以在后台区分查看进行中预计收入和待结算状态。",
                    },
                    {
                        question: "平台费用是怎么计算的？",
                        answer:
                            "平台费用会基于你设置的体验价格进行计算。具体结算政策会在实际运营阶段说明，但在定价时，建议把准备时间、移动时间、材料成本和接待沟通时间都一起考虑进去。",
                    },
                    {
                        question: "遇到取消或改期请求时，怎样处理比较好？",
                        answer:
                            "最好的做法，是在体验介绍阶段就把集合地点、需要准备的物品，以及可调整的范围尽量说明清楚。正式运营后，回复速度和行前说明的质量会直接影响客人体验，因此提前准备几条常用回复会更高效。",
                    },
                ],
            },
        ],
    },
};
