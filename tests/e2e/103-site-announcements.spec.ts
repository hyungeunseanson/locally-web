import { expect, test } from '@playwright/test';

import type { SiteAnnouncement } from '../../app/config/siteAnnouncements';
import { SITE_ANNOUNCEMENTS } from '../../app/config/siteAnnouncements';
import {
  getAnnouncementCopy,
  normalizeAnnouncementPathname,
  pickActiveSiteAnnouncement,
} from '../../app/utils/siteAnnouncements';

const buildAnnouncement = (overrides: Partial<SiteAnnouncement>): SiteAnnouncement => ({
  id: 'default-announcement',
  enabled: true,
  priority: 10,
  startAt: '2026-03-01T00:00:00+09:00',
  endAt: '2026-03-31T00:00:00+09:00',
  audience: 'all',
  excludePathPrefixes: ['/admin'],
  title: {
    ko: '기본 공지',
    en: 'Default Notice',
    ja: '基本のお知らせ',
    zh: '默认公告',
  },
  body: {
    ko: '기본 본문',
    en: 'Default body',
    ja: '基本本文',
    zh: '默认正文',
  },
  primaryLabel: {
    ko: '확인',
    en: 'Got it',
    ja: '確認',
    zh: '确认',
  },
  ...overrides,
});

test.describe('site announcement utilities', () => {
  test('keeps the expired bank-only global popup disabled in current config', () => {
    const expiredBankOnlyAnnouncement = SITE_ANNOUNCEMENTS.find(
      (announcement) => announcement.id === 'bank-only-template-2026-04-01'
    );

    expect(expiredBankOnlyAnnouncement?.enabled).toBe(false);
  });

  test('normalizes locale-prefixed paths before matching exclusions', () => {
    expect(normalizeAnnouncementPathname('/en/admin/dashboard')).toBe('/admin/dashboard');
    expect(normalizeAnnouncementPathname('/ja/company/notices')).toBe('/company/notices');
    expect(normalizeAnnouncementPathname('/ja')).toBe('/');
    expect(normalizeAnnouncementPathname('/')).toBe('/');
  });

  test('selects the highest-priority active announcement for the current path', () => {
    const now = new Date('2026-03-20T12:00:00+09:00');
    const announcements = [
      buildAnnouncement({
        id: 'low-priority',
        priority: 10,
      }),
      buildAnnouncement({
        id: 'high-priority',
        priority: 50,
      }),
      buildAnnouncement({
        id: 'admin-only-blocked',
        priority: 100,
        audience: 'guest',
      }),
    ];

    const active = pickActiveSiteAnnouncement(announcements, {
      pathname: '/en/experiences/123',
      locale: 'en',
      audience: 'all',
      now,
    });

    expect(active?.id).toBe('high-priority');
  });

  test('ignores disabled, expired, and excluded announcements', () => {
    const now = new Date('2026-03-20T12:00:00+09:00');
    const announcements = [
      buildAnnouncement({
        id: 'disabled',
        enabled: false,
      }),
      buildAnnouncement({
        id: 'expired',
        endAt: '2026-03-05T00:00:00+09:00',
      }),
      buildAnnouncement({
        id: 'admin-hidden',
        excludePathPrefixes: ['/admin'],
      }),
    ];

    const active = pickActiveSiteAnnouncement(announcements, {
      pathname: '/admin/dashboard',
      locale: 'ko',
      audience: 'all',
      now,
    });

    expect(active).toBeNull();
  });

  test('respects host audience and home-only includes for targeted announcements', () => {
    const now = new Date('2026-05-03T12:00:00+09:00');
    const announcements = [
      buildAnnouncement({
        id: 'host-home-reminder',
        priority: 100,
        audience: 'host',
        includePathPrefixes: ['/'],
        endAt: null,
      }),
    ];

    expect(
      pickActiveSiteAnnouncement(announcements, {
        pathname: '/ja',
        locale: 'ja',
        audience: 'host',
        now,
      })?.id
    ).toBe('host-home-reminder');

    expect(
      pickActiveSiteAnnouncement(announcements, {
        pathname: '/ja/search',
        locale: 'ja',
        audience: 'host',
        now,
      })
    ).toBeNull();

    expect(
      pickActiveSiteAnnouncement(announcements, {
        pathname: '/ja/unknown',
        locale: 'ja',
        audience: 'host',
        now,
      })
    ).toBeNull();

    expect(
      pickActiveSiteAnnouncement(announcements, {
        pathname: '/ja',
        locale: 'ja',
        audience: 'guest',
        now,
      })
    ).toBeNull();
  });

  test('returns locale-specific copy with korean fallback', () => {
    const announcement = buildAnnouncement({
      secondaryLabel: {
        ko: '공지 보기',
        en: 'View notice',
        ja: 'お知らせを見る',
        zh: '查看公告',
      },
    });

    const copy = getAnnouncementCopy(announcement, 'ja');

    expect(copy.title).toBe('基本のお知らせ');
    expect(copy.secondaryLabel).toBe('お知らせを見る');
  });
});
