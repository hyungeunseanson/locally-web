export type SiteAnnouncementLocale = 'ko' | 'en' | 'ja' | 'zh';

export type SiteAnnouncementAudience = 'all' | 'guest' | 'host';

export type SiteAnnouncement = {
  id: string;
  enabled: boolean;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  audience: SiteAnnouncementAudience;
  excludePathPrefixes?: string[];
  title: Record<SiteAnnouncementLocale, string>;
  body: Record<SiteAnnouncementLocale, string>;
  primaryLabel: Record<SiteAnnouncementLocale, string>;
  secondaryLabel?: Record<SiteAnnouncementLocale, string>;
  href?: string | null;
  variant?: 'info' | 'warning';
};

// 이 파일에서 전역 팝업을 켜고 끕니다.
//
// 가장 쉬운 사용법:
// 1) enabled 를 true 로 바꾸면 팝업이 뜹니다.
// 2) startAt / endAt 날짜를 원하는 기간으로 바꿉니다.
// 3) title.ko / body.ko 문구를 바꿉니다.
// 4) 이미 한 번 닫은 사람에게 다시 띄우고 싶으면 id 를 새 이름으로 바꿉니다.
//
// 자주 바꾸는 항목:
// - enabled: true 면 켜짐, false 면 꺼짐
// - id: 공지 이름. 다시 띄울 때는 꼭 새 이름으로 변경
// - startAt: 시작 날짜/시간
// - endAt: 종료 날짜/시간
// - body.ko: 한국어 본문
//
// 참고:
// - 전체 방문자에게 뜹니다.
// - /admin 에서는 기본적으로 안 뜹니다.
// - 여러 개가 있어도 우선순위(priority)가 가장 높은 1개만 뜹니다.
// - 전역 팝업을 다시 켤 때는 /company/notices 에도 같은 내용의 공지를 함께 등록합니다.
export const SITE_ANNOUNCEMENTS: SiteAnnouncement[] = [
  {
    // 공지 고유 이름입니다.
    // 문구를 새로 띄우고 싶으면 이 이름을 바꾸세요.
    id: 'bank-only-template-2026-04-01',

    // true 로 바꾸면 팝업이 실제로 뜹니다.
    enabled: false,

    // 숫자가 클수록 더 먼저 뜹니다.
    priority: 100,

    // 팝업 시작 시간
    startAt: '2026-03-20T00:00:00+09:00',

    // 팝업 종료 시간
    endAt: '2026-04-01T00:00:00+09:00',

    // 지금은 전체 방문자 대상으로만 쓰면 됩니다.
    audience: 'all',

    // /admin 에서는 안 뜨게 막아둔 설정입니다.
    excludePathPrefixes: ['/admin'],

    // 팝업 제목
    title: {
      ko: '결제 안내',
      en: 'Payment Notice',
      ja: '決済のお知らせ',
      zh: '支付通知',
    },

    // 팝업 본문
    // 보통 운영팀은 body.ko 만 바꿔도 충분합니다.
    body: {
      ko: '나이스페이 연결 전까지 2026년 4월 1일까지는 무통장 입금만 이용할 수 있습니다.',
      en: 'Until NicePay is connected, only bank transfer is available through April 1, 2026.',
      ja: 'NicePay 連携前のため、2026年4月1日までは銀行振込のみご利用いただけます。',
      zh: '在 NicePay 接入完成前，截至 2026 年 4 月 1 日仅支持银行转账。',
    },

    // 기본 버튼 문구
    primaryLabel: {
      ko: '확인했어요',
      en: 'Got it',
      ja: '確認しました',
      zh: '我知道了',
    },

    // 선택 버튼: 공지사항 페이지로 보내고 싶을 때 사용
    secondaryLabel: {
      ko: '공지 보기',
      en: 'View notice',
      ja: 'お知らせを見る',
      zh: '查看公告',
    },

    // 공지 보기 버튼을 눌렀을 때 이동할 주소
    href: '/company/notices',

    // warning 이면 조금 더 눈에 띄는 톤으로 보입니다.
    variant: 'warning',
  },
];
