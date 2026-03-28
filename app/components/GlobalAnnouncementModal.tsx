'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';

import { type SiteAnnouncement } from '@/app/config/siteAnnouncements';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  getActiveSiteAnnouncement,
  getAnnouncementCopy,
  getAnnouncementDismissKey,
} from '@/app/utils/siteAnnouncements';

const BADGE_LABELS = {
  info: {
    ko: '공지',
    en: 'Notice',
    ja: 'お知らせ',
    zh: '公告',
  },
  warning: {
    ko: '중요 안내',
    en: 'Important',
    ja: '重要なお知らせ',
    zh: '重要通知',
  },
} as const;

const CLOSE_LABELS = {
  ko: '공지 닫기',
  en: 'Close notice',
  ja: 'お知らせを閉じる',
  zh: '关闭公告',
} as const;

export default function GlobalAnnouncementModal() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined';

  const announcement = useMemo(
    () =>
      getActiveSiteAnnouncement({
        pathname: pathname || '/',
        locale: lang,
        audience: 'all',
      }),
    [lang, pathname]
  );

  const isDismissed =
    Boolean(announcement && dismissedId === announcement.id) ||
    Boolean(
      announcement &&
        canUseDom &&
        window.localStorage.getItem(getAnnouncementDismissKey(announcement.id))
    );

  useEffect(() => {
    if (!canUseDom || !announcement || isDismissed) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [announcement, canUseDom, isDismissed]);

  const dismissAnnouncement = (activeAnnouncement: SiteAnnouncement) => {
    const key = getAnnouncementDismissKey(activeAnnouncement.id);
    window.localStorage.setItem(key, new Date().toISOString());
    setDismissedId(activeAnnouncement.id);
  };

  if (!canUseDom || !announcement || isDismissed) {
    return null;
  }

  const copy = getAnnouncementCopy(announcement, lang);
  const badgeVariant = announcement.variant === 'warning' ? 'warning' : 'info';
  const badgeLabel = BADGE_LABELS[badgeVariant][lang];
  const closeLabel = CLOSE_LABELS[lang];

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 px-4 py-6 animate-in fade-in duration-200"
      data-testid="global-site-announcement-modal"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={() => dismissAnnouncement(announcement)}
          aria-label={closeLabel}
          className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          data-testid="global-site-announcement-dismiss"
        >
          <X size={16} />
        </button>

        <div className="space-y-5 px-6 pb-7 pt-8 md:px-7">
          <div
            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
              badgeVariant === 'warning'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {badgeLabel}
          </div>

          <div className="space-y-3">
            <h2 className="pr-10 text-[24px] font-black leading-tight tracking-tight text-slate-900 md:text-[28px]">
              {copy.title}
            </h2>
            <p className="text-sm leading-7 text-slate-600 md:text-[15px]">
              {copy.body}
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => dismissAnnouncement(announcement)}
              className="w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-300 transition-transform hover:scale-[1.01]"
              data-testid="global-site-announcement-primary"
            >
              {copy.primaryLabel}
            </button>
            {announcement.href && copy.secondaryLabel ? (
              <Link
                href={announcement.href}
                onClick={() => dismissAnnouncement(announcement)}
                className="block w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                data-testid="global-site-announcement-secondary"
              >
                {copy.secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
