import type { Locale } from '@/app/context/LanguageContext';

export type HelpTab = 'guest' | 'host';

export type HelpFeaturedTopic = {
  id: string;
  label: string;
  query: string;
  tab: HelpTab;
};

export type HelpFaqItem = {
  id: string;
  q: string;
  a: string;
  searchTerms: string[];
};

export type HelpFaqCategory = {
  id: string;
  label: string;
  icon: HelpFaqIconKey;
  items: HelpFaqItem[];
};

export type HelpFaqIconKey =
  | 'prebooking'
  | 'payment'
  | 'message'
  | 'cancellation'
  | 'service'
  | 'matching'
  | 'proxy'
  | 'care'
  | 'account'
  | 'review'
  | 'profile'
  | 'operation'
  | 'jobs'
  | 'payout'
  | 'policy';

export type HelpFaqLocaleContent = {
  featuredTitle: string;
  featuredTopics: HelpFeaturedTopic[];
  guest: HelpFaqCategory[];
  host: HelpFaqCategory[];
};

const ko: HelpFaqLocaleContent = {
  featuredTitle: '자주 찾는 질문',
  featuredTopics: [
    { id: 'confirm', label: '예약 확정', query: '예약 확정', tab: 'guest' },
    { id: 'deposit', label: '입금 대기', query: '입금', tab: 'guest' },
    { id: 'refund', label: '환불', query: '환불', tab: 'guest' },
    { id: 'host-chat', label: '호스트 연락', query: '호스트', tab: 'guest' },
    { id: 'service-request', label: '서비스 의뢰', query: '서비스 의뢰', tab: 'guest' },
    { id: 'proxy', label: '전화예약', query: '전화예약', tab: 'guest' },
  ],
  guest: [
    {
      id: 'guest-prebooking',
      label: '예약 전 확인',
      icon: 'prebooking',
      items: [
        {
          id: 'date-unavailable',
          q: '원하는 날짜가 없으면 어떻게 하나요?',
          a: '달력에 원하는 날짜가 없다면 먼저 호스트에게 문의해보세요. 호스트 일정에 따라 조율이 가능한 경우가 있고, 불가하면 다른 날짜나 비슷한 체험을 다시 비교하는 편이 가장 빠릅니다.',
          searchTerms: ['날짜', '달력', '예약 가능일', '일정', '원하는 날짜'],
        },
        {
          id: 'private-vs-regular',
          q: '프라이빗 예약과 일반 예약은 무엇이 다른가요?',
          a: '프라이빗 예약은 일행만 참여하는 방식이고, 일반 예약은 다른 게스트와 함께 진행될 수 있습니다. 상세 페이지의 예약 유형과 옵션을 먼저 확인하고, 보이지 않으면 호스트에게 가능 여부를 물어보세요.',
          searchTerms: ['프라이빗', '단독', '일반 예약', '전세', 'private'],
        },
        {
          id: 'solo-guarantee',
          q: '1인 출발 보장 옵션은 언제 필요한가요?',
          a: '혼자 여행 중이지만 인원 미달 걱정 없이 일정 확정을 원할 때 사용하는 옵션입니다. 추가 요금을 내고 확정한 뒤 다른 게스트가 합류하면, 추가로 낸 보장 비용은 환불됩니다.',
          searchTerms: ['1인', '1인 예약', '1인 출발', '혼자', '혼행', '단독 출발', 'solo'],
        },
        {
          id: 'included-costs',
          q: '포함·불포함 비용은 어디서 확인하나요?',
          a: '체험 상세 페이지의 포함 사항과 불포함 사항을 가장 먼저 확인해주세요. 식비나 개인 구매 비용처럼 현장에서 따로 결제되는 항목은 상세와 호스트 안내에 함께 적혀 있습니다.',
          searchTerms: ['포함', '불포함', '식비', '추가 비용', 'included'],
        },
        {
          id: 'kids-seniors-language',
          q: '아이·고령자·외국어가 걱정될 때는 어떻게 확인하나요?',
          a: '많이 걷는지, 연령 제한이 있는지, 어떤 언어로 안내되는지는 상세 페이지와 호스트 프로필을 함께 보시는 게 좋습니다. 애매하면 예약 전에 메시지로 동행자 상황을 알려주면 가장 정확하게 확인할 수 있습니다.',
          searchTerms: ['아이', '고령자', '어린이', '외국어', '언어', '동행자'],
        },
      ],
    },
    {
      id: 'guest-payment',
      label: '결제와 예약 확정',
      icon: 'payment',
      items: [
        {
          id: 'methods-supported',
          q: '카드·무통장·PayPal 중 어떤 결제가 가능한가요?',
          a: '현재 흐름에 따라 카드, 무통장 입금, PayPal 중 가능한 수단이 다르게 열립니다. 결제 페이지에 보이는 수단이 해당 예약이나 의뢰에 바로 사용할 수 있는 방식입니다.',
          searchTerms: ['카드', '무통장', 'paypal', '결제 수단', 'pay'],
        },
        {
          id: 'card-unavailable',
          q: '카드 결제가 안 될 때는 어떻게 하나요?',
          a: '카드 결제가 준비 중이거나 일시적으로 열리지 않으면 무통장 입금이나 PayPal로 바로 이어서 결제할 수 있습니다. 결제 페이지에 뜨는 안내 문구와 대체 수단을 그대로 따라주시면 됩니다.',
          searchTerms: ['카드 오류', '카드 결제', '결제 실패', '대체 결제', 'card unavailable'],
        },
        {
          id: 'bank-deadline',
          q: '무통장 입금은 언제까지 해야 하나요?',
          a: '입금 마감 시간은 주문별 결제 페이지에 표시된 시간이 기준입니다. 체험은 보통 예약 후 2시간, 맞춤 서비스는 보통 1시간 안에 입금하지 않으면 자동 취소됩니다.',
          searchTerms: ['입금', '무통장', '입금 마감', '입금 대기', '은행 이체'],
        },
        {
          id: 'when-confirmed',
          q: '결제 후 예약은 언제 확정되나요?',
          a: '카드나 PayPal은 결제 검증이 끝나면 바로 다음 단계로 넘어가고, 무통장 입금은 입금 확인 뒤 상태가 바뀝니다. 체험은 예약 확정으로, 맞춤 서비스는 호스트 모집 시작으로 이어집니다.',
          searchTerms: ['예약 확정', '결제 후', '상태 변경', '입금 확인', 'confirmed'],
        },
        {
          id: 'service-fee',
          q: '서비스 수수료는 무엇인가요?',
          a: '플랫폼 수수료는 결제 운영, 고객 지원, 안전 보호 같은 공통 운영 비용에 쓰입니다. 금액이 별도로 보이는 경우에는 결제 요약에서 함께 확인할 수 있습니다.',
          searchTerms: ['수수료', '서비스 수수료', '플랫폼 수수료', 'fee'],
        },
        {
          id: 'split-payment',
          q: '일행과 따로 결제할 수 있나요?',
          a: '같은 일정에 각각 예약한 뒤 호스트에게 같은 일행이라고 알려주면 됩니다. 다만 서로 다른 시간대로 예약하면 함께 진행되기 어렵기 때문에, 시간 선택은 먼저 맞춰두는 편이 안전합니다.',
          searchTerms: ['따로 결제', '일행', '분할 결제', '각자 결제'],
        },
      ],
    },
    {
      id: 'guest-messages',
      label: '예약 후 준비와 메시지',
      icon: 'message',
      items: [
        {
          id: 'when-chat-opens',
          q: '호스트와는 언제부터 메시지를 주고받나요?',
          a: '체험은 예약이 확정되면 호스트와의 메시지방이 열립니다. 맞춤 서비스는 매칭이 완료된 뒤 선택한 호스트와 메시지함에서 바로 조율할 수 있습니다.',
          searchTerms: ['메시지', '채팅', '호스트 연락', '대화방', 'inbox'],
        },
        {
          id: 'inbox-vs-notification',
          q: '문의 답변은 메시지함과 알림 중 어디서 보나요?',
          a: '답변의 실제 내용은 메시지함에서 확인하고, 새 답변이 왔다는 신호는 알림에서도 함께 받게 됩니다. 다시 찾아볼 때는 메시지함이 기준이라고 생각하시면 가장 편합니다.',
          searchTerms: ['메시지함', '알림', '문의 답변', 'inbox', 'notification'],
        },
        {
          id: 'what-to-share',
          q: '당일 전에 호스트에게 미리 알려두면 좋은 정보는 무엇인가요?',
          a: '일행 수, 도착 예정 시간, 사용할 언어, 음식 알레르기나 이동 관련 배려가 필요하다면 미리 알려주세요. 호스트가 준비를 더 정확하게 할 수 있어 당일 조율이 훨씬 자연스러워집니다.',
          searchTerms: ['미리 알려둘 정보', '알레르기', '도착 시간', '요청사항', '준비'],
        },
        {
          id: 'pending-stuck',
          q: '입금 대기 상태가 계속되면 어떻게 하나요?',
          a: '영수증이나 결제 완료 화면에서 계좌 정보와 입금 마감 시간을 다시 확인해보세요. 이미 입금했는데 상태가 오래 바뀌지 않는다면 고객센터에 문의하면 메시지함으로 이어서 안내받을 수 있습니다.',
          searchTerms: ['입금 대기', '대기 상태', '입금 확인', 'pending', '영수증'],
        },
        {
          id: 'host-tip',
          q: '호스트에게 팁을 드려도 되나요?',
          a: '팁은 자율적으로 드릴 수 있지만 필수이거나 기대되는 관행은 아닙니다. 실제로는 커피나 음식 한 잔처럼 가벼운 감사 표현으로 대신하는 경우가 많습니다. 다만 플랫폼 밖에서 큰 금액을 따로 주거나, 사전 합의 없는 추가 금전으로 이어지는 방식은 적절하지 않습니다.',
          searchTerms: ['팁', '팁 문화', '호스트 팁', '커피', '음식', '감사 표현', 'tipping'],
        },
      ],
    },
    {
      id: 'guest-cancellation',
      label: '취소·환불·변경',
      icon: 'cancellation',
      items: [
        {
          id: 'refund-rule',
          q: '취소 규정은 어떻게 계산되나요?',
          a: '현재 기준으로 체험일 당일이나 이미 지난 일정은 환불되지 않습니다. 그 외에는 결제 당일 취소 100%, 체험일 20일 전까지는 100%, 8~19일 전은 80%, 2~7일 전은 70%, 1일 전은 40% 환불됩니다. 호스트 사유 취소나 운영팀이 진행 불가를 확인한 취소는 전액 환불됩니다.',
          searchTerms: ['취소 규정', '환불 규정', '환불율', '환불률', 'policy'],
        },
        {
          id: 'late-no-show',
          q: '당일 지각·노쇼는 어떻게 처리되나요?',
          a: '체험은 정해진 시간에 시작되기 때문에 당일 지각이나 노쇼는 참여가 어려울 수 있고, 보통 당일 취소로 처리됩니다. 늦을 것 같다면 바로 호스트에게 메시지로 알려두는 것이 가장 중요합니다.',
          searchTerms: ['지각', '노쇼', '당일 취소', '늦음', 'late'],
        },
        {
          id: 'rainy-weather',
          q: '우천·악천후 시에는 어떻게 되나요?',
          a: '가벼운 비에는 진행되는 경우가 많지만, 태풍이나 안전 문제가 있는 날씨에는 호스트 판단으로 취소될 수 있습니다. 안전 사유 취소는 전액 환불 기준으로 처리됩니다.',
          searchTerms: ['우천', '비', '악천후', '날씨', '태풍'],
        },
        {
          id: 'ops-review-why',
          q: '호스트 진행 불가·최소 인원 미달은 왜 운영 검토가 필요한가요?',
          a: '이 두 사유는 실제 진행 불가 상태를 운영팀이 확인한 뒤 전액 환불 여부를 정리하는 흐름입니다. 검토가 끝나기 전에는 상태가 보류 중으로 보일 수 있고, 결과는 예약 상태와 알림으로 함께 안내됩니다.',
          searchTerms: ['운영 검토', '호스트 진행 불가', '최소 인원', '리뷰 요청', 'full refund'],
        },
        {
          id: 'refund-timing',
          q: '환불은 언제 돌아오나요?',
          a: '취소 승인 뒤에는 카드사나 결제사로 환불 요청이 바로 넘어갑니다. 카드사는 보통 영업일 기준 3~5일 정도, 체크카드는 더 빠르게 반영되는 경우가 많습니다.',
          searchTerms: ['환불 시점', '환불 언제', '카드 환불', '체크카드', 'refund time'],
        },
        {
          id: 'change-date',
          q: '날짜 변경은 가능한가요?',
          a: '예약이 확정된 뒤에는 날짜 변경이 기본적으로 열려 있지 않습니다. 대부분은 기존 예약을 취소하고 다시 예약하는 방식으로 정리해야 하며, 취소 시점에 따라 환불 규정이 적용될 수 있습니다.',
          searchTerms: ['날짜 변경', '일정 변경', '변경 가능', 'reschedule'],
        },
      ],
    },
    {
      id: 'guest-service-request',
      label: '맞춤 서비스 의뢰',
      icon: 'service',
      items: [
        {
          id: 'service-flow',
          q: '맞춤 서비스는 어떤 순서로 진행되나요?',
          a: '의뢰서를 작성하고 결제를 마치면 호스트 모집이 시작되고, 지원자를 비교한 뒤 한 명을 선택하면 매칭이 확정됩니다. 이후 세부 조율은 메시지함에서 이어집니다.',
          searchTerms: ['맞춤 서비스', '의뢰 순서', '서비스 흐름', 'request flow'],
        },
        {
          id: 'pay-right-away',
          q: '왜 의뢰 등록 직후 바로 결제해야 하나요?',
          a: '결제가 완료된 의뢰만 실제 모집이 열리기 때문입니다. 호스트 입장에서도 결제된 요청이라는 전제가 있어야 일정과 시간을 들여 지원할 수 있습니다.',
          searchTerms: ['바로 결제', '즉시 결제', '의뢰 등록', '선결제'],
        },
        {
          id: 'what-to-write',
          q: '어떤 내용을 써야 호스트 지원이 잘 모이나요?',
          a: '도시, 날짜, 시작 시간, 필요한 언어, 목적, 원하는 동행 범위를 구체적으로 적어주세요. 병원 통역인지 쇼핑 동행인지처럼 상황이 분명할수록 더 잘 맞는 호스트가 빨리 모입니다.',
          searchTerms: ['상세 설명', '지원 메시지', '호스트 지원', '의뢰 내용', 'description'],
        },
        {
          id: 'why-min-4h',
          q: '최소 이용시간 4시간 규칙은 왜 있나요?',
          a: '현재 맞춤 서비스의 가격 계산과 매칭 기준이 4시간 이상 단위로 설계되어 있기 때문입니다. 너무 짧은 요청보다 실제 이동과 조율이 가능한 단위로 맞추려는 운영 기준이라고 보시면 됩니다.',
          searchTerms: ['4시간', '최소 이용시간', 'minimum 4h', '서비스 시간'],
        },
        {
          id: 'request-private-before-pay',
          q: '결제 전까지 내 의뢰는 공개되나요?',
          a: '아니요. 결제가 확인되기 전에는 모집이 열리지 않고, 의뢰 상세에서도 결제가 필요하다는 상태로 보입니다. 결제 완료 뒤에야 호스트들이 지원할 수 있습니다.',
          searchTerms: ['공개', '모집 시작', '결제 전', 'request private'],
        },
      ],
    },
    {
      id: 'guest-service-matching',
      label: '서비스 결제·매칭',
      icon: 'matching',
      items: [
        {
          id: 'escrow-protection',
          q: '에스크로 선결제는 어떻게 보호되나요?',
          a: '서비스 결제금은 바로 호스트에게 넘어가지 않고, 매칭 전까지 안전하게 보관됩니다. 호스트를 선택하지 않으면 전액 환불 기준이 적용됩니다.',
          searchTerms: ['에스크로', '선결제', '보호', 'escrow', '안전 결제'],
        },
        {
          id: 'bank-locked',
          q: '무통장 상태로 바뀌면 왜 결제수단을 못 바꾸나요?',
          a: '이미 무통장 입금 대기 상태로 생성된 주문은 같은 결제 상태를 유지해야 하기 때문입니다. 중간에 수단을 바꾸면 주문 기준이 꼬일 수 있어 현재는 잠금 처리됩니다.',
          searchTerms: ['무통장 잠금', '결제수단 변경', 'bank locked', '입금 대기'],
        },
        {
          id: 'no-hosts-apply',
          q: '호스트가 아무도 지원하지 않으면 어떻게 되나요?',
          a: '결제가 끝난 의뢰는 열린 상태로 유지되며, 지원자가 들어오면 이 화면에서 바로 비교할 수 있습니다. 끝까지 호스트를 선택하지 않으면 결제금은 에스크로 기준에 따라 보호됩니다.',
          searchTerms: ['지원자 없음', '호스트 없음', '아무도 지원 안 함', 'no applicants'],
        },
        {
          id: 'how-to-choose-host',
          q: '여러 지원자 중 누구를 어떻게 선택하나요?',
          a: '지원 메시지, 가능한 언어, 후기, 소개를 함께 비교하면 됩니다. 가장 잘 맞는 한 명을 선택하면 매칭이 확정되고 그다음 조율은 바로 메시지함으로 이어집니다.',
          searchTerms: ['호스트 선택', '지원자 비교', '후기 비교', 'select host'],
        },
        {
          id: 'refund-without-selection',
          q: '호스트를 선택하지 않으면 환불은 어떻게 되나요?',
          a: '선택이 끝나지 않은 상태에서는 결제금이 바로 소진되지 않습니다. 결국 호스트를 선택하지 않기로 하면, 현재 서비스 결제 흐름 기준으로 전액 환불이 가능합니다.',
          searchTerms: ['전액 환불', '호스트 미선택', '선택 안 함', 'refund without host'],
        },
        {
          id: 'coordinate-after-match',
          q: '매칭 후 세부 조율은 어디서 하나요?',
          a: '서비스 상세에서는 진행 상태를 계속 확인하고, 실제 대화는 메시지함에서 이어가면 됩니다. 시간, 장소, 준비물처럼 바뀔 수 있는 내용은 메시지에 남겨두는 편이 가장 안전합니다.',
          searchTerms: ['매칭 후', '조율', '서비스 상세', '메시지함', 'coordinate'],
        },
      ],
    },
    {
      id: 'guest-proxy',
      label: '전화예약 요청',
      icon: 'proxy',
      items: [
        {
          id: 'proxy-scope',
          q: '전화예약으로 어떤 문의를 맡길 수 있나요?',
          a: '식당 예약, 숙소 문의, 교통 예약 문의, 재고·영업 여부 확인, 분실물 문의처럼 일본어 통화가 필요한 요청을 맡길 수 있습니다. 현재 카테고리에 없는 특수 요청은 먼저 범위를 확인하는 편이 안전합니다.',
          searchTerms: ['전화예약', '대리전화', '식당 예약', '숙소 문의', '전화 문의'],
        },
        {
          id: 'proxy-categories',
          q: '식당·숙소·교통·분실물·재고 확인은 각각 어떻게 다른가요?',
          a: '식당은 예약 가능 여부와 일반 문의, 숙소는 변경·취소나 확인, 교통은 택시나 셔틀 문의, 분실물은 접수와 회수 가능 여부, 일반 문의는 재고나 영업 여부 확인에 더 가깝습니다. 요청 유형을 맞게 선택해야 필요한 양식도 정확히 열립니다.',
          searchTerms: ['식당', '숙소', '교통', '분실물', '재고 확인', '카테고리'],
        },
        {
          id: 'one-call-rule',
          q: '1통 기준은 정확히 언제 성립되나요?',
          a: '상대 업장이 전화를 받는 순간 1통으로 간주됩니다. 연결 뒤 만석이나 불가 안내를 받은 경우도 진행된 통화로 처리됩니다.',
          searchTerms: ['1통', '한 통', '통화 기준', '업장이 받는 순간'],
        },
        {
          id: 'proxy-exclusions',
          q: '어떤 업장은 접수가 어려운가요?',
          a: '예약금이나 취소 수수료가 있는 식당, 노쇼 이력이 민감한 업장, 오마카세나 고가 코스처럼 위험 부담이 큰 예약은 접수가 제한될 수 있습니다. 신청 전 안내 문구를 꼭 확인해주세요.',
          searchTerms: ['접수 불가', '오마카세', '예약금', '취소 수수료', '미슐랭'],
        },
        {
          id: 'weekend-unreachable',
          q: '주말이나 연결 불가일 때는 어떻게 처리되나요?',
          a: '주말에는 응답이 조금 늦어질 수 있고, 영업시간 안에 여러 번 시도해도 연결이 되지 않거나 만석이면 그 결과 그대로 진행 완료로 정리될 수 있습니다. 진행 상황과 결과는 메시지함 스레드로 이어집니다.',
          searchTerms: ['주말', '연결 불가', '만석', '응답 지연', 'weekend'],
        },
        {
          id: 'extra-calls',
          q: '추가 통화가 필요하면 어떻게 되나요?',
          a: '기본 범위를 넘는 추가 통화나 복잡한 문제 해결은 별도 문의가 필요할 수 있습니다. 상황이 커지면 운영팀이 추가 진행 가능 여부를 먼저 안내합니다.',
          searchTerms: ['추가 통화', '별도 문의', '추가 비용', 'extra call'],
        },
        {
          id: 'proxy-results',
          q: '진행 결과는 어디서 확인하나요?',
          a: '전화예약 요청 후 운영팀 답변과 통화 결과는 메시지함 스레드에서 계속 확인할 수 있습니다. 새 답변이 오면 알림에서도 함께 확인됩니다.',
          searchTerms: ['진행 결과', '전화 결과', '메시지함', '답변 확인'],
        },
      ],
    },
    {
      id: 'guest-care',
      label: 'Locally Care·멤버십',
      icon: 'care',
      items: [
        {
          id: 'care-open',
          q: 'Locally Care는 누구에게 열리나요?',
          a: '구매가 완료된 게스트는 여행 전 질문을 Locally Care 흐름으로 더 바로 이어갈 수 있습니다. 다시 찾아온 고객일수록 이전 기록과 함께 더 자연스럽게 도움을 받을 수 있습니다.',
          searchTerms: ['Locally Care', '케어', '구매 고객', '여행 전 질문'],
        },
        {
          id: 'tier-difference',
          q: 'Tier 1과 Tier 2 차이는 무엇인가요?',
          a: 'Tier 1은 첫 구매로 로컬리와 연결이 시작된 단계이고, Tier 2는 다시 찾아온 게스트에게 열리는 단계입니다. Tier 2는 일반 게스트보다 더 빠른 안내와 가까운 케어가 강조됩니다.',
          searchTerms: ['Tier 1', 'Tier 2', '멤버십', '단계 차이'],
        },
        {
          id: 'tier-change',
          q: '멤버십 단계는 언제 바뀌나요?',
          a: '첫 구매가 완료되면 Tier 1이 열리고, 한 번 더 함께하면 Tier 2가 열립니다. 현재 단계와 다음 단계 안내는 계정 화면에서도 다시 확인할 수 있습니다.',
          searchTerms: ['멤버십 단계', 'Tier 변경', 'member since', '다음 단계'],
        },
        {
          id: 'pretrip-question',
          q: '여행 전 질문은 어디로 남기면 되나요?',
          a: '도움말센터 하단의 1:1 문의나 Locally Care 버튼으로 남기면 됩니다. 답변은 메시지함으로 이어지고, 새 소식은 알림에서도 확인할 수 있습니다.',
          searchTerms: ['여행 전 질문', '1:1 문의', '케어 문의', 'pre-trip'],
        },
      ],
    },
    {
      id: 'guest-account',
      label: '계정·안전',
      icon: 'account',
      items: [
        {
          id: 'login-email',
          q: '로그인 이메일은 바꿀 수 있나요?',
          a: '현재는 계정 화면에서 로그인 이메일을 직접 변경할 수 없습니다. 변경이 꼭 필요하다면 고객센터를 통해 안내를 받아야 합니다.',
          searchTerms: ['로그인 이메일', '이메일 변경', 'account email'],
        },
        {
          id: 'forgot-password',
          q: '비밀번호를 잊어버렸어요.',
          a: '현재는 비밀번호 재설정 기능이 별도로 열려 있지 않습니다. 처음 가입할 때 사용한 로그인 방식이나 소셜 로그인 수단을 다시 확인해주세요.',
          searchTerms: ['비밀번호', '로그인 실패', '비밀번호 재설정', 'password'],
        },
        {
          id: 'delete-account',
          q: '회원 탈퇴는 어떻게 하나요?',
          a: '회원 탈퇴는 운영팀이 도와드리고 있습니다. 도움말센터나 계정 화면에서 문의를 남기면 메시지함으로 이어서 안내받을 수 있습니다.',
          searchTerms: ['회원 탈퇴', '계정 삭제', '탈퇴', 'delete account'],
        },
        {
          id: 'no-off-platform',
          q: '왜 플랫폼 밖 직접 결제가 금지되나요?',
          a: '플랫폼 안에서 결제와 대화가 이어져야 문제 발생 시 결제 보호와 운영 지원이 가능합니다. 외부 직거래는 기록과 보호가 끊기기 때문에 현재 가이드라인상 허용되지 않습니다.',
          searchTerms: ['직접 결제', '오프플랫폼', '외부 결제', '직거래 금지'],
        },
        {
          id: 'host-trust',
          q: '호스트 신뢰 정보는 어디서 확인하나요?',
          a: '호스트 프로필, 언어 정보, 후기, 소개 문구와 같은 공개 정보를 먼저 확인해보세요. 실제 게스트 후기와 기본 인증 정보를 함께 보는 것이 가장 정확합니다.',
          searchTerms: ['호스트 신뢰', '후기', '인증', '프로필'],
        },
      ],
    },
  ],
  host: [
    {
      id: 'host-review',
      label: '지원과 심사',
      icon: 'review',
      items: [
        {
          id: 'review-timing',
          q: '지원 후 검토는 얼마나 걸리나요?',
          a: '검토 속도는 신청 순서와 보완 필요 여부에 따라 달라집니다. 현재 상태는 대시보드와 알림에서 확인할 수 있고, 추가 자료가 필요하면 그 흐름으로 바로 안내됩니다.',
          searchTerms: ['검토 기간', '지원 후', '심사', '승인 대기'],
        },
        {
          id: 'revision-location',
          q: '보완 요청은 어디서 확인하나요?',
          a: '보완 요청이 생기면 알림과 대시보드 상태에서 함께 확인할 수 있습니다. 필요한 항목을 수정해 다시 제출하면 검토가 이어집니다.',
          searchTerms: ['보완 요청', '수정 요청', '알림', 'dashboard'],
        },
        {
          id: 'good-fit',
          q: '어떤 체험·서비스가 로컬리에 잘 맞나요?',
          a: '자격증 중심 설명보다, 실제로 내가 잘 알고 즐기는 지역과 시간의 결이 드러나는 체험이 잘 맞습니다. 맞춤 서비스도 내가 정말 책임지고 도와줄 수 있는 범위가 분명할수록 좋습니다.',
          searchTerms: ['잘 맞는 체험', '로컬리 톤', '호스트 방향', 'fit'],
        },
        {
          id: 'language-license',
          q: '언어 수준·자격·허가는 어디까지 필요한가요?',
          a: '외국어가 항상 필수는 아니고, 필요한 범위에서 안정적으로 소통할 수 있으면 됩니다. 다만 음식 제공, 운송, 전문 레슨처럼 별도 규정이 붙는 활동은 실제 운영 방식에 맞게 먼저 확인해야 합니다.',
          searchTerms: ['언어 수준', '자격', '허가', '라이선스', 'permit'],
        },
        {
          id: 'reapply-after-reject',
          q: '반려 후 다시 지원할 수 있나요?',
          a: '네. 반려 사유를 확인하고 소개, 자료, 운영 계획을 정리한 뒤 다시 준비할 수 있습니다. 대시보드 안내를 기준으로 보완한 뒤 재지원하는 방식이 가장 안전합니다.',
          searchTerms: ['반려', '재지원', '다시 지원', 'reapply'],
        },
      ],
    },
    {
      id: 'host-profile',
      label: '체험 등록 준비',
      icon: 'profile',
      items: [
        {
          id: 'profile-photo-intro',
          q: '프로필·사진·소개는 어느 정도가 적절한가요?',
          a: '게스트가 누구와 시간을 보내는지 바로 떠올릴 수 있을 만큼 자연스럽고 구체적이면 충분합니다. 얼굴이 잘 보이는 사진, 내가 어떤 호스트인지 드러나는 소개, 실제 분위기가 보이는 설명이 중요합니다.',
          searchTerms: ['프로필', '사진', '소개', '자기소개', 'profile'],
        },
        {
          id: 'listing-details',
          q: '포함·불포함·준비물·일정은 어떻게 적어야 하나요?',
          a: '게스트가 예약 전에 바로 판단할 수 있게 모호하지 않게 적는 것이 가장 중요합니다. 포함 여부, 준비물, 이동량, 최대 인원, 시간 흐름이 한눈에 읽히면 문의가 확실히 줄어듭니다.',
          searchTerms: ['포함 불포함', '준비물', '일정 작성', '상세 설명'],
        },
        {
          id: 'not-too-many-dates',
          q: '너무 많은 날짜를 열지 않아도 되나요?',
          a: '네. 실제로 운영 가능한 날짜만 열어두는 편이 후기와 응대 안정성에 더 좋습니다. 무리해서 많이 열기보다 확실히 진행할 수 있는 일정으로 시작하는 것이 안전합니다.',
          searchTerms: ['날짜 관리', '오픈 일정', '캘린더', 'schedule'],
        },
        {
          id: 'migrate-from-other-platform',
          q: '다른 플랫폼 체험을 옮겨와도 되나요?',
          a: '가능합니다. 다만 기존 문구를 그대로 복사하기보다, 로컬리에서 만날 게스트에게 맞게 더 개인적이고 명확한 설명으로 다듬는 편이 전환에 도움이 됩니다.',
          searchTerms: ['다른 플랫폼', '기존 체험', '옮기기', 'migration'],
        },
      ],
    },
    {
      id: 'host-operation',
      label: '예약 운영',
      icon: 'operation',
      items: [
        {
          id: 'reply-speed',
          q: '게스트 문의에는 얼마나 빨리 답해야 하나요?',
          a: '정확한 숫자보다 중요한 건 빠르고 친절한 첫 응답입니다. 응답 품질과 속도는 신뢰와 응답률 지표에 직접 연결되기 때문에, 가능한 빨리 기본 안내를 주는 편이 좋습니다.',
          searchTerms: ['응답 속도', '답변', '문의 응대', 'response rate'],
        },
        {
          id: 'must-cancel',
          q: '부득이하게 취소해야 하면 어떻게 하나요?',
          a: '불가피한 사유가 생기면 가능한 한 빨리, 최소 하루 전에는 게스트에게 이유를 설명하고 운영 흐름에 맞게 처리해야 합니다. 호스트 사유 취소는 게스트 피해로 이어질 수 있어 더 신중해야 합니다.',
          searchTerms: ['취소', '부득이', '하루 전', 'host cancellation'],
        },
        {
          id: 'guest-late-noshow',
          q: '게스트 지각·노쇼는 어떻게 처리하나요?',
          a: '먼저 메시지로 상황을 남기고, 약속 시간 기준으로 진행 가능 여부를 판단하면 됩니다. 결제가 끝난 예약은 규정에 따라 노쇼 처리와 정산 흐름이 이어질 수 있습니다.',
          searchTerms: ['게스트 지각', '게스트 노쇼', 'late guest', 'no-show'],
        },
        {
          id: 'no-contact-before-booking',
          q: '예약 전 외부 연락처 교환이 왜 금지되나요?',
          a: '예약 전 외부 연락으로 빠지면 결제 보호와 분쟁 대응 기록이 끊기기 때문입니다. 현재 가이드라인상 카카오톡, 이메일 등 외부 연락처 교환은 예약 확정 전 허용되지 않습니다.',
          searchTerms: ['외부 연락처', '카카오톡', '이메일 교환', '오프플랫폼'],
        },
        {
          id: 'safety-briefing',
          q: 'Safety Briefing은 언제 필요한가요?',
          a: '걷기, 이동, 장비 사용, 혼잡한 장소처럼 게스트 안전에 영향을 줄 수 있는 요소가 있다면 시작 전에 꼭 안내하는 편이 좋습니다. 기본 규칙과 주의점을 짧게라도 먼저 전달해두면 리스크를 크게 줄일 수 있습니다.',
          searchTerms: ['Safety Briefing', '안전 안내', '시작 전 안내', 'briefing'],
        },
      ],
    },
    {
      id: 'host-jobs',
      label: '서비스 잡보드',
      icon: 'jobs',
      items: [
        {
          id: 'which-requests-show',
          q: '어떤 의뢰만 잡보드에 보이나요?',
          a: '현재 열려 있고 실제 지원 가능한 의뢰만 잡보드에 표시됩니다. 날짜, 지역, 언어 조건이 맞지 않거나 이미 닫힌 요청은 여기서 보이지 않습니다.',
          searchTerms: ['잡보드', '열린 의뢰', '서비스 의뢰', 'open requests'],
        },
        {
          id: 'what-to-write-appeal',
          q: '지원 메시지엔 무엇을 써야 하나요?',
          a: '비슷한 경험, 가능한 언어, 지금 바로 도와줄 수 있는 이유를 짧고 분명하게 적는 편이 좋습니다. 막연한 인사보다 실제로 어떤 도움을 줄 수 있는지가 보이는 메시지가 더 잘 읽힙니다.',
          searchTerms: ['지원 메시지', '어필', 'apply message', '서비스 지원'],
        },
        {
          id: 'after-selected',
          q: '고객이 나를 선택하면 다음 단계는 무엇인가요?',
          a: '선택되는 순간 매칭이 확정되고, 그다음 조율은 해당 의뢰 화면과 메시지함에서 이어집니다. 일정과 세부 요청을 확인하면서 실제 서비스 준비 단계로 넘어가면 됩니다.',
          searchTerms: ['선택됨', '매칭 확정', 'selected', 'next step'],
        },
        {
          id: 'not-selected',
          q: '선택되지 않으면 어떻게 표시되나요?',
          a: '이번에는 선택되지 않았다는 상태로 정리됩니다. 이미 남긴 지원 메시지는 기록으로 남지만, 그 의뢰에 대한 다음 단계는 더 이어지지 않습니다.',
          searchTerms: ['선택되지 않음', 'rejected', '미선택', 'not selected'],
        },
        {
          id: 'where-to-coordinate-service',
          q: '서비스 조율은 어디서 이어지나요?',
          a: '서비스 매칭 뒤에는 메시지함이 실제 조율의 중심입니다. 요청 상세에서는 상태를 보고, 메시지에서는 시간·장소·요청 범위를 구체적으로 맞추면 됩니다.',
          searchTerms: ['서비스 조율', '메시지함', '매칭 후 대화', 'coordinate'],
        },
      ],
    },
    {
      id: 'host-payout',
      label: '정산·계좌·세금',
      icon: 'payout',
      items: [
        {
          id: 'experience-vs-service-payout',
          q: '체험 정산과 서비스 정산은 어떻게 다른가요?',
          a: '대시보드에서는 체험과 서비스를 분리해서 보여주며, 서비스 쪽은 진행 중 예상 수익과 완료 후 정산 대기를 더 뚜렷하게 나눠 보여줍니다. 어떤 수익이 실제 지급 단계인지 구분해서 보는 것이 중요합니다.',
          searchTerms: ['체험 정산', '서비스 정산', '차이', 'earnings'],
        },
        {
          id: 'pending-inprogress-paid',
          q: '정산 대기·진행 중 예상 수익·지급 완료는 각각 무엇인가요?',
          a: '정산 대기는 완료 뒤 지급 대상으로 넘어온 금액, 진행 중 예상 수익은 아직 완료 전이거나 동기화 전인 금액, 지급 완료는 실제로 정산이 끝난 금액입니다. 각 단계는 수익 탭에서 분리해 확인할 수 있습니다.',
          searchTerms: ['정산 대기', '진행 중 예상 수익', '지급 완료', 'pending', 'paid'],
        },
        {
          id: 'bank-info-change',
          q: '계좌 정보는 어떻게 반영되나요?',
          a: '정산은 등록된 계좌 정보를 기준으로 진행됩니다. 개인 정보와 정산 정보는 직접 수정이 제한될 수 있어, 변경이 필요하면 고객센터를 통해 안전하게 반영해야 합니다.',
          searchTerms: ['계좌 정보', '정산 계좌', '계좌 변경', 'bank info'],
        },
        {
          id: 'fee-tax',
          q: '수수료와 세금은 누가 처리하나요?',
          a: '플랫폼 수수료는 운영 정책에 따라 반영되고, 세금 처리는 호스트 본인의 책임입니다. 실제 수익을 볼 때는 수수료 반영 이후 금액과 세무 처리를 따로 생각하는 것이 안전합니다.',
          searchTerms: ['수수료', '세금', '세무', 'tax', 'commission'],
        },
      ],
    },
    {
      id: 'host-policy',
      label: '정책·안전·신뢰',
      icon: 'policy',
      items: [
        {
          id: 'off-platform-penalty',
          q: '오프플랫폼 결제·우회 거래 적발 시 어떻게 되나요?',
          a: '개인 계좌 안내나 타 플랫폼 결제 유도는 엄격히 금지됩니다. 적발되면 계정 정지나 정산 보류 같은 강한 조치가 이어질 수 있습니다.',
          searchTerms: ['우회 거래', '오프플랫폼 결제', '개인 계좌', '정산 보류'],
        },
        {
          id: 'discrimination-safety',
          q: '차별·혐오·안전 위반은 어떻게 처리되나요?',
          a: '국적, 성별, 장애, 종교를 이유로 한 차별적 언행과 안전 위반은 허용되지 않습니다. 심각한 문제는 즉시 제한이나 추가 조치로 이어질 수 있습니다.',
          searchTerms: ['차별', '혐오', '안전 위반', 'safety issue'],
        },
        {
          id: 'reviews-response-rate',
          q: '후기와 응답률이 노출·예약률에 어떤 영향을 주나요?',
          a: '게스트는 후기와 소개, 응답 태도를 함께 보고 예약을 결정합니다. 답변이 늦거나 후기가 약하면 비교 단계에서 밀릴 수 있어, 작은 운영 습관이 예약률에 직접 연결됩니다.',
          searchTerms: ['후기', '응답률', '예약률', 'review', 'response'],
        },
        {
          id: 'popular-ranking',
          q: '인기 체험 노출은 무엇으로 결정되나요?',
          a: '현재 인기 체험 노출은 게스트의 위시리스트 저장 수를 바탕으로 집계됩니다. 사진, 소개, 실제 후기 경험을 꾸준히 다듬을수록 저장하고 싶은 체험으로 보이기 쉽습니다.',
          searchTerms: ['인기 체험', '위시리스트', '노출', '랭킹'],
        },
        {
          id: 'emergency-contact',
          q: '응급 상황이 생기면 누구에게 먼저 연락하나요?',
          a: '현장 안전이 우선이므로 긴급 상황에서는 먼저 119 같은 현지 긴급 대응을 우선해야 합니다. 그다음 플랫폼 지원센터에도 바로 알려 기록과 후속 대응이 이어지게 해주세요.',
          searchTerms: ['응급 상황', '119', '긴급 연락', 'emergency'],
        },
        {
          id: 'guest-tip',
          q: '게스트가 팁을 주겠다고 하면 받아도 되나요?',
          a: '게스트가 자율적으로 감사 표현을 하는 것은 가능하지만, 호스트가 먼저 요구하거나 서비스 품질과 연결해 기대하는 방식은 적절하지 않습니다. 실제로는 커피나 음식처럼 자연스러운 감사 표현이 더 일반적이며, 플랫폼 밖 별도 추가 금전 요구로 보일 수 있는 방식은 피하는 것이 안전합니다.',
          searchTerms: ['팁', '게스트 팁', '추가 금액', '감사 표현', '커피', '음식', 'tipping'],
        },
      ],
    },
  ],
};

