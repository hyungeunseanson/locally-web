export type CompanyNoticeLocale = 'ko' | 'en' | 'ja' | 'zh';

export type CompanyNoticeType = 'Update' | 'Event' | 'Notice';

type LocalizedNoticeText = Record<CompanyNoticeLocale, string>;

export type CompanyNotice = {
  id: number;
  type: CompanyNoticeType;
  title: LocalizedNoticeText;
  dateLabel: string;
  content: LocalizedNoticeText;
};

const NOTICE_TYPE_LABELS: Record<CompanyNoticeType, LocalizedNoticeText> = {
  Update: {
    ko: '업데이트',
    en: 'Update',
    ja: 'アップデート',
    zh: '更新',
  },
  Event: {
    ko: '이벤트',
    en: 'Event',
    ja: 'イベント',
    zh: '活动',
  },
  Notice: {
    ko: '공지',
    en: 'Notice',
    ja: 'お知らせ',
    zh: '公告',
  },
};

// 회사 공지는 이 파일 한 곳에서만 관리합니다.
//
// 가장 쉬운 사용법:
// 1) 새 공지는 배열 맨 위에 추가합니다.
// 2) dateLabel, title.ko, content.ko만 바꿔도 한국어 페이지에 바로 반영됩니다.
// 3) 다국어 페이지까지 맞추려면 title/content의 en, ja, zh도 함께 바꿉니다.
// 4) 정렬 기준은 별도 필드 없이 배열 순서 그대로입니다.
export const COMPANY_NOTICES: CompanyNotice[] = [
  {
    id: 2,
    type: 'Notice',
    title: {
      ko: 'ホスト承認が完了しました。次は体験登録です。',
      en: 'ホスト承認が完了しました。次は体験登録です。',
      ja: 'ホスト承認が完了しました。次は体験登録です。',
      zh: 'ホスト承認が完了しました。次は体験登録です。',
    },
    dateLabel: 'May 3, 2026',
    content: {
      ko:
        '以前のサイトで登録済みの体験も、新しいLocallyではもう一度体験ページを作成する必要があります。\n体験を登録すると、ゲストが予約できる状態になります。',
      en:
        '以前のサイトで登録済みの体験も、新しいLocallyではもう一度体験ページを作成する必要があります。\n体験を登録すると、ゲストが予約できる状態になります。',
      ja:
        '以前のサイトで登録済みの体験も、新しいLocallyではもう一度体験ページを作成する必要があります。\n体験を登録すると、ゲストが予約できる状態になります。',
      zh:
        '以前のサイトで登録済みの体験も、新しいLocallyではもう一度体験ページを作成する必要があります。\n体験を登録すると、ゲストが予約できる状態になります。',
    },
  },
  {
    id: 1,
    type: 'Notice',
    title: {
      ko: 'Locally 웹사이트 오픈 안내',
      en: 'Locally website launch notice',
      ja: 'Locallyウェブサイト公開のお知らせ',
      zh: 'Locally 网站上线公告',
    },
    dateLabel: 'Apr 29, 2026',
    content: {
      ko:
        '안녕하세요. Locally 팀입니다.\n\nLocally 웹사이트가 새롭게 오픈했습니다.\n여행자와 현지 호스트가 더 안전하고 편하게 만날 수 있도록 검색, 예약, 메시지, 문의 흐름을 계속 다듬어가고 있습니다.\n\n이용 중 불편한 점이나 오류, 개선이 필요한 부분을 발견하시면 1:1 문의로 편하게 남겨주세요.\n보내주시는 의견은 서비스 안정화와 개선에 큰 도움이 됩니다.\n\n더 좋은 여행 경험을 만들기 위해 꾸준히 업데이트하겠습니다.\n감사합니다.',
      en:
        'Hello from the Locally team.\n\nThe Locally website is now open.\nWe are continuing to improve search, booking, messaging, and inquiry flows so travelers and local hosts can connect more safely and comfortably.\n\nIf you notice any inconvenience, bug, or area for improvement, please send it through 1:1 inquiry.\nYour feedback helps us stabilize and improve the service.\n\nWe will keep updating Locally to create better travel experiences.\nThank you.',
      ja:
        'こんにちは、Locallyチームです。\n\nLocallyのウェブサイトが新しくオープンしました。\n旅行者と現地ホストがより安全で快適につながれるよう、検索、予約、メッセージ、お問い合わせの流れを継続的に改善しています。\n\nご利用中に不便な点や不具合、改善が必要な部分を見つけた場合は、1:1お問い合わせからお気軽にお知らせください。\nいただいたご意見は、サービスの安定化と改善に大きく役立ちます。\n\nより良い旅行体験をつくるため、これからもアップデートを続けていきます。\nありがとうございます。',
      zh:
        '您好，这里是 Locally 团队。\n\nLocally 网站已正式上线。\n为了让旅行者和当地房东能够更安全、便捷地连接，我们会持续优化搜索、预订、消息和咨询流程。\n\n如果您在使用过程中发现不便之处、错误或需要改进的地方，请通过 1:1 咨询告诉我们。\n您的反馈将帮助我们提升服务稳定性并持续改进。\n\n我们会不断更新 Locally，努力带来更好的旅行体验。\n谢谢。',
    },
  },
];

export function getCompanyNoticeCopy(notice: CompanyNotice, locale: CompanyNoticeLocale) {
  return {
    typeLabel: NOTICE_TYPE_LABELS[notice.type][locale] || NOTICE_TYPE_LABELS[notice.type].ko,
    title: notice.title[locale] || notice.title.ko,
    content: notice.content[locale] || notice.content.ko,
  };
}
