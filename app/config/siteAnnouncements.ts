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

// Keep examples disabled by default. To re-show a previously dismissed notice,
// publish it with a new `id`.
export const SITE_ANNOUNCEMENTS: SiteAnnouncement[] = [
  {
    id: 'bank-only-template-2026-04-01',
    enabled: false,
    priority: 100,
    startAt: '2026-03-20T00:00:00+09:00',
    endAt: '2026-04-01T00:00:00+09:00',
    audience: 'all',
    excludePathPrefixes: ['/admin'],
    title: {
      ko: '결제 안내',
      en: 'Payment Notice',
      ja: '決済のお知らせ',
      zh: '支付通知',
    },
    body: {
      ko: '나이스페이 연결 전까지 2026년 4월 1일까지는 무통장 입금만 이용할 수 있습니다.',
      en: 'Until NicePay is connected, only bank transfer is available through April 1, 2026.',
      ja: 'NicePay 連携前のため、2026年4月1日までは銀行振込のみご利用いただけます。',
      zh: '在 NicePay 接入完成前，截至 2026 年 4 月 1 日仅支持银行转账。',
    },
    primaryLabel: {
      ko: '확인했어요',
      en: 'Got it',
      ja: '確認しました',
      zh: '我知道了',
    },
    secondaryLabel: {
      ko: '공지 보기',
      en: 'View notice',
      ja: 'お知らせを見る',
      zh: '查看公告',
    },
    href: '/company/notices',
    variant: 'warning',
  },
];