const en: HelpFaqLocaleContent = {
  featuredTitle: 'Popular topics',
  featuredTopics: [
    { id: 'confirm', label: 'Booking confirmed', query: 'confirmed', tab: 'guest' },
    { id: 'deposit', label: 'Deposit pending', query: 'deposit', tab: 'guest' },
    { id: 'refund', label: 'Refund', query: 'refund', tab: 'guest' },
    { id: 'host-chat', label: 'Contact host', query: 'host', tab: 'guest' },
    { id: 'service-request', label: 'Custom service', query: 'service request', tab: 'guest' },
    { id: 'proxy', label: 'Phone booking', query: 'phone booking', tab: 'guest' },
  ],
  guest: [
    {
      id: 'guest-prebooking',
      label: 'Before booking',
      icon: 'prebooking',
      items: [
        {
          id: 'date-unavailable',
          q: "What should I do if I can't find the date I want?",
          a: 'If your preferred date is not on the calendar, message the host first. Some hosts can adjust their schedule, and if not, comparing a nearby date or a similar experience is usually the fastest next step.',
          searchTerms: ['date', 'calendar', 'availability', 'preferred date'],
        },
        {
          id: 'private-vs-regular',
          q: 'What is the difference between a private booking and a regular booking?',
          a: 'A private booking is just for your own group, while a regular booking can include other guests. Check the booking options on the experience page first, and message the host if the option is not visible.',
          searchTerms: ['private', 'regular booking', 'exclusive', 'group only'],
        },
        {
          id: 'solo-guarantee',
          q: 'When do I need the solo departure guarantee option?',
          a: 'It is for solo travelers who want the date confirmed even if the usual minimum group size is not met. If other guests join later, the extra solo guarantee fee is refunded.',
          searchTerms: ['solo', '1 person', 'guaranteed departure', 'single traveler'],
        },
        {
          id: 'included-costs',
          q: 'Where can I check what is included or excluded?',
          a: 'Start with the included and excluded section on the experience page. Extra items like meals or personal purchases are usually explained there and in the host notes.',
          searchTerms: ['included', 'excluded', 'meal cost', 'extra cost'],
        },
        {
          id: 'kids-seniors-language',
          q: 'How can I check if a trip works for children, seniors, or language concerns?',
          a: 'Review the experience details and the host profile together for walking intensity, language notes, and any restrictions. If you are unsure, message the host before booking and explain who is joining.',
          searchTerms: ['children', 'seniors', 'language', 'family', 'accessibility'],
        },
      ],
    },
    {
      id: 'guest-payment',
      label: 'Payment and confirmation',
      icon: 'payment',
      items: [
        {
          id: 'methods-supported',
          q: 'Which payment methods are available: card, bank transfer, or PayPal?',
          a: 'The available methods depend on the current flow. The methods shown on your payment page are the ones you can use for that booking or request right away.',
          searchTerms: ['card', 'bank transfer', 'paypal', 'payment method'],
        },
        {
          id: 'card-unavailable',
          q: 'What should I do if card payment is unavailable?',
          a: 'If card payment is still being prepared or is temporarily unavailable, you can continue with bank transfer or PayPal. Follow the fallback message shown on the payment page.',
          searchTerms: ['card unavailable', 'payment failed', 'fallback payment', 'card error'],
        },
        {
          id: 'bank-deadline',
          q: 'How long do I have to complete a bank transfer?',
          a: 'The deadline shown on your payment page is the rule for that order. Experiences are usually canceled after about 2 hours without payment, and custom services usually after about 1 hour.',
          searchTerms: ['deposit deadline', 'bank transfer deadline', 'payment pending', 'deposit'],
        },
        {
          id: 'when-confirmed',
          q: 'When is my booking confirmed after payment?',
          a: 'Card and PayPal flows move to the next step once payment verification finishes, while bank transfer moves after the deposit is confirmed. Experiences become confirmed bookings, and custom services move into host recruitment.',
          searchTerms: ['confirmed', 'after payment', 'status', 'payment confirmed'],
        },
        {
          id: 'service-fee',
          q: 'What is the service fee for?',
          a: 'The platform fee covers shared operating costs such as payment operations, customer support, and safety protection. If it is shown separately, you can review it in the payment summary.',
          searchTerms: ['service fee', 'platform fee', 'fee'],
        },
        {
          id: 'split-payment',
          q: 'Can my group pay separately?',
          a: 'Yes. Each person can book the same time slot separately and then message the host to say you are part of the same group. Matching the time slot first is the important part.',
          searchTerms: ['pay separately', 'split payment', 'group payment'],
        },
      ],
    },
    {
      id: 'guest-messages',
      label: 'After booking and messaging',
      icon: 'message',
      items: [
        {
          id: 'when-chat-opens',
          q: 'When can I start messaging the host?',
          a: 'For experiences, the chat opens once the booking is confirmed. For custom services, the direct coordination starts after you choose a host and the match is complete.',
          searchTerms: ['message host', 'chat', 'inbox', 'when chat opens'],
        },
        {
          id: 'inbox-vs-notification',
          q: 'Should I check replies in the inbox or in notifications?',
          a: 'The full reply lives in the inbox, while notifications let you know that something new has arrived. If you want the actual conversation, the inbox is the source to return to.',
          searchTerms: ['inbox', 'notifications', 'reply', 'message'],
        },
        {
          id: 'what-to-share',
          q: 'What should I tell the host before the day?',
          a: 'It helps to share your final group size, arrival timing, preferred language, food allergies, mobility needs, or anything else that affects the day. A little context makes the host’s preparation much easier.',
          searchTerms: ['before the day', 'share with host', 'allergy', 'arrival time', 'request'],
        },
        {
          id: 'pending-stuck',
          q: 'What should I do if the payment still says pending?',
          a: 'Recheck the receipt or payment-complete page for the bank details and payment deadline first. If you already paid and the status does not move for a while, contact support and the follow-up will continue in your inbox.',
          searchTerms: ['pending', 'deposit pending', 'receipt', 'bank details'],
        },
        {
          id: 'host-tip',
          q: 'Can I tip the host?',
          a: 'Tipping is voluntary and not required or expected. In practice, many guests choose a small thank-you gesture instead, such as buying coffee or food. What should be avoided is turning it into a large off-platform cash payment or any extra money request that was never agreed in advance.',
          searchTerms: ['tip', 'tipping', 'host tip', 'coffee', 'food', 'thank-you gesture'],
        },
      ],
    },
    {
      id: 'guest-cancellation',
      label: 'Cancellation, refund, and changes',
      icon: 'cancellation',
      items: [
        {
          id: 'refund-rule',
          q: 'How is the cancellation policy calculated?',
          a: 'At the moment, experience-day or past-date cancellations are non-refundable. Otherwise, cancellations on the payment day are refunded 100%, up to 20 days before the experience are 100%, 8 to 19 days before are 80%, 2 to 7 days before are 70%, and 1 day before is 40%. If the host cancels or the team confirms the experience could not proceed, the booking is fully refunded.',
          searchTerms: ['refund policy', 'cancellation policy', 'refund rate', 'policy'],
        },
        {
          id: 'late-no-show',
          q: 'What happens if I am late or miss the trip on the day?',
          a: 'Experiences start on time, so arriving late or not showing up can mean you cannot join and the request is treated like a same-day cancellation. If you are running late, message the host as soon as possible.',
          searchTerms: ['late', 'no-show', 'same-day cancellation', 'missed trip'],
        },
        {
          id: 'rainy-weather',
          q: 'What happens in rain or severe weather?',
          a: 'Light rain often still goes ahead, but the host may cancel for safety when the weather becomes severe. Safety-related cancellations are handled as full refunds.',
          searchTerms: ['rain', 'weather', 'storm', 'bad weather'],
        },
        {
          id: 'ops-review-why',
          q: 'Why do host-unavailable or minimum-participants cases need an operations review?',
          a: 'Those cases require the team to confirm what actually happened before finalizing the full refund flow. Until that review is complete, the booking can stay in a pending review state and the outcome is sent through status updates and notifications.',
          searchTerms: ['operations review', 'host unavailable', 'minimum participants', 'review'],
        },
        {
          id: 'refund-timing',
          q: 'When does the refund arrive?',
          a: 'Once the cancellation is approved, the refund request is sent to the card issuer or payment provider right away. Card issuers often take about 3 to 5 business days, while debit cards can appear sooner.',
          searchTerms: ['refund timing', 'when refund', 'card refund', 'debit card'],
        },
        {
          id: 'change-date',
          q: 'Can I change the date instead of canceling?',
          a: 'Once a booking is confirmed, direct date changes are generally not available. In most cases, the safer path is to cancel and rebook, with the current cancellation policy applied to the original booking.',
          searchTerms: ['change date', 'reschedule', 'move booking'],
        },
      ],
    },
    {
      id: 'guest-service-request',
      label: 'Custom service requests',
      icon: 'service',
      items: [
        {
          id: 'service-flow',
          q: 'What is the flow for a custom service request?',
          a: 'You write the request, complete payment, wait for host applications, compare applicants, and choose one host to confirm the match. After that, the detailed coordination continues in the inbox.',
          searchTerms: ['custom service', 'flow', 'service request', 'matching flow'],
        },
        {
          id: 'pay-right-away',
          q: 'Why do I need to pay right after submitting the request?',
          a: 'Only paid requests are opened to hosts for real applications. That payment step signals that the schedule and request are ready for hosts to review seriously.',
          searchTerms: ['pay right away', 'submit request', 'upfront payment'],
        },
        {
          id: 'what-to-write',
          q: 'What should I include so hosts are more likely to apply?',
          a: 'Be specific about the city, date, start time, required languages, your goal, and the kind of support you need. The clearer the situation is, the easier it is for the right host to apply quickly.',
          searchTerms: ['what to write', 'description', 'host applications', 'request details'],
        },
        {
          id: 'why-min-4h',
          q: 'Why is there a 4-hour minimum?',
          a: 'The current pricing and matching flow for custom services is designed around requests of at least 4 hours. It keeps the request realistic for travel time, coordination, and host availability.',
          searchTerms: ['4 hours', 'minimum', 'minimum duration'],
        },
        {
          id: 'request-private-before-pay',
          q: 'Is my request public before I pay?',
          a: 'No. Before payment is confirmed, the request stays closed and appears as waiting for payment. Hosts can only apply after the payment is complete.',
          searchTerms: ['public before payment', 'closed request', 'payment required'],
        },
      ],
    },
    {
      id: 'guest-service-matching',
      label: 'Service payment and matching',
      icon: 'matching',
      items: [
        {
          id: 'escrow-protection',
          q: 'How does the escrow payment protect me?',
          a: 'The payment does not move directly to the host before matching is complete. It stays protected in the custom-service flow, and if you do not choose a host, the payment can be fully refunded.',
          searchTerms: ['escrow', 'protected payment', 'safe payment'],
        },
        {
          id: 'bank-locked',
          q: "Why can't I change the payment method after it switches to bank-transfer pending?",
          a: 'Once an order has been created in a bank-transfer pending state, it needs to keep the same payment-state logic. That lock avoids breaking the order record halfway through the flow.',
          searchTerms: ['bank locked', 'change payment method', 'bank transfer pending'],
        },
        {
          id: 'no-hosts-apply',
          q: 'What happens if no hosts apply?',
          a: 'A paid request stays open for applications, and you can return to the request page to track progress. If no host is ultimately chosen, the payment remains protected under the escrow rule.',
          searchTerms: ['no hosts apply', 'no applicants', 'no applications'],
        },
        {
          id: 'how-to-choose-host',
          q: 'How should I choose between multiple applicants?',
          a: 'Compare their application message, languages, reviews, and introduction together. Once you choose the best fit, the match is confirmed and the next conversation continues in the inbox.',
          searchTerms: ['choose host', 'compare applicants', 'select host'],
        },
        {
          id: 'refund-without-selection',
          q: 'What happens to the refund if I do not choose a host?',
          a: 'If no host is selected, the payment is not treated as a completed host match. In the current custom-service flow, that means the payment remains eligible for a full refund.',
          searchTerms: ['refund without host', 'no host selected', 'full refund'],
        },
        {
          id: 'coordinate-after-match',
          q: 'Where do I coordinate the details after matching?',
          a: 'Use the request-detail page for status and the inbox for the actual conversation. Time, place, preparation details, and small changes are safest when they stay inside the message thread.',
          searchTerms: ['after matching', 'coordinate', 'inbox', 'request detail'],
        },
      ],
    },
    {
      id: 'guest-proxy',
      label: 'Phone booking requests',
      icon: 'proxy',
      items: [
        {
          id: 'proxy-scope',
          q: 'What kinds of requests can I submit through phone booking?',
          a: 'You can use it for restaurant bookings, accommodation inquiries, transport booking inquiries, stock or opening checks, and lost-item inquiries that need a Japanese phone call. Anything outside the current categories should be checked for scope first.',
          searchTerms: ['phone booking', 'proxy call', 'restaurant booking', 'lost item'],
        },
        {
          id: 'proxy-categories',
          q: 'What is the difference between restaurant, hotel, transport, lost item, and stock-check requests?',
          a: 'Restaurant requests focus on booking or availability, hotel requests on changes or general property questions, transport on taxi or shuttle inquiries, lost-item requests on recovery questions, and general inquiries on stock or opening checks. Choosing the right type opens the right form fields.',
          searchTerms: ['restaurant', 'hotel', 'transport', 'lost item', 'stock check', 'category'],
        },
        {
          id: 'one-call-rule',
          q: 'When does the one-call rule start?',
          a: 'A request counts as one completed call as soon as the business answers the phone. That includes cases where the result is sold out or unavailable after they pick up.',
          searchTerms: ['one call', 'call rule', 'business answers'],
        },
        {
          id: 'proxy-exclusions',
          q: 'Which venues are difficult to accept?',
          a: 'Venues with deposits or cancellation fees, no-show-sensitive restaurants, and higher-risk bookings such as omakase or premium preordered-course restaurants may be restricted. Check the request guidance before paying.',
          searchTerms: ['restricted venues', 'omakase', 'deposit', 'cancellation fee'],
        },
        {
          id: 'weekend-unreachable',
          q: 'What happens on weekends or when the business cannot be reached?',
          a: 'Weekend replies can be slower, and a request can still be treated as completed if attempts were made during business hours but the venue was unreachable or already full. Updates continue in the linked inbox thread.',
          searchTerms: ['weekend', 'unreachable', 'full', 'reply delay'],
        },
        {
          id: 'extra-calls',
          q: 'What if extra calls are needed?',
          a: 'If the case grows beyond the standard scope or needs repeated follow-up calls, an additional request may be needed. The team will tell you first before moving into a larger follow-up.',
          searchTerms: ['extra calls', 'additional request', 'more calls'],
        },
        {
          id: 'proxy-results',
          q: 'Where can I check the result?',
          a: 'Operational replies and call outcomes continue in the inbox thread tied to the request. New updates also appear in notifications, but the full record stays in the inbox.',
          searchTerms: ['result', 'outcome', 'inbox', 'notification'],
        },
      ],
    },
    {
      id: 'guest-care',
      label: 'Locally Care and membership',
      icon: 'care',
      items: [
        {
          id: 'care-open',
          q: 'Who gets access to Locally Care?',
          a: 'Guests with a completed purchase can continue pre-trip questions more directly through Locally Care. Returning guests can also receive more seamless follow-up based on that ongoing relationship.',
          searchTerms: ['Locally Care', 'care', 'completed purchase', 'pre-trip'],
        },
        {
          id: 'tier-difference',
          q: 'What is the difference between Tier 1 and Tier 2?',
          a: 'Tier 1 starts after your first purchase and marks the start of your relationship with Locally. Tier 2 opens for returning guests and focuses on earlier updates and closer care.',
          searchTerms: ['Tier 1', 'Tier 2', 'membership', 'difference'],
        },
        {
          id: 'tier-change',
          q: 'When does my membership tier change?',
          a: 'Tier 1 opens after your first purchase, and one more trip with Locally opens Tier 2. You can also see your current stage and next step in your account page.',
          searchTerms: ['tier change', 'membership stage', 'next step'],
        },
        {
          id: 'pretrip-question',
          q: 'Where should I leave pre-trip questions?',
          a: 'Use the 1:1 inquiry flow at the bottom of Help Center or the Locally Care button when it is available to you. Replies continue in your inbox and new ones also surface in notifications.',
          searchTerms: ['pre-trip question', '1:1 inquiry', 'care inquiry'],
        },
      ],
    },
    {
      id: 'guest-account',
      label: 'Account and safety',
      icon: 'account',
      items: [
        {
          id: 'login-email',
          q: 'Can I change my login email?',
          a: "At the moment, you can't change your login email directly from the account page. If it must be changed, you need help from support.",
          searchTerms: ['login email', 'change email', 'account email'],
        },
        {
          id: 'forgot-password',
          q: 'I forgot my password.',
          a: 'Password reset is not currently available as a separate self-service step. Please check the original login method or social sign-in option you used.',
          searchTerms: ['forgot password', 'password reset', 'login'],
        },
        {
          id: 'delete-account',
          q: 'How do I delete my account?',
          a: 'Our support team handles account deletion. Leave an inquiry from Help Center or the account page, and the follow-up will continue in your inbox.',
          searchTerms: ['delete account', 'close account', 'membership withdrawal'],
        },
        {
          id: 'no-off-platform',
          q: 'Why is off-platform direct payment not allowed?',
          a: 'Keeping payment and conversation on-platform protects both the payment record and the support trail if something goes wrong. Direct off-platform transactions break that protection, so they are not allowed.',
          searchTerms: ['off-platform', 'direct payment', 'outside payment', 'safety'],
        },
        {
          id: 'host-trust',
          q: 'Where can I check trust signals for a host?',
          a: 'Start with the host profile, languages, reviews, and introduction. Real guest reviews plus the host’s verified platform profile are the most reliable signals to compare.',
          searchTerms: ['trust', 'host profile', 'reviews', 'verification'],
        },
      ],
    },
  ],
  host: [
    {
      id: 'host-review',
      label: 'Application and review',
      icon: 'review',
      items: [
        {
          id: 'review-timing',
          q: 'How long does the review take after I apply?',
          a: 'The timing can vary depending on the application queue and whether follow-up materials are needed. The safest way to track it is through your dashboard status and notifications.',
          searchTerms: ['review timing', 'after applying', 'approval', 'pending'],
        },
        {
          id: 'revision-location',
          q: 'Where do I see revision requests?',
          a: 'If revisions are needed, they appear through your notifications and dashboard state. Once you update the requested parts and resubmit, the review continues from there.',
          searchTerms: ['revision request', 'dashboard', 'notifications'],
        },
        {
          id: 'good-fit',
          q: 'What kind of experiences or services fit Locally well?',
          a: 'The strongest fit is usually a host-led local experience that reflects what you genuinely know and enjoy, rather than something that feels generic. For services, it also helps when the support you can deliver is clear and realistic.',
          searchTerms: ['fit', 'good experience', 'good service', 'hosting style'],
        },
        {
          id: 'language-license',
          q: 'How much language skill, licensing, or permission do I need?',
          a: 'A foreign language is not always required as long as you can communicate reliably in the needed context. But if the activity touches food production, transport, or specialist instruction, you should confirm the relevant rules first.',
          searchTerms: ['language level', 'license', 'permit', 'qualification'],
        },
        {
          id: 'reapply-after-reject',
          q: 'Can I apply again after being rejected?',
          a: 'Yes. Review the reason, tighten your materials, and prepare again before reapplying. The dashboard guidance is the safest reference for what needs to be improved first.',
          searchTerms: ['reapply', 'rejected', 'apply again'],
        },
      ],
    },
    {
      id: 'host-profile',
      label: 'Preparing your listing',
      icon: 'profile',
      items: [
        {
          id: 'profile-photo-intro',
          q: 'How polished do my profile, photos, and intro need to be?',
          a: 'They only need to be clear enough that a guest can quickly picture who you are and what time with you will feel like. A trustworthy photo, a natural introduction, and concrete details matter more than looking overly polished.',
          searchTerms: ['profile', 'photo', 'intro', 'listing'],
        },
        {
          id: 'listing-details',
          q: 'How should I write included items, exclusions, supplies, and timing?',
          a: 'Write them as clearly as possible so guests can decide without sending extra questions. Guests should be able to understand what is included, what they need to bring, how much movement there is, and how the time flows.',
          searchTerms: ['included', 'excluded', 'supplies', 'timing', 'details'],
        },
        {
          id: 'not-too-many-dates',
          q: "Is it okay if I don't open too many dates?",
          a: 'Yes. It is usually better to open only the dates you can really operate with confidence. A manageable calendar often leads to more stable hosting and better reviews.',
          searchTerms: ['open dates', 'calendar', 'schedule management'],
        },
        {
          id: 'migrate-from-other-platform',
          q: 'Can I bring over an experience from another platform?',
          a: 'Yes, but it usually works better if you rewrite it for Locally instead of copying it over as-is. A more personal, specific tone tends to perform better here.',
          searchTerms: ['another platform', 'migrate listing', 'copy listing'],
        },
      ],
    },
    {
      id: 'host-operation',
      label: 'Running reservations',
      icon: 'operation',
      items: [
        {
          id: 'reply-speed',
          q: 'How quickly should I reply to guest inquiries?',
          a: 'There may not always be one fixed number, but quick and thoughtful first replies matter a lot. Response quality and speed both affect trust and your response-rate signal.',
          searchTerms: ['reply speed', 'response rate', 'guest inquiry'],
        },
        {
          id: 'must-cancel',
          q: 'What should I do if I absolutely have to cancel?',
          a: 'If cancellation is unavoidable, explain the reason as early as possible, ideally at least a day ahead, and follow the platform flow carefully. Host-side cancellations can directly impact a guest’s trip, so they should be treated with extra care.',
          searchTerms: ['must cancel', 'host cancellation', '24 hours'],
        },
        {
          id: 'guest-late-noshow',
          q: 'How should I handle a guest who is late or does not show up?',
          a: 'Use the message thread to record what happened first, then judge whether the experience can still proceed. A paid booking can still move through the platform’s no-show and payout logic according to policy.',
          searchTerms: ['late guest', 'guest no-show', 'no-show'],
        },
        {
          id: 'no-contact-before-booking',
          q: 'Why can’t I exchange outside contact details before booking?',
          a: 'Once the conversation leaves the platform too early, the payment protection and dispute record are broken. That is why KakaoTalk, email, and other outside contact methods are not allowed before the booking is confirmed.',
          searchTerms: ['outside contact', 'kakaotalk', 'email exchange', 'off-platform'],
        },
        {
          id: 'safety-briefing',
          q: 'When is a safety briefing needed?',
          a: 'Whenever the experience involves walking, movement, equipment, crowds, or any rule that affects guest safety, it is worth giving a short briefing at the start. A few clear reminders can reduce risk a lot.',
          searchTerms: ['safety briefing', 'safety guidance', 'briefing'],
        },
      ],
    },
    {
      id: 'host-jobs',
      label: 'Service job board',
      icon: 'jobs',
      items: [
        {
          id: 'which-requests-show',
          q: 'Which requests appear in the job board?',
          a: 'Only requests that are currently open and realistically available to apply for are shown. If the timing, area, or language needs do not fit, or the request is already closed, it will not show here.',
          searchTerms: ['job board', 'open requests', 'service jobs'],
        },
        {
          id: 'what-to-write-appeal',
          q: 'What should I include in my application message?',
          a: 'It helps to mention similar experience, the languages you can support, and why you can help right now. A concrete message usually works better than a generic greeting.',
          searchTerms: ['application message', 'appeal', 'apply', 'service application'],
        },
        {
          id: 'after-selected',
          q: 'What happens after the guest selects me?',
          a: 'The match becomes confirmed, and the next stage continues through the request detail and inbox. From there, you can move into the real coordination and delivery stage.',
          searchTerms: ['selected', 'matched', 'next step'],
        },
        {
          id: 'not-selected',
          q: 'How is it shown if I am not selected?',
          a: 'It is shown as not selected for that request. Your application history remains there, but no further service step continues for that request.',
          searchTerms: ['not selected', 'rejected', 'application result'],
        },
        {
          id: 'where-to-coordinate-service',
          q: 'Where does service coordination continue?',
          a: 'After matching, the inbox becomes the center of the real conversation. The request page holds the status, while the inbox is where you align time, place, and scope.',
          searchTerms: ['service coordination', 'inbox', 'after matching'],
        },
      ],
    },
    {
      id: 'host-payout',
      label: 'Payouts, bank info, and tax',
      icon: 'payout',
      items: [
        {
          id: 'experience-vs-service-payout',
          q: 'How are experience payouts different from service payouts?',
          a: 'The dashboard separates experiences and services, and the service side more clearly splits active expected earnings from completed payout-waiting amounts. The key is to check whether the amount is still in progress or already eligible for payout.',
          searchTerms: ['experience payout', 'service payout', 'earnings difference'],
        },
        {
          id: 'pending-inprogress-paid',
          q: 'What do pending payout, in-progress expected earnings, and paid-out mean?',
          a: 'Pending payout means the work is complete and the amount is already in the payout queue. In-progress expected earnings are not fully settled yet, and paid-out means the transfer has already been completed.',
          searchTerms: ['pending payout', 'in progress', 'paid out', 'earnings status'],
        },
        {
          id: 'bank-info-change',
          q: 'How is bank information reflected for payouts?',
          a: 'Payouts are based on the registered settlement account. Because personal and settlement information can be restricted from direct editing, account changes may need to go through support to avoid payout errors.',
          searchTerms: ['bank info', 'settlement account', 'change bank account'],
        },
        {
          id: 'fee-tax',
          q: 'Who handles fees and taxes?',
          a: 'Platform fees are applied according to Locally’s operating policy, while tax handling remains the host’s own responsibility. It is safest to think about platform deductions and tax reporting as two separate things.',
          searchTerms: ['fees', 'tax', 'commission', 'tax responsibility'],
        },
      ],
    },
    {
      id: 'host-policy',
      label: 'Policy, safety, and trust',
      icon: 'policy',
      items: [
        {
          id: 'off-platform-penalty',
          q: 'What happens if off-platform payment or circumvention is found?',
          a: 'Directing guests to personal accounts or outside payment routes is strictly prohibited. It can lead to strong action such as account suspension or payout holds.',
          searchTerms: ['off-platform', 'circumvention', 'personal account', 'payout hold'],
        },
        {
          id: 'discrimination-safety',
          q: 'How are discrimination, hate, or safety violations handled?',
          a: 'Discriminatory language, hate, and safety violations are not tolerated. Serious issues can lead to immediate restrictions and follow-up action.',
          searchTerms: ['discrimination', 'hate', 'safety violation'],
        },
        {
          id: 'reviews-response-rate',
          q: 'How do reviews and response rate affect visibility and booking conversion?',
          a: 'Guests often compare reviews, introduction, and responsiveness before they book. Slow replies or thin reviews can weaken conversion during that comparison stage.',
          searchTerms: ['reviews', 'response rate', 'visibility', 'booking conversion'],
        },
        {
          id: 'popular-ranking',
          q: 'What determines popular-experience exposure?',
          a: 'Popular exposure is currently aggregated based on how many guests save the experience to their wishlist. Strong photos, clearer copy, and a better review experience can all help.',
          searchTerms: ['popular exposure', 'wishlist', 'ranking'],
        },
        {
          id: 'emergency-contact',
          q: 'Who should I contact first in an emergency?',
          a: 'Immediate on-site safety comes first, so local emergency response should be contacted first when needed. After that, notify the platform support team so the incident record and follow-up can continue properly.',
          searchTerms: ['emergency', '119', 'support first', 'incident'],
        },
        {
          id: 'guest-tip',
          q: 'If a guest offers a tip, may I accept it?',
          a: 'A guest may choose to offer a tip voluntarily, but hosts should not ask for one or treat it as something tied to service quality. In practice, a small thank-you gesture such as coffee or food is more common, and it is safer to avoid anything that could look like an off-platform extra payment request.',
          searchTerms: ['tip', 'guest tip', 'extra payment', 'thank-you gesture', 'coffee', 'food', 'tipping'],
        },
      ],
    },
  ],
};

