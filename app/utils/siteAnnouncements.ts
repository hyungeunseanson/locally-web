import {
  SITE_ANNOUNCEMENTS,
  type SiteAnnouncement,
  type SiteAnnouncementAudience,
  type SiteAnnouncementLocale,
} from '@/app/config/siteAnnouncements';

const SUPPORTED_LOCALES: SiteAnnouncementLocale[] = ['ko', 'en', 'ja', 'zh'];

const parseAnnouncementDate = (value: string | null): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export function normalizeAnnouncementPathname(pathname: string): string {
  const normalizedInput = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const [pathOnly] = normalizedInput.split('?');
  const segments = pathOnly.split('/');
  const firstSegment = (segments[1] || '').toLowerCase();

  if (SUPPORTED_LOCALES.includes(firstSegment as SiteAnnouncementLocale)) {
    const stripped = `/${segments.slice(2).join('/')}`.replace(/\/{2,}/g, '/');
    return stripped === '/' ? '/' : stripped.replace(/\/$/, '') || '/';
  }

  return pathOnly === '/' ? '/' : pathOnly.replace(/\/$/, '') || '/';
}

const matchesExcludedPrefix = (pathname: string, prefixes?: string[]) => {
  if (!prefixes || prefixes.length === 0) return false;

  return prefixes.some((prefix) => {
    const normalizedPrefix = normalizeAnnouncementPathname(prefix);
    if (normalizedPrefix === '/') {
      return pathname === '/';
    }

    return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`);
  });
};

const matchesIncludedPrefix = (pathname: string, prefixes?: string[]) => {
  if (!prefixes || prefixes.length === 0) return true;

  return prefixes.some((prefix) => {
    const normalizedPrefix = normalizeAnnouncementPathname(prefix);
    return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`);
  });
};

export function pickActiveSiteAnnouncement(
  announcements: SiteAnnouncement[],
  params: {
    pathname: string;
    locale: SiteAnnouncementLocale;
    audience: SiteAnnouncementAudience;
    now?: Date;
  }
): SiteAnnouncement | null {
  const normalizedPathname = normalizeAnnouncementPathname(params.pathname);
  const now = params.now ?? new Date();
  const nowTimestamp = now.getTime();

  const activeAnnouncements = announcements
    .filter((announcement) => announcement.enabled)
    .filter((announcement) => matchesIncludedPrefix(normalizedPathname, announcement.includePathPrefixes))
    .filter((announcement) => {
      const startAt = parseAnnouncementDate(announcement.startAt);
      const endAt = parseAnnouncementDate(announcement.endAt);

      if (startAt !== null && startAt > nowTimestamp) return false;
      if (endAt !== null && endAt <= nowTimestamp) return false;

      return true;
    })
    .filter((announcement) => announcement.audience === 'all' || announcement.audience === params.audience)
    .filter((announcement) => !matchesExcludedPrefix(normalizedPathname, announcement.excludePathPrefixes))
    .sort((left, right) => right.priority - left.priority);

  return activeAnnouncements[0] ?? null;
}

export function getActiveSiteAnnouncement(params: {
  pathname: string;
  locale: SiteAnnouncementLocale;
  audience: SiteAnnouncementAudience;
  now?: Date;
}): SiteAnnouncement | null {
  return pickActiveSiteAnnouncement(SITE_ANNOUNCEMENTS, params);
}

export function getAnnouncementCopy(
  announcement: SiteAnnouncement,
  locale: SiteAnnouncementLocale
) {
  return {
    title: announcement.title[locale] || announcement.title.ko,
    badgeLabel: announcement.badgeLabel?.[locale] || announcement.badgeLabel?.ko,
    body: announcement.body[locale] || announcement.body.ko,
    primaryLabel: announcement.primaryLabel[locale] || announcement.primaryLabel.ko,
    secondaryLabel: announcement.secondaryLabel
      ? announcement.secondaryLabel[locale] || announcement.secondaryLabel.ko
      : undefined,
  };
}

export const getAnnouncementDismissKey = (announcementId: string) =>
  `locally_site_announcement_dismissed:${announcementId}`;