const ja: HelpFaqLocaleContent = {
  featuredTitle: 'よく見られる質問',
  featuredTopics: [
    { id: 'confirm', label: '予約確定', query: '予約確定', tab: 'guest' },
    { id: 'deposit', label: '入金待ち', query: '入金', tab: 'guest' },
    { id: 'refund', label: '返金', query: '返金', tab: 'guest' },
    { id: 'host-chat', label: 'ホスト連絡', query: 'ホスト', tab: 'guest' },
    { id: 'service-request', label: 'サービス依頼', query: 'サービス依頼', tab: 'guest' },
    { id: 'proxy', label: '電話予約', query: '電話予約', tab: 'guest' },
  ],
  guest: [
    {
      id: 'guest-prebooking',
      label: '予約前の確認',
      icon: 'prebooking',
      items: [
        {
          id: 'date-unavailable',
          q: '希望の日程が見つからないときはどうすればいいですか？',
          a: 'カレンダーに希望日がない場合は、まずホストにメッセージしてみてください。日程調整ができることもあり、難しい場合は近い日程や似た体験を比較するのがいちばん早いです。',
          searchTerms: ['日程', 'カレンダー', '空き', '希望日'],
        },
        {
          id: 'private-vs-regular',
          q: '貸切予約と通常予約の違いは何ですか？',
          a: '貸切予約はご自身のグループだけで参加する形で、通常予約はほかのゲストと一緒になる場合があります。まずは詳細ページの予約オプションを確認し、見当たらなければホストに相談してください。',
          searchTerms: ['貸切', 'プライベート', '通常予約', 'private'],
        },
        {
          id: 'solo-guarantee',
          q: '1名開催保証オプションはどんなときに必要ですか？',
          a: '一人旅で、最低人数に達しなくても日程を確定したいときに使うオプションです。あとから他のゲストが参加した場合は、追加で払った保証料金が返金されます。',
          searchTerms: ['1名', '一人旅', '開催保証', 'solo'],
        },
        {
          id: 'included-costs',
          q: '含まれる費用と含まれない費用はどこで確認できますか？',
          a: 'まずは詳細ページの含まれるもの・含まれないものを確認してください。食事代や個人購入のような現地精算項目は、詳細ページとホスト案内に一緒に書かれていることが多いです。',
          searchTerms: ['含まれる', '含まれない', '食事代', '追加費用'],
        },
        {
          id: 'kids-seniors-language',
          q: '子ども・高齢の同行者・言語面が心配なときはどう確認すればいいですか？',
          a: '歩く量や年齢制限、案内言語は、詳細ページとホストプロフィールを一緒に見るのがいちばん確実です。迷う場合は、予約前に同行者の状況をメッセージで伝えて確認してください。',
          searchTerms: ['子ども', '高齢者', '言語', '同行者', '家族'],
        },
      ],
    },
    {
      id: 'guest-payment',
      label: '決済と予約確定',
      icon: 'payment',
      items: [
        {
          id: 'methods-supported',
          q: 'カード・銀行振込・PayPal のうち、どの支払い方法が使えますか？',
          a: '利用できる支払い方法は、今のフローによって変わります。決済ページに表示されている方法が、その予約または依頼で今すぐ使える方法です。',
          searchTerms: ['カード', '銀行振込', 'PayPal', '支払い方法'],
        },
        {
          id: 'card-unavailable',
          q: 'カード決済が使えないときはどうすればいいですか？',
          a: 'カード決済の準備中だったり一時的に使えない場合は、銀行振込や PayPal でそのまま続けられます。決済ページの案内に出る代替手段に沿って進めてください。',
          searchTerms: ['カード決済', '使えない', '代替', 'fallback'],
        },
        {
          id: 'bank-deadline',
          q: '銀行振込はいつまでに行えばいいですか？',
          a: '振込期限は、その注文の決済ページに表示された時間が基準です。体験は通常予約後2時間ほど、カスタムサービスは通常1時間ほどで未入金なら自動キャンセルになります。',
          searchTerms: ['入金', '振込期限', '入金待ち', '銀行振込'],
        },
        {
          id: 'when-confirmed',
          q: '決済後、予約はいつ確定しますか？',
          a: 'カードや PayPal は決済確認が終わると次の段階へ進み、銀行振込は入金確認後に状態が変わります。体験は予約確定に、カスタムサービスはホスト募集開始へつながります。',
          searchTerms: ['予約確定', '決済後', '状態変更', '確認'],
        },
        {
          id: 'service-fee',
          q: 'サービス手数料とは何ですか？',
          a: 'プラットフォーム手数料は、決済運用、カスタマーサポート、安全保護のような共通運営に使われます。別表示される場合は、決済要約で一緒に確認できます。',
          searchTerms: ['手数料', 'サービス手数料', 'プラットフォーム手数料'],
        },
        {
          id: 'split-payment',
          q: '同行者と別々に支払うことはできますか？',
          a: 'はい。同じ時間帯をそれぞれ予約したうえで、同じグループだとホストに伝えれば大丈夫です。まず時間帯をそろえておくのが大切です。',
          searchTerms: ['別払い', '同行者', 'グループ支払い'],
        },
      ],
    },
    {
      id: 'guest-messages',
      label: '予約後の準備とメッセージ',
      icon: 'message',
      items: [
        {
          id: 'when-chat-opens',
          q: 'ホストとはいつからメッセージできますか？',
          a: '体験は予約が確定するとメッセージルームが開きます。カスタムサービスは、ホストを選んでマッチングが確定したあとに本格的な調整が始まります。',
          searchTerms: ['メッセージ', 'チャット', 'ホスト連絡', 'inbox'],
        },
        {
          id: 'inbox-vs-notification',
          q: '問い合わせの返信はメッセージボックスと通知のどちらで見ればいいですか？',
          a: '実際の返信内容はメッセージボックスで確認し、新着が来たことは通知でも分かります。会話の記録を見返す場所はメッセージボックスだと考えると分かりやすいです。',
          searchTerms: ['メッセージボックス', '通知', '返信', 'inbox'],
        },
        {
          id: 'what-to-share',
          q: '当日前にホストへ伝えておくとよい情報は何ですか？',
          a: '人数、到着予定時刻、使いたい言語、食物アレルギーや移動面の配慮が必要なら、先に伝えておくと安心です。少し情報があるだけで、ホストの準備がずっとしやすくなります。',
          searchTerms: ['事前に伝える', 'アレルギー', '到着時間', '要望'],
        },
        {
          id: 'pending-stuck',
          q: '入金待ちのまま状態が変わらないときはどうすればいいですか？',
          a: 'まずレシートや決済完了画面で口座情報と入金期限を確認してください。すでに入金済みなのに長く変わらない場合は、サポートへ問い合わせるとメッセージボックスで案内が続きます。',
          searchTerms: ['入金待ち', '保留', 'レシート', '口座情報'],
        },
        {
          id: 'host-tip',
          q: 'ホストにチップを渡しても大丈夫ですか？',
          a: 'チップはあくまで任意で、必須でも期待される慣習でもありません。実際には、コーヒーや食事のような軽いお礼で気持ちを伝えるケースが多いです。ただし、プラットフォーム外で大きなお金を別に渡したり、事前合意のない追加金銭につながる形は適切ではありません。',
          searchTerms: ['チップ', 'ホスト チップ', 'コーヒー', '食事', 'お礼', 'tipping'],
        },
      ],
    },
    {
      id: 'guest-cancellation',
      label: 'キャンセル・返金・変更',
      icon: 'cancellation',
      items: [
        {
          id: 'refund-rule',
          q: 'キャンセル規定はどのように計算されますか？',
          a: '現在の基準では、体験当日や過ぎた日程は返金対象外です。それ以外は、決済当日のキャンセルは100%、体験日の20日前までは100%、8〜19日前は80%、2〜7日前は70%、1日前は40%返金です。ホスト都合のキャンセルや、運営チームが進行不可を確認した場合は全額返金されます。',
          searchTerms: ['返金規定', 'キャンセル規定', '返金率', 'policy'],
        },
        {
          id: 'late-no-show',
          q: '当日の遅刻やノーショーはどう扱われますか？',
          a: '体験は定刻で始まるため、遅刻やノーショーは参加できないことがあり、当日キャンセル扱いになる場合があります。遅れそうなときは、できるだけ早くホストに連絡してください。',
          searchTerms: ['遅刻', 'ノーショー', '当日キャンセル'],
        },
        {
          id: 'rainy-weather',
          q: '雨や悪天候のときはどうなりますか？',
          a: '小雨ならそのまま進行することも多いですが、安全に関わる悪天候ではホスト判断で中止になることがあります。安全理由の中止は全額返金で処理されます。',
          searchTerms: ['雨', '悪天候', '台風', '天気'],
        },
        {
          id: 'ops-review-why',
          q: 'ホスト進行不可や最低催行人数未達で運営確認が必要なのはなぜですか？',
          a: 'この2つは、実際に進行できない状態だったかを運営チームが確認してから全額返金の流れを確定するためです。確認が終わるまでは審査中の状態で見えることがあります。',
          searchTerms: ['運営確認', 'ホスト進行不可', '最低催行人数', 'review'],
        },
        {
          id: 'refund-timing',
          q: '返金はいつ反映されますか？',
          a: 'キャンセル承認後はすぐにカード会社や決済会社へ返金依頼が送られます。カード会社は通常3〜5営業日ほど、デビットカードはもう少し早く反映されることがあります。',
          searchTerms: ['返金時期', '返金いつ', 'カード返金'],
        },
        {
          id: 'change-date',
          q: '日程変更はできますか？',
          a: '予約確定後の日程変更は基本的に開いていません。多くの場合は一度キャンセルして再予約する形になり、元の予約には現行のキャンセル規定が適用されます。',
          searchTerms: ['日程変更', '変更', 'reschedule'],
        },
      ],
    },
    {
      id: 'guest-service-request',
      label: 'カスタムサービス依頼',
      icon: 'service',
      items: [
        {
          id: 'service-flow',
          q: 'カスタムサービスはどんな順番で進みますか？',
          a: '依頼を書いて決済を済ませるとホスト募集が始まり、応募者を比較して1人選ぶとマッチング確定になります。その後の細かい調整はメッセージボックスで続きます。',
          searchTerms: ['カスタムサービス', '流れ', '依頼', 'matching'],
        },
        {
          id: 'pay-right-away',
          q: 'なぜ依頼登録の直後に決済が必要なのですか？',
          a: '実際にホスト募集が開くのは、決済済みの依頼だけだからです。ホスト側も、決済された依頼であることが分かって初めて本気で応募しやすくなります。',
          searchTerms: ['すぐ決済', '依頼登録', '先払い'],
        },
        {
          id: 'what-to-write',
          q: 'どんな内容を書けばホストが集まりやすいですか？',
          a: '都市、日付、開始時間、必要な言語、目的、どこまで同行や通訳が必要かを具体的に書いてください。状況がはっきりしているほど、合うホストが早く集まりやすくなります。',
          searchTerms: ['詳細説明', '応募が集まる', '依頼内容', 'description'],
        },
        {
          id: 'why-min-4h',
          q: '最低4時間ルールがあるのはなぜですか？',
          a: '現在のカスタムサービスは、価格計算とマッチング基準が4時間以上の依頼を前提に設計されています。移動や調整を含めて、現実的に成立しやすい単位にそろえるためです。',
          searchTerms: ['4時間', '最低時間', 'minimum'],
        },
        {
          id: 'request-private-before-pay',
          q: '決済前の依頼は公開されますか？',
          a: 'いいえ。決済が確認されるまでは募集が開かず、依頼詳細でも支払いが必要な状態として表示されます。ホストが応募できるのは決済完了後です。',
          searchTerms: ['公開', '決済前', '募集開始'],
        },
      ],
    },
    {
      id: 'guest-service-matching',
      label: 'サービス決済・マッチング',
      icon: 'matching',
      items: [
        {
          id: 'escrow-protection',
          q: 'エスクロー事前決済はどう守られていますか？',
          a: 'サービス代金は、マッチング完了前にそのままホストへ渡るわけではありません。ホストを選ばなければ、現在のフローでは全額返金の対象になります。',
          searchTerms: ['エスクロー', '事前決済', '保護', '安全決済'],
        },
        {
          id: 'bank-locked',
          q: '銀行振込待ちになると、なぜ支払い方法を変えられないのですか？',
          a: 'すでに銀行振込待ちとして生成された注文は、その決済状態を保つ必要があるためです。途中で変更すると注文基準が崩れる可能性があるので、現在はロックされます。',
          searchTerms: ['銀行振込待ち', '支払い方法変更', 'bank locked'],
        },
        {
          id: 'no-hosts-apply',
          q: 'ホストが誰も応募しない場合はどうなりますか？',
          a: '決済済みの依頼は募集が開いた状態で維持され、応募が来ればこの画面で比較できます。最終的にホストを選ばなければ、支払いはエスクロー基準で保護されます。',
          searchTerms: ['応募者なし', 'ホストなし', 'no applicants'],
        },
        {
          id: 'how-to-choose-host',
          q: '複数の応募者からどう選べばいいですか？',
          a: '応募メッセージ、対応言語、レビュー、紹介文を一緒に比較するのがおすすめです。相性の良い1人を選ぶとマッチングが確定し、その後の会話はメッセージボックスへ続きます。',
          searchTerms: ['ホスト選択', '応募者比較', 'select host'],
        },
        {
          id: 'refund-without-selection',
          q: 'ホストを選ばなかった場合、返金はどうなりますか？',
          a: 'ホスト選択が完了していない状態では、支払いが確定マッチングとして消化されません。現在のカスタムサービス基準では、ホスト未選択なら全額返金が可能です。',
          searchTerms: ['全額返金', 'ホスト未選択', 'refund'],
        },
        {
          id: 'coordinate-after-match',
          q: 'マッチング後の細かい調整はどこで行いますか？',
          a: '依頼詳細では進行状況を見て、実際の会話はメッセージボックスで進めます。時間や場所、準備物のような変わりやすい内容はメッセージに残しておくのが安全です。',
          searchTerms: ['マッチング後', '調整', 'メッセージボックス', 'coordinate'],
        },
      ],
    },
    {
      id: 'guest-proxy',
      label: '電話予約リクエスト',
      icon: 'proxy',
      items: [
        {
          id: 'proxy-scope',
          q: '電話予約ではどんな依頼ができますか？',
          a: 'レストラン予約、宿泊施設への問い合わせ、交通予約の問い合わせ、在庫や営業確認、忘れ物の問い合わせなど、日本語の電話対応が必要な内容を依頼できます。現在のカテゴリ外の特殊な内容は、まず範囲確認が必要です。',
          searchTerms: ['電話予約', '代行電話', 'レストラン予約', '忘れ物'],
        },
        {
          id: 'proxy-categories',
          q: '飲食店・宿・交通・忘れ物・在庫確認はどう違いますか？',
          a: '飲食店は予約や空席確認、宿は変更や一般問い合わせ、交通はタクシーや送迎の確認、忘れ物は回収可否、一般問い合わせは在庫や営業状況の確認に近いです。内容に合ったカテゴリを選ぶと、必要な入力欄も正しく開きます。',
          searchTerms: ['レストラン', '宿', '交通', '忘れ物', '在庫確認'],
        },
        {
          id: 'one-call-rule',
          q: '1通話として数えられるのはいつですか？',
          a: '相手の店舗や施設が電話に出た時点で1通話として扱われます。出たあとに満席や不可の案内だった場合も、進行した通話として処理されます。',
          searchTerms: ['1通話', '一回の電話', '通話基準'],
        },
        {
          id: 'proxy-exclusions',
          q: '受付が難しい店舗はどんなところですか？',
          a: '予約金やキャンセル料がある店舗、ノーショー履歴に敏感な店舗、オマカセや高額コースのようにリスクが高い予約は制限されることがあります。申込前の案内を必ず確認してください。',
          searchTerms: ['受付不可', 'オマカセ', '予約金', 'キャンセル料'],
        },
        {
          id: 'weekend-unreachable',
          q: '週末や店舗につながらない場合はどうなりますか？',
          a: '週末は返信が少し遅れることがあり、営業時間内に複数回かけてもつながらない、または満席だった場合はその結果で進行完了になることがあります。進捗はメッセージボックスのスレッドで続きます。',
          searchTerms: ['週末', 'つながらない', '満席', 'reply delay'],
        },
        {
          id: 'extra-calls',
          q: '追加の通話が必要な場合はどうなりますか？',
          a: '標準範囲を超える追加通話や複雑な問題対応は、別途問い合わせが必要になることがあります。大きなフォローが必要なときは、まず運営側から案内が入ります。',
          searchTerms: ['追加通話', '別途問い合わせ', 'extra call'],
        },
        {
          id: 'proxy-results',
          q: '進行結果はどこで確認できますか？',
          a: '運営チームの返信や通話結果は、依頼につながったメッセージボックスのスレッドで確認できます。新しい更新は通知にも出ますが、記録の本体はメッセージボックスです。',
          searchTerms: ['結果確認', '通話結果', 'メッセージボックス', '通知'],
        },
      ],
    },
    {
      id: 'guest-care',
      label: 'Locally Care・メンバーシップ',
      icon: 'care',
      items: [
        {
          id: 'care-open',
          q: 'Locally Care は誰が使えますか？',
          a: '購入が完了したゲストは、旅行前の質問を Locally Care の流れでより直接続けられます。再訪ゲストほど、前回までのつながりを前提により自然なフォローを受けやすくなります。',
          searchTerms: ['Locally Care', 'ケア', '購入ゲスト', '旅行前質問'],
        },
        {
          id: 'tier-difference',
          q: 'Tier 1 と Tier 2 の違いは何ですか？',
          a: 'Tier 1 は最初の購入で Locally とのつながりが始まった段階で、Tier 2 は再訪ゲストに開く段階です。Tier 2 では、より早い案内や近いケアが強く意識されています。',
          searchTerms: ['Tier 1', 'Tier 2', 'メンバーシップ', '違い'],
        },
        {
          id: 'tier-change',
          q: 'メンバーシップの段階はいつ変わりますか？',
          a: '最初の購入完了で Tier 1 が開き、もう一度利用すると Tier 2 が開きます。現在の段階や次のステップは、アカウント画面でも確認できます。',
          searchTerms: ['段階変更', 'Tier変更', '次のステップ'],
        },
        {
          id: 'pretrip-question',
          q: '旅行前の質問はどこに送ればいいですか？',
          a: 'ヘルプセンター下部の 1:1 問い合わせ、または利用可能な場合は Locally Care ボタンから送れます。返信はメッセージボックスへ届き、新着は通知でも分かります。',
          searchTerms: ['旅行前質問', '1:1問い合わせ', 'ケア問い合わせ'],
        },
      ],
    },
    {
      id: 'guest-account',
      label: 'アカウント・安全',
      icon: 'account',
      items: [
        {
          id: 'login-email',
          q: 'ログイン用メールアドレスは変更できますか？',
          a: '現在はアカウント画面からログイン用メールアドレスを直接変更できません。変更が必要な場合は、サポートの案内が必要です。',
          searchTerms: ['ログインメール', 'メール変更', 'account email'],
        },
        {
          id: 'forgot-password',
          q: 'パスワードを忘れました。',
          a: '現時点ではパスワード再設定が独立したセルフサービスとしては開いていません。最初に使ったログイン方法やソーシャルログインを確認してください。',
          searchTerms: ['パスワード', '再設定', 'ログイン'],
        },
        {
          id: 'delete-account',
          q: '退会するにはどうすればいいですか？',
          a: '退会は運営チームが案内しています。ヘルプセンターやアカウント画面から問い合わせを送ると、メッセージボックスで続きが案内されます。',
          searchTerms: ['退会', 'アカウント削除', 'delete account'],
        },
        {
          id: 'no-off-platform',
          q: 'なぜプラットフォーム外の直接決済は禁止なのですか？',
          a: '決済と会話がプラットフォーム内に残っていないと、問題が起きたときの保護や対応記録が切れてしまうためです。外部取引は現在のガイドラインでは認められていません。',
          searchTerms: ['外部決済', '直取引', 'オフプラットフォーム', '安全'],
        },
        {
          id: 'host-trust',
          q: 'ホストの信頼情報はどこで確認できますか？',
          a: 'ホストプロフィール、対応言語、レビュー、紹介文をまず確認してください。実際のゲストレビューと、プラットフォーム上のプロフィール情報を一緒に見るのがいちばん確実です。',
          searchTerms: ['信頼', 'レビュー', '認証', 'ホストプロフィール'],
        },
      ],
    },
  ],
  host: [
    {
      id: 'host-review',
      label: '応募と審査',
      icon: 'review',
      items: [
        {
          id: 'review-timing',
          q: '応募後の審査にはどれくらいかかりますか？',
          a: '審査スピードは応募状況や追加資料の有無によって変わります。現在の状態はダッシュボードと通知で確認するのがいちばん確実です。',
          searchTerms: ['審査期間', '応募後', '承認待ち'],
        },
        {
          id: 'revision-location',
          q: '修正依頼はどこで確認できますか？',
          a: '修正が必要な場合は、通知とダッシュボードの状態で確認できます。求められた部分を直して再提出すると、そのまま審査が続きます。',
          searchTerms: ['修正依頼', 'ダッシュボード', '通知'],
        },
        {
          id: 'good-fit',
          q: 'Locally に合いやすい体験やサービスはどんなものですか？',
          a: '資格や肩書きの説明より、自分が本当に知っていて好きな地域や時間の過ごし方が伝わる体験が合いやすいです。サービスも、自分が責任を持って届けられる支援内容が明確なほど相性が良いです。',
          searchTerms: ['向いている体験', '相性', 'Locally向き'],
        },
        {
          id: 'language-license',
          q: '語学力や資格、許可はどこまで必要ですか？',
          a: '必要な場面で安定してやり取りできるなら、外国語が常に必須というわけではありません。ただし、飲食提供、送迎、専門レッスンのように別ルールが絡む活動は事前確認が必要です。',
          searchTerms: ['語学力', '資格', '許可', 'ライセンス'],
        },
        {
          id: 'reapply-after-reject',
          q: '不承認のあとに再応募できますか？',
          a: 'はい。理由を確認し、紹介文や資料、運営方針を整えてから再準備できます。まずはダッシュボードの案内に沿って改善点を整理するのが安全です。',
          searchTerms: ['再応募', '不承認', 'apply again'],
        },
      ],
    },
    {
      id: 'host-profile',
      label: '体験登録の準備',
      icon: 'profile',
      items: [
        {
          id: 'profile-photo-intro',
          q: 'プロフィール・写真・紹介文はどの程度整えればいいですか？',
          a: 'ゲストが、誰とどんな時間を過ごすのかをすぐ想像できる程度で十分です。信頼感のある写真、自然な自己紹介、雰囲気が伝わる具体的な説明が大切です。',
          searchTerms: ['プロフィール', '写真', '紹介文', 'listing'],
        },
        {
          id: 'listing-details',
          q: '含まれるもの・含まれないもの・持ち物・流れはどう書けばいいですか？',
          a: 'ゲストが追加質問なしでも判断できるくらい、はっきり書くのがいちばん大事です。何が含まれるか、何を持つか、どれくらい移動するか、時間の流れが一目で分かるのが理想です。',
          searchTerms: ['含まれるもの', '持ち物', '流れ', '詳細説明'],
        },
        {
          id: 'not-too-many-dates',
          q: 'たくさん日程を開けなくても大丈夫ですか？',
          a: 'はい。実際に安定して運営できる日だけ開けるほうが、レビューや運営の安定につながりやすいです。無理のないカレンダーのほうが結果的に安全です。',
          searchTerms: ['日程管理', 'カレンダー', 'open dates'],
        },
        {
          id: 'migrate-from-other-platform',
          q: '他のプラットフォームで出している体験を持ち込んでもいいですか？',
          a: '可能です。ただ、そのままコピーするよりも、Locally のゲストに伝わるよう少し書き直すほうが反応が良くなりやすいです。より個人的で具体的な文のほうが向いています。',
          searchTerms: ['他プラットフォーム', '移行', 'コピー'],
        },
      ],
    },
    {
      id: 'host-operation',
      label: '予約運営',
      icon: 'operation',
      items: [
        {
          id: 'reply-speed',
          q: 'ゲストからの問い合わせにはどれくらい早く返すべきですか？',
          a: '固定の数字以上に大切なのは、早くて丁寧な最初の返信です。返信の質と速さは、信頼や応答率の印象にそのままつながります。',
          searchTerms: ['返信速度', '応答率', '問い合わせ対応'],
        },
        {
          id: 'must-cancel',
          q: 'やむを得ずキャンセルしなければならないときはどうすればいいですか？',
          a: '避けられない事情がある場合は、できるだけ早く、理想的には前日までに理由を説明してフローに沿って処理してください。ホスト都合のキャンセルはゲストの旅に直接影響するため、特に慎重さが必要です。',
          searchTerms: ['キャンセル', '前日', 'host cancellation'],
        },
        {
          id: 'guest-late-noshow',
          q: 'ゲストが遅刻したり、来なかった場合はどう扱えばいいですか？',
          a: 'まずメッセージで状況を残し、そのうえで体験を続けられるか判断してください。決済済み予約は、規定に従ってノーショーや精算の流れへ進むことがあります。',
          searchTerms: ['遅刻ゲスト', 'ノーショー', 'late guest'],
        },
        {
          id: 'no-contact-before-booking',
          q: '予約前に外部連絡先を交換してはいけないのはなぜですか？',
          a: '予約前に会話が外へ出ると、決済保護やトラブル対応の記録が切れてしまうためです。カカオトークやメールなどの外部連絡先交換は、予約確定前は許可されていません。',
          searchTerms: ['外部連絡先', 'カカオトーク', 'メール交換', 'off-platform'],
        },
        {
          id: 'safety-briefing',
          q: 'Safety Briefing はいつ必要ですか？',
          a: '歩行、移動、機材利用、人混みなど、ゲスト安全に関わる要素があるなら開始前に短くても案内するのが望ましいです。基本ルールや注意点を先に共有しておくとリスクを大きく減らせます。',
          searchTerms: ['Safety Briefing', '安全案内', 'briefing'],
        },
      ],
    },
    {
      id: 'host-jobs',
      label: 'サービスジョブボード',
      icon: 'jobs',
      items: [
        {
          id: 'which-requests-show',
          q: 'ジョブボードにはどんな依頼だけが表示されますか？',
          a: '現在開いていて、実際に応募可能な依頼だけが表示されます。日程、地域、言語条件が合わないものや、すでに閉じた依頼はここには出ません。',
          searchTerms: ['ジョブボード', '開いている依頼', 'service jobs'],
        },
        {
          id: 'what-to-write-appeal',
          q: '応募メッセージには何を書けばいいですか？',
          a: '似た経験、対応できる言語、今すぐどう役立てるかを具体的に書くのが効果的です。一般的なあいさつだけより、できることが見える文章のほうが選ばれやすいです。',
          searchTerms: ['応募メッセージ', 'アピール', 'apply message'],
        },
        {
          id: 'after-selected',
          q: 'ゲストに選ばれたあとは何が起こりますか？',
          a: '選ばれた瞬間にマッチングが確定し、その後は依頼詳細とメッセージボックスで次のやり取りが続きます。そこから実際の調整と準備へ進んでいきます。',
          searchTerms: ['選ばれた', 'マッチング確定', 'next step'],
        },
        {
          id: 'not-selected',
          q: '選ばれなかった場合はどう表示されますか？',
          a: 'その依頼に対して今回は選ばれなかった状態として表示されます。応募履歴は残りますが、その依頼で次のサービス段階へは進みません。',
          searchTerms: ['選ばれない', '不採用', 'not selected'],
        },
        {
          id: 'where-to-coordinate-service',
          q: 'サービスの調整はどこで続きますか？',
          a: 'マッチング後は、実際の会話の中心はメッセージボックスになります。依頼画面で状態を見ながら、時間や場所、範囲はメッセージで合わせていくのが安全です。',
          searchTerms: ['調整', 'メッセージボックス', 'after matching'],
        },
      ],
    },
    {
      id: 'host-payout',
      label: '精算・口座・税金',
      icon: 'payout',
      items: [
        {
          id: 'experience-vs-service-payout',
          q: '体験の精算とサービスの精算はどう違いますか？',
          a: 'ダッシュボードでは体験とサービスが分かれて表示され、サービス側は進行中の見込み収益と完了後の精算待ちをより明確に分けて見せます。今見えている金額が、進行中なのか支払い対象なのかを区別して見るのが大切です。',
          searchTerms: ['体験精算', 'サービス精算', '違い'],
        },
        {
          id: 'pending-inprogress-paid',
          q: '精算待ち・進行中の見込み収益・支払い完了はそれぞれ何ですか？',
          a: '精算待ちは、完了後に支払いキューへ入った金額です。進行中の見込み収益はまだ確定前の金額で、支払い完了は実際の振込まで終わった金額です。',
          searchTerms: ['精算待ち', '進行中', '支払い完了', 'status'],
        },
        {
          id: 'bank-info-change',
          q: '口座情報はどう反映されますか？',
          a: '精算は登録済みの口座情報を基準に進みます。個人情報と精算情報は直接編集が制限されることがあるため、変更が必要な場合はサポート経由で安全に反映する形になります。',
          searchTerms: ['口座情報', '精算口座', '変更'],
        },
        {
          id: 'fee-tax',
          q: '手数料と税金は誰が処理しますか？',
          a: 'プラットフォーム手数料は運営方針に沿って反映され、税金の処理はホストご自身の責任です。プラットフォーム控除と税務対応は別のものとして考えるのが安全です。',
          searchTerms: ['手数料', '税金', '税務', 'tax'],
        },
      ],
    },
    {
      id: 'host-policy',
      label: 'ポリシー・安全・信頼',
      icon: 'policy',
      items: [
        {
          id: 'off-platform-penalty',
          q: 'プラットフォーム外決済や迂回取引が見つかるとどうなりますか？',
          a: '個人口座の案内や外部決済への誘導は厳しく禁止されています。発覚すると、アカウント停止や精算保留のような強い措置につながる可能性があります。',
          searchTerms: ['迂回取引', '外部決済', '個人口座', '精算保留'],
        },
        {
          id: 'discrimination-safety',
          q: '差別・ヘイト・安全違反はどう扱われますか？',
          a: '差別的な言動、ヘイト、安全違反は許容されません。深刻な問題は即時制限や追加措置につながることがあります。',
          searchTerms: ['差別', 'ヘイト', '安全違反'],
        },
        {
          id: 'reviews-response-rate',
          q: 'レビューや応答率は露出や予約率にどんな影響がありますか？',
          a: 'ゲストはレビュー、紹介文、返信の姿勢を一緒に見て予約を決めることが多いです。返信が遅かったりレビューが弱いと、比較段階で不利になりやすくなります。',
          searchTerms: ['レビュー', '応答率', '予約率', 'visibility'],
        },
        {
          id: 'popular-ranking',
          q: '人気体験の表示は何で決まりますか？',
          a: '現在の人気体験表示は、ゲストのウィッシュリスト保存数を基準に集計されています。写真、紹介文、レビュー体験を整えるほど、保存したくなる体験として見られやすくなります。',
          searchTerms: ['人気体験', 'ウィッシュリスト', '表示'],
        },
        {
          id: 'emergency-contact',
          q: '緊急事態が起きたときは誰に先に連絡すべきですか？',
          a: '現場の安全が最優先なので、必要ならまず現地の緊急対応へ連絡してください。そのあとでプラットフォームのサポートにも知らせると、記録とフォローが適切に続きます。',
          searchTerms: ['緊急事態', '119', '緊急連絡', 'emergency'],
        },
        {
          id: 'guest-tip',
          q: 'ゲストがチップを渡したいと言ったら受け取ってもいいですか？',
          a: 'ゲストが自発的に感謝を伝えること自体は問題ありません。ただし、ホスト側から求めたり、サービス品質と結びつけて期待する形は適切ではありません。実際にはコーヒーや食事のような自然なお礼のほうが一般的で、プラットフォーム外の追加金銭要求と受け取られかねない形は避けるのが安全です。',
          searchTerms: ['チップ', 'ゲスト チップ', '追加金額', 'お礼', 'コーヒー', '食事', 'tipping'],
        },
      ],
    },
  ],
};

const zh: HelpFaqLocaleContent = {
  featuredTitle: '常见问题',
  featuredTopics: [
    { id: 'confirm', label: '预订确认', query: '预订确认', tab: 'guest' },
    { id: 'deposit', label: '等待入金', query: '入金', tab: 'guest' },
    { id: 'refund', label: '退款', query: '退款', tab: 'guest' },
    { id: 'host-chat', label: '联系房东', query: '房东', tab: 'guest' },
    { id: 'service-request', label: '服务需求', query: '服务需求', tab: 'guest' },
    { id: 'proxy', label: '电话预约', query: '电话预约', tab: 'guest' },
  ],
  guest: [
    {
      id: 'guest-prebooking',
      label: '预订前确认',
      icon: 'prebooking',
      items: [
        {
          id: 'date-unavailable',
          q: '找不到想要的日期时该怎么办？',
          a: '如果日历里没有你想要的日期，建议先给房东发消息确认。有些房东可以调整时间；如果不行，再比较相近日期或类似体验通常是最快的做法。',
          searchTerms: ['日期', '日历', '可预订', '想要的日期'],
        },
        {
          id: 'private-vs-regular',
          q: '包团预订和普通预订有什么不同？',
          a: '包团预订是只和自己同行的人一起参加，普通预订则可能与其他客人一起进行。先看详情页上的预订选项，如果没看到，再向房东确认即可。',
          searchTerms: ['包团', '私人', '普通预订', 'private'],
        },
        {
          id: 'solo-guarantee',
          q: '什么时候需要单人出发保障选项？',
          a: '如果你是独自出行，又希望即使人数不够也能把日期确认下来，就适合使用这个选项。之后若有其他客人加入，你额外支付的保障费用会退回。',
          searchTerms: ['单人', '独自旅行', '单人成团', 'solo'],
        },
        {
          id: 'included-costs',
          q: '包含费用和不包含费用在哪里看？',
          a: '先查看体验详情页里的“包含项目”和“不包含项目”。像餐费或个人购物这类现场另付费用，通常也会在详情和房东说明里一起写清楚。',
          searchTerms: ['包含', '不包含', '餐费', '额外费用'],
        },
        {
          id: 'kids-seniors-language',
          q: '如果担心孩子、长者或语言问题，要怎么确认？',
          a: '建议一起看详情页和房东资料，确认步行强度、年龄限制以及可用语言。若仍不确定，最好在预订前把同行者情况发消息告诉房东。',
          searchTerms: ['孩子', '长者', '语言', '同行者', '家庭'],
        },
      ],
    },
    {
      id: 'guest-payment',
      label: '支付与预订确认',
      icon: 'payment',
      items: [
        {
          id: 'methods-supported',
          q: '银行卡、银行转账和 PayPal 中，哪些支付方式可以用？',
          a: '可用的支付方式会因当前流程而不同。支付页面上显示出来的方式，就是你这笔预订或需求当前可以直接使用的方式。',
          searchTerms: ['银行卡', '银行转账', 'PayPal', '支付方式'],
        },
        {
          id: 'card-unavailable',
          q: '如果银行卡支付不可用怎么办？',
          a: '如果银行卡支付还在准备中，或者暂时不可用，可以直接改用银行转账或 PayPal。按支付页上的替代支付提示继续即可。',
          searchTerms: ['银行卡支付', '支付失败', '替代支付', 'card unavailable'],
        },
        {
          id: 'bank-deadline',
          q: '银行转账最晚什么时候要完成？',
          a: '以该订单支付页面显示的截止时间为准。体验通常是预订后约2小时未入金自动取消，定制服务通常是约1小时未入金自动取消。',
          searchTerms: ['入金', '银行转账', '截止时间', '等待入金'],
        },
        {
          id: 'when-confirmed',
          q: '支付后预订什么时候算确认？',
          a: '银行卡和 PayPal 在支付验证完成后会进入下一步，银行转账则会在确认入金后更新状态。体验会变成“预订确认”，定制服务则会进入“招募房东”。',
          searchTerms: ['预订确认', '支付后', '状态更新', 'confirmed'],
        },
        {
          id: 'service-fee',
          q: '服务费是做什么用的？',
          a: '平台服务费用于支付运营、客服支持和安全保障等共通成本。若页面有单独显示，你可以在支付摘要里一起查看。',
          searchTerms: ['服务费', '平台费', 'fee'],
        },
        {
          id: 'split-payment',
          q: '同行的人可以分别付款吗？',
          a: '可以。各自预订同一个时间段后，再告诉房东你们是同一组即可。最重要的是先把预订时间选一致。',
          searchTerms: ['分别付款', '同行', '分开支付'],
        },
      ],
    },
    {
      id: 'guest-messages',
      label: '预订后准备与消息',
      icon: 'message',
      items: [
        {
          id: 'when-chat-opens',
          q: '什么时候可以开始和房东发消息？',
          a: '体验会在预订确认后打开和房东的消息对话。定制服务则是在你选择房东、匹配完成后，才会进入真正的协调阶段。',
          searchTerms: ['消息', '聊天', '联系房东', 'inbox'],
        },
        {
          id: 'inbox-vs-notification',
          q: '咨询回复是在消息箱看，还是在通知里看？',
          a: '完整回复内容以消息箱为准，通知只是提醒你有新内容到了。想回看完整对话时，消息箱才是最准确的入口。',
          searchTerms: ['消息箱', '通知', '回复', 'inbox'],
        },
        {
          id: 'what-to-share',
          q: '出发前最好先告诉房东哪些信息？',
          a: '建议提前告知最终人数、预计到达时间、希望使用的语言、食物过敏或行动上的照顾需求。只要信息更完整一点，房东准备起来就会顺很多。',
          searchTerms: ['提前告知', '过敏', '到达时间', '需求'],
        },
        {
          id: 'pending-stuck',
          q: '如果一直显示等待入金怎么办？',
          a: '先去收据或支付完成页面重新确认收款账户和入金期限。如果你已经转账很久但状态还没变，联系帮助中心后，后续说明会继续进入消息箱。',
          searchTerms: ['等待入金', '未更新', '收据', '账户信息'],
        },
        {
          id: 'host-tip',
          q: '可以给房东小费吗？',
          a: '小费可以出于自愿表达感谢，但并不是必须，也不是默认会被期待的做法。实际中，很多客人会用请对方喝咖啡或吃饭这类轻松的感谢方式来代替。不过，不建议在平台外另外给出较大金额，或发展成事先没有约定的额外金钱。',
          searchTerms: ['小费', '房东小费', '咖啡', '吃饭', '感谢', 'tipping'],
        },
      ],
    },
    {
      id: 'guest-cancellation',
      label: '取消、退款与更改',
      icon: 'cancellation',
      items: [
        {
          id: 'refund-rule',
          q: '取消规则是怎么计算的？',
          a: '当前规则是：行程当天或已过期的日程不可退款。除此之外，支付当天取消退款100%，出发前20天及以上退款100%，8至19天前退款80%，2至7天前退款70%，前1天退款40%。如因房东原因取消，或运营团队确认行程无法进行，将全额退款。',
          searchTerms: ['退款规则', '取消规则', '退款比例', 'policy'],
        },
        {
          id: 'late-no-show',
          q: '当天迟到或未到场会怎么处理？',
          a: '体验会按约定时间开始，所以迟到或未到场可能会导致无法参加，并按当天取消处理。如果你可能会晚到，请尽快先给房东发消息。',
          searchTerms: ['迟到', '未到场', 'no-show', '当天取消'],
        },
        {
          id: 'rainy-weather',
          q: '下雨或恶劣天气时会怎么样？',
          a: '小雨通常仍会照常进行，但如果天气已经影响安全，房东可能会决定取消。出于安全原因取消时，会按全额退款处理。',
          searchTerms: ['下雨', '恶劣天气', '台风', '天气'],
        },
        {
          id: 'ops-review-why',
          q: '为什么“房东无法进行”或“未达到最低成团人数”需要运营审核？',
          a: '因为这两种情况需要运营团队先确认实际是否真的无法进行，之后才会正式确定全额退款流程。在审核完成前，状态可能会显示为审核中。',
          searchTerms: ['运营审核', '房东无法进行', '最低人数', 'review'],
        },
        {
          id: 'refund-timing',
          q: '退款什么时候会退回？',
          a: '取消获批后，退款请求会马上发送到发卡行或支付机构。信用卡通常需要约3到5个工作日，借记卡有时会更快。',
          searchTerms: ['退款时间', '什么时候退款', '信用卡退款'],
        },
        {
          id: 'change-date',
          q: '可以改日期吗？',
          a: '预订确认后，通常不提供直接改期。多数情况下需要先取消再重新预订，原预订仍会按当前取消规则处理。',
          searchTerms: ['改日期', '改期', 'reschedule'],
        },
      ],
    },
    {
      id: 'guest-service-request',
      label: '定制服务需求',
      icon: 'service',
      items: [
        {
          id: 'service-flow',
          q: '定制服务会按照什么顺序进行？',
          a: '提交需求并完成支付后，会开始招募房东；你比较申请者并选择1位后，匹配才正式确认。之后的细节沟通会继续在消息箱里进行。',
          searchTerms: ['定制服务', '流程', '服务需求', 'matching'],
        },
        {
          id: 'pay-right-away',
          q: '为什么提交需求后要立刻支付？',
          a: '因为只有已支付的需求才会真正对房东开放招募。对房东来说，确认这是一笔已付款的真实需求后，才更容易认真投入申请。',
          searchTerms: ['立刻支付', '先支付', '提交需求'],
        },
        {
          id: 'what-to-write',
          q: '写哪些内容更容易让房东来申请？',
          a: '建议明确写出城市、日期、开始时间、需要语言、目的，以及希望房东提供到什么范围的帮助。情况越具体，越容易更快匹配到合适的人。',
          searchTerms: ['写什么', '详细说明', '房东申请', 'description'],
        },
        {
          id: 'why-min-4h',
          q: '为什么最少要4小时？',
          a: '目前定制服务的价格计算和匹配逻辑，都是以至少4小时的需求为基础设计的。这样更符合实际移动、协调和房东安排的成本。',
          searchTerms: ['4小时', '最少时长', 'minimum'],
        },
        {
          id: 'request-private-before-pay',
          q: '付款前，我的需求会公开吗？',
          a: '不会。在支付确认前，需求不会开启招募，在详情页里也只会显示为“需要支付”的状态。只有支付完成后，房东才可以申请。',
          searchTerms: ['公开', '支付前', '招募开始'],
        },
      ],
    },
    {
      id: 'guest-service-matching',
      label: '服务支付与匹配',
      icon: 'matching',
      items: [
        {
          id: 'escrow-protection',
          q: '担保预支付是怎么保护我的？',
          a: '这笔服务费用不会在匹配完成前直接转给房东。在当前流程里，如果你最终没有选择房东，款项可以按全额退款处理。',
          searchTerms: ['担保支付', '托管', '保护', 'escrow'],
        },
        {
          id: 'bank-locked',
          q: '为什么切换到银行转账等待状态后，就不能再改支付方式？',
          a: '因为订单一旦以“等待银行转账”的状态创建，就需要保持同一个支付状态逻辑。中途改动会让订单记录变得不稳定，所以目前会锁定。',
          searchTerms: ['银行转账等待', '支付方式变更', 'bank locked'],
        },
        {
          id: 'no-hosts-apply',
          q: '如果一直没有房东申请，会怎么样？',
          a: '已付款的需求会继续保持开放招募，你可以回到需求详情页查看进展。如果最终没有选定房东，付款仍会按担保规则受到保护。',
          searchTerms: ['没人申请', '房东没有申请', 'no applicants'],
        },
        {
          id: 'how-to-choose-host',
          q: '多个申请者中应该怎么选？',
          a: '可以一起比较申请留言、可用语言、评价和自我介绍。选定最合适的一位后，匹配会正式确认，后续沟通也会马上继续到消息箱。',
          searchTerms: ['选择房东', '比较申请者', 'select host'],
        },
        {
          id: 'refund-without-selection',
          q: '如果不选择房东，退款会怎么处理？',
          a: '在没有完成房东选择之前，这笔付款不会被视为已完成匹配的服务支出。按照当前定制服务规则，未选择房东时可以全额退款。',
          searchTerms: ['未选择房东', '全额退款', 'refund'],
        },
        {
          id: 'coordinate-after-match',
          q: '匹配后去哪里协调细节？',
          a: '需求详情页负责展示状态，真正的沟通以消息箱为主。时间、地点、准备事项这类会变动的内容，最好都留在消息记录里。',
          searchTerms: ['匹配后', '协调', '消息箱', 'coordinate'],
        },
      ],
    },
    {
      id: 'guest-proxy',
      label: '电话预约请求',
      icon: 'proxy',
      items: [
        {
          id: 'proxy-scope',
          q: '电话预约可以代办哪些内容？',
          a: '你可以提交餐厅预约、住宿咨询、交通预约咨询、库存或营业确认、以及失物相关的日语电话请求。若超出当前分类范围，建议先确认是否在可处理范围内。',
          searchTerms: ['电话预约', '代打电话', '餐厅预约', '失物'],
        },
        {
          id: 'proxy-categories',
          q: '餐厅、住宿、交通、失物、库存确认分别有什么区别？',
          a: '餐厅类以预约和空位确认为主，住宿类用于变更或一般咨询，交通类用于出租车或接送咨询，失物类用于找回可行性确认，一般咨询类则更偏向库存和营业情况确认。选对分类后，表单内容也会更准确。',
          searchTerms: ['餐厅', '住宿', '交通', '失物', '库存确认'],
        },
        {
          id: 'one-call-rule',
          q: '“1通”到底从什么时候开始算？',
          a: '只要对方店家或机构接起电话，就会被算作1通。即使接通后得到的是“已满”或“无法办理”的答复，也会算作已进行的通话。',
          searchTerms: ['1通', '一通电话', '通话标准'],
        },
        {
          id: 'proxy-exclusions',
          q: '哪些店家或场景比较难受理？',
          a: '有订金或取消费的餐厅、对 no-show 很敏感的店家，以及 omakase 或高价预订套餐这类风险较高的预约，可能会有限制。付款前请先看清页面说明。',
          searchTerms: ['不受理', 'omakase', '订金', '取消费'],
        },
        {
          id: 'weekend-unreachable',
          q: '周末或一直联系不上店家时会怎么处理？',
          a: '周末回复可能会稍慢；如果在营业时间内多次拨打仍未接通，或者店家已经满位，也可能按该结果直接记为本次处理完成。后续更新会继续进消息箱线程。',
          searchTerms: ['周末', '联系不上', '满位', '回复慢'],
        },
        {
          id: 'extra-calls',
          q: '如果需要额外再打电话怎么办？',
          a: '如果情况超出标准范围，需要多次跟进或额外处理，可能就需要另开请求。遇到这种情况时，运营团队会先告诉你能否继续扩大处理范围。',
          searchTerms: ['额外通话', '追加处理', 'extra call'],
        },
        {
          id: 'proxy-results',
          q: '处理结果在哪里看？',
          a: '运营团队的回复和通话结果都会继续进入与该请求关联的消息箱线程。通知会提醒你有新内容，但完整记录还是以消息箱为准。',
          searchTerms: ['结果查看', '通话结果', '消息箱', '通知'],
        },
      ],
    },
    {
      id: 'guest-care',
      label: 'Locally Care 与会员',
      icon: 'care',
      items: [
        {
          id: 'care-open',
          q: 'Locally Care 是对谁开放的？',
          a: '完成购买后的客人，可以更直接地通过 Locally Care 继续处理出发前的问题。回访客人还会基于之前的记录，获得更顺畅的后续帮助。',
          searchTerms: ['Locally Care', '购买后', '出发前问题'],
        },
        {
          id: 'tier-difference',
          q: 'Tier 1 和 Tier 2 有什么区别？',
          a: 'Tier 1 表示你完成了第一次购买，和 Locally 的连接正式开始；Tier 2 则是为再次回来的客人开启的阶段，更强调更早的提醒和更近的照顾。',
          searchTerms: ['Tier 1', 'Tier 2', '会员', '区别'],
        },
        {
          id: 'tier-change',
          q: '会员等级什么时候会变化？',
          a: '第一次购买完成后会进入 Tier 1，再和 Locally 一起完成一次旅程后会进入 Tier 2。你也可以在账号页面再次查看当前阶段和下一步提示。',
          searchTerms: ['等级变化', 'Tier 变化', '下一步'],
        },
        {
          id: 'pretrip-question',
          q: '出发前的问题应该发到哪里？',
          a: '可以用帮助中心底部的 1:1 咨询，或在可用时使用 Locally Care 按钮。回复会继续进入消息箱，新的消息也会同步出现在通知里。',
          searchTerms: ['出发前问题', '1:1咨询', 'Care 咨询'],
        },
      ],
    },
    {
      id: 'guest-account',
      label: '账号与安全',
      icon: 'account',
      items: [
        {
          id: 'login-email',
          q: '登录邮箱可以修改吗？',
          a: '目前还不能在账号页面里直接修改登录邮箱。如果确实需要更改，需要通过帮助中心获得运营协助。',
          searchTerms: ['登录邮箱', '修改邮箱', 'account email'],
        },
        {
          id: 'forgot-password',
          q: '我忘记密码了。',
          a: '目前尚未开放独立的密码重置自助功能。请先确认你最初使用的登录方式或社交登录方式。',
          searchTerms: ['密码', '重置密码', '登录失败'],
        },
        {
          id: 'delete-account',
          q: '如何注销账号？',
          a: '账号注销由运营团队协助处理。你可以从帮助中心或账号页面提交咨询，后续说明会继续发到消息箱。',
          searchTerms: ['注销账号', '删除账号', '退会'],
        },
        {
          id: 'no-off-platform',
          q: '为什么不允许平台外直接付款？',
          a: '因为只有支付和对话都留在平台内，出现问题时才有完整的支付保护和处理记录。平台外私下交易会切断这层保护，所以当前规则不允许。',
          searchTerms: ['平台外付款', '私下交易', '直接付款', '安全'],
        },
        {
          id: 'host-trust',
          q: '在哪里可以查看房东的可信信息？',
          a: '建议先看房东资料、可用语言、评价和自我介绍。真实客人的评价，加上平台内可见的资料信息，是最值得一起参考的部分。',
          searchTerms: ['可信', '房东资料', '评价', '认证'],
        },
      ],
    },
  ],
  host: [
    {
      id: 'host-review',
      label: '申请与审核',
      icon: 'review',
      items: [
        {
          id: 'review-timing',
          q: '提交申请后，审核一般要多久？',
          a: '审核速度会随着申请量和是否需要补充资料而变化。最稳妥的方式，还是通过仪表盘状态和通知来查看当前进度。',
          searchTerms: ['审核时间', '申请后', '待审核'],
        },
        {
          id: 'revision-location',
          q: '补充或修改请求在哪里查看？',
          a: '如果需要补充资料或修改内容，会通过通知和仪表盘状态一起显示。按要求修改后重新提交，审核就会继续进行。',
          searchTerms: ['补充资料', '修改请求', '通知', 'dashboard'],
        },
        {
          id: 'good-fit',
          q: '什么样的体验或服务更适合 Locally？',
          a: '比起泛泛而谈，真正体现你熟悉并喜欢的当地生活视角的体验更适合 Locally。服务类也是一样，能清楚说明你实际能提供什么帮助时，匹配会更顺。',
          searchTerms: ['适合 Locally', '体验方向', 'fit'],
        },
        {
          id: 'language-license',
          q: '语言能力、资格和许可需要到什么程度？',
          a: '只要在实际场景里能稳定沟通，外语不一定总是硬性要求。但如果涉及餐饮制作、交通接送或专业指导这类内容，就应该先确认相关规定。',
          searchTerms: ['语言能力', '资格', '许可', '执照'],
        },
        {
          id: 'reapply-after-reject',
          q: '如果被拒绝了，还可以再次申请吗？',
          a: '可以。先看清原因，再把介绍、资料和运营计划整理好之后重新准备。最安全的做法是先按照仪表盘里的提示逐项补强。',
          searchTerms: ['再次申请', '被拒绝', 'reapply'],
        },
      ],
    },
    {
      id: 'host-profile',
      label: '体验上架准备',
      icon: 'profile',
      items: [
        {
          id: 'profile-photo-intro',
          q: '个人资料、照片和介绍需要做到什么程度？',
          a: '只要能让客人很快理解你是谁、会一起度过怎样的时间，就已经足够好了。可信的照片、自然的介绍和具体的氛围描述，比过度包装更重要。',
          searchTerms: ['个人资料', '照片', '介绍', 'listing'],
        },
        {
          id: 'listing-details',
          q: '包含项目、不包含项目、准备物品和流程应该怎么写？',
          a: '最重要的是让客人在不额外发问的情况下也能判断是否适合自己。写清楚包含与否、需要带什么、移动量和整体流程，通常就能明显减少咨询。',
          searchTerms: ['包含项目', '准备物品', '流程', '详细说明'],
        },
        {
          id: 'not-too-many-dates',
          q: '不开放很多日期也没关系吗？',
          a: '当然可以。只开放自己真正能稳定接待的日期，往往比一下子开很多档期更安全，也更有利于评价和整体运营质量。',
          searchTerms: ['日期管理', '档期', '日历'],
        },
        {
          id: 'migrate-from-other-platform',
          q: '可以把其他平台上的体验搬过来吗？',
          a: '可以。但比起原文照搬，更建议根据 Locally 的客人重新整理成更个人、更具体的说明。这样通常会更容易让人产生信任感。',
          searchTerms: ['其他平台', '迁移', '复制文案'],
        },
      ],
    },
    {
      id: 'host-operation',
      label: '预约运营',
      icon: 'operation',
      items: [
        {
          id: 'reply-speed',
          q: '客人的咨询需要多快回复？',
          a: '比起某个固定数字，更重要的是尽快给出清楚又友好的第一条回复。回复的速度和态度，都会直接影响信任感和响应率表现。',
          searchTerms: ['回复速度', '响应率', '客人咨询'],
        },
        {
          id: 'must-cancel',
          q: '如果不得不取消，该怎么处理？',
          a: '如果真的无法避免，应该尽早说明原因，最好至少提前一天，并按平台流程处理。房东方取消会直接影响客人的旅行安排，所以一定要更谨慎。',
          searchTerms: ['取消', '提前一天', 'host cancellation'],
        },
        {
          id: 'guest-late-noshow',
          q: '客人迟到或没来时要怎么处理？',
          a: '先在消息里把情况留痕，再判断当天是否还能继续进行。已付款的预订会按照平台规则继续进入 no-show 或结算逻辑。',
          searchTerms: ['客人迟到', '没来', 'no-show'],
        },
        {
          id: 'no-contact-before-booking',
          q: '为什么预订前不能交换站外联系方式？',
          a: '如果在预订前就把对话带到平台外，支付保护和争议记录都会中断。因此在预订确认前，KakaoTalk、邮件等站外联系方式都不允许交换。',
          searchTerms: ['站外联系方式', 'KakaoTalk', '邮箱交换', 'off-platform'],
        },
        {
          id: 'safety-briefing',
          q: '什么时候需要做 Safety Briefing？',
          a: '只要体验中涉及步行、移动、设备使用、人流密集场景等安全相关因素，开始前就值得做一个简短说明。把基本规则和注意点先讲清楚，风险会小很多。',
          searchTerms: ['Safety Briefing', '安全说明', 'briefing'],
        },
      ],
    },
    {
      id: 'host-jobs',
      label: '服务任务墙',
      icon: 'jobs',
      items: [
        {
          id: 'which-requests-show',
          q: '任务墙里只会显示哪些需求？',
          a: '这里只会显示当前开放、而且你现实中确实还能申请的需求。时间、地区、语言条件不匹配，或已经关闭的需求，都不会继续出现在这里。',
          searchTerms: ['任务墙', '开放需求', 'service jobs'],
        },
        {
          id: 'what-to-write-appeal',
          q: '申请留言里应该写什么？',
          a: '建议写清楚类似经验、可支持的语言，以及你为什么现在就能帮上忙。比起泛泛打招呼，更具体的说明通常更容易被选中。',
          searchTerms: ['申请留言', '自荐', 'apply message'],
        },
        {
          id: 'after-selected',
          q: '被客人选中后，接下来会发生什么？',
          a: '一旦被选中，匹配就会正式确认，之后的流程会继续在需求详情页和消息箱里进行。接着就进入真正的沟通和服务准备阶段。',
          searchTerms: ['被选中', '匹配确认', 'next step'],
        },
        {
          id: 'not-selected',
          q: '如果没有被选中，会怎么显示？',
          a: '系统会把该需求标记为本次未被选中。申请记录仍会保留，但不会再继续进入下一步服务流程。',
          searchTerms: ['未被选中', '落选', 'not selected'],
        },
        {
          id: 'where-to-coordinate-service',
          q: '服务协调会继续在哪里进行？',
          a: '匹配完成后，实际沟通的中心会转到消息箱。需求详情页负责看状态，时间、地点和服务范围这类具体内容则建议放在消息记录里协调。',
          searchTerms: ['服务协调', '消息箱', '匹配后'],
        },
      ],
    },
    {
      id: 'host-payout',
      label: '结算、账户与税务',
      icon: 'payout',
      items: [
        {
          id: 'experience-vs-service-payout',
          q: '体验结算和服务结算有什么不同？',
          a: '仪表盘会把体验和服务分开展示，而服务部分会更清楚地区分“进行中预计收入”和“完成后待结算金额”。看数值时，先分清它还在进行中，还是已经进入结算阶段最重要。',
          searchTerms: ['体验结算', '服务结算', '差异'],
        },
        {
          id: 'pending-inprogress-paid',
          q: '待结算、进行中预计收入、已支付分别是什么意思？',
          a: '待结算表示服务已经完成并进入付款队列，进行中预计收入表示还没完全进入结算，已支付则表示实际打款已经结束。理解这三个阶段，有助于正确看待收入变化。',
          searchTerms: ['待结算', '进行中', '已支付', '状态'],
        },
        {
          id: 'bank-info-change',
          q: '结算账户信息会如何反映？',
          a: '结算会以已登记的账户信息为准。因为个人信息和结算信息可能限制直接修改，所以若要更改，通常需要通过帮助中心更安全地处理。',
          searchTerms: ['账户信息', '结算账户', '修改账户'],
        },
        {
          id: 'fee-tax',
          q: '手续费和税务由谁处理？',
          a: '平台手续费会按照运营规则反映，而税务处理仍由房东本人负责。理解收入时，最好把平台扣费和税务申报分开来看。',
          searchTerms: ['手续费', '税务', '税金', 'tax'],
        },
      ],
    },
    {
      id: 'host-policy',
      label: '政策、安全与信任',
      icon: 'policy',
      items: [
        {
          id: 'off-platform-penalty',
          q: '如果被发现平台外收款或绕单交易，会怎么样？',
          a: '向客人提供个人账户、引导去外部支付，都属于严格禁止行为。一旦被发现，可能会导致账号限制或结算保留等较强措施。',
          searchTerms: ['平台外收款', '绕单', '个人账户', '结算保留'],
        },
        {
          id: 'discrimination-safety',
          q: '歧视、仇恨言论或安全违规会怎么处理？',
          a: '歧视性言行、仇恨表达和安全违规都不被允许。若问题严重，可能直接带来即时限制和后续处理。',
          searchTerms: ['歧视', '仇恨言论', '安全违规'],
        },
        {
          id: 'reviews-response-rate',
          q: '评价和响应率会怎样影响曝光和预订率？',
          a: '客人通常会把评价、介绍和回复态度一起比较后再决定是否预订。回复太慢或评价薄弱，往往会在比较阶段明显吃亏。',
          searchTerms: ['评价', '响应率', '曝光', '预订率'],
        },
        {
          id: 'popular-ranking',
          q: '热门体验的展示是由什么决定的？',
          a: '当前热门体验的展示，主要会参考客人把体验保存到愿望清单的次数。更清晰的照片、文案和体验后的评价，都会帮助你更容易被保存。',
          searchTerms: ['热门体验', '愿望清单', '曝光'],
        },
        {
          id: 'emergency-contact',
          q: '发生紧急情况时，应该先联系谁？',
          a: '现场安全永远优先，所以必要时应先联系当地紧急救援。之后也请尽快通知平台支持团队，让记录和后续处理可以继续衔接。',
          searchTerms: ['紧急情况', '119', '紧急联系', 'emergency'],
        },
        {
          id: 'guest-tip',
          q: '如果客人想给小费，可以收吗？',
          a: '客人自愿表达感谢是可以的，但房东不应主动索取，也不应把它当作与服务质量挂钩的默认期待。实际中，更常见的是请喝咖啡或吃饭这类自然的感谢方式；为了避免看起来像平台外额外收费，最好不要发展成额外金钱要求。',
          searchTerms: ['小费', '客人小费', '额外金额', '感谢', '咖啡', '吃饭', 'tipping'],
        },
      ],
    },
  ],
};

export const HELP_FAQ_CONTENT: Record<Locale, HelpFaqLocaleContent> = {
  ko,
  en,
  ja,
  zh,
};
