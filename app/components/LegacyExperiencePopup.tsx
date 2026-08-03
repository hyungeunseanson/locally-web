'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLanguage, type Locale } from '@/app/context/LanguageContext';

export const LEGACY_EXPERIENCE_POPUP_STORAGE_KEY = 'locally_legacy_popup_closed_at';
export const LEGACY_EXPERIENCE_POPUP_HIDE_MS = 7 * 24 * 60 * 60 * 1000;
export const LEGACY_EXPERIENCE_URL = 'https://locally2.imweb.me';

const COPY: Record<
  Locale,
  {
    badge: string;
    title: string;
    body: string;
    legacyAction: string;
    continueAction: string;
    closeLabel: string;
  }
> = {
  ko: {
    badge: '안내',
    title: '찾으시던 체험이 보이지 않나요?',
    body:
      '로컬리가 새로운 웹사이트로 이전하면서, 일부 호스트와 체험은 아직 기존 웹사이트에 남아 있어요.\n이전에 보셨던 체험은 기존 웹사이트에서 그대로 확인하고 예약하실 수 있습니다.',
    legacyAction: '기존 체험 보러가기',
    continueAction: '새 로컬리 계속 둘러보기',
    closeLabel: '팝업 닫기',
  },
  en: {
    badge: 'Notice',
    title: "Can't find the experience you were looking for?",
    body:
      'As Locally moves to a new website, some hosts and experiences are still available on our previous site.\nYou can continue to view and book those experiences there.',
    legacyAction: 'View previous experiences',
    continueAction: 'Continue exploring Locally',
    closeLabel: 'Close popup',
  },
  ja: {
    badge: 'ご案内',
    title: 'お探しの体験が見つかりませんか？',
    body:
      'Locallyの新しいウェブサイトへの移行に伴い、一部のホストと体験は以前のサイトに残っています。\n以前ご覧になった体験は、これまでのサイトで引き続き確認・予約できます。',
    legacyAction: '以前の体験を見る',
    continueAction: '新しいLocallyを見る',
    closeLabel: 'ポップアップを閉じる',
  },
  zh: {
    badge: '通知',
    title: '找不到之前看过的体验吗？',
    body:
      'Locally 正在迁移到新网站，部分房东和体验目前仍保留在旧网站。\n您仍可前往旧网站查看并预订之前浏览过的体验。',
    legacyAction: '查看旧网站体验',
    continueAction: '继续浏览新 Locally',
    closeLabel: '关闭弹窗',
  },
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function wasRecentlyDismissed(now = Date.now()) {
  try {
    const dismissedAt = Number(window.localStorage.getItem(LEGACY_EXPERIENCE_POPUP_STORAGE_KEY));
    return Number.isFinite(dismissedAt) && dismissedAt > 0 && now - dismissedAt < LEGACY_EXPERIENCE_POPUP_HIDE_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(LEGACY_EXPERIENCE_POPUP_STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable in private browsing. Closing must still work.
  }
}

function hasVisibleCompetingDialog(currentDialog: HTMLElement | null = null) {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some(
    (element) =>
      element !== currentDialog &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0
  );
}

export default function LegacyExperiencePopup() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (wasRecentlyDismissed()) return;

    const timer = window.setTimeout(() => {
      // Avoid stacking this general notice over a higher-priority operational modal.
      if (hasVisibleCompetingDialog()) return;
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const appShell = document.getElementById('locally-app-shell');
    const previousOverflow = body.style.overflow;
    const previousInert = appShell?.hasAttribute('inert') ?? false;
    const previousAriaHidden = appShell?.getAttribute('aria-hidden');

    body.style.overflow = 'hidden';
    appShell?.setAttribute('inert', '');
    appShell?.setAttribute('aria-hidden', 'true');
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousOverflow;
      if (!previousInert) appShell?.removeAttribute('inert');
      if (previousAriaHidden == null) appShell?.removeAttribute('aria-hidden');
      else appShell?.setAttribute('aria-hidden', previousAriaHidden);
    };
  }, [dismiss, open]);

  if (!open || typeof document === 'undefined') return null;

  const copy = COPY[lang] ?? COPY.ko;

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-end justify-center bg-black/35 p-3 md:items-center md:p-8"
      data-testid="legacy-experience-popup-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legacy-experience-popup-title"
        aria-describedby="legacy-experience-popup-description"
        className="relative max-h-[calc(100dvh-24px)] w-full overflow-y-auto rounded-[22px] bg-white px-5 pb-5 pt-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] md:max-h-[calc(100dvh-64px)] md:max-w-[720px] md:rounded-[20px] md:p-10"
        data-testid="legacy-experience-popup"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={dismiss}
          aria-label={copy.closeLabel}
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-[#111111] transition-colors hover:bg-neutral-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:right-7 md:top-7"
          data-testid="legacy-experience-popup-close"
        >
          <X aria-hidden="true" className="size-6" strokeWidth={1.8} />
        </button>

        <span className="mb-5 inline-flex min-h-8 items-center justify-center rounded-lg bg-[#f1f1f1] px-3 text-sm font-semibold text-[#111111] md:mb-6">
          {copy.badge}
        </span>

        <h2
          id="legacy-experience-popup-title"
          className="mb-4 mr-10 break-keep text-[27px] font-extrabold leading-[1.3] text-[#111111] md:mb-5 md:mr-12 md:text-[36px] md:leading-[1.25]"
        >
          {copy.title}
        </h2>

        <p
          id="legacy-experience-popup-description"
          className="whitespace-pre-line break-keep text-[15px] leading-[1.65] text-[#3d3d3d] md:text-lg md:leading-[1.7]"
        >
          {copy.body}
        </p>

        <div aria-hidden="true" className="my-5 h-px bg-[#dedede] md:my-7" />

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
          <a
            href={LEGACY_EXPERIENCE_URL}
            onClick={rememberDismissal}
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-[#111111] bg-[#111111] px-4 py-3 text-center text-base font-bold text-white no-underline transition-colors hover:bg-[#2a2a2a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:min-h-[60px] md:px-5 md:text-[17px]"
            data-testid="legacy-experience-popup-legacy-link"
          >
            {copy.legacyAction}
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl border-2 border-[#111111] bg-white px-4 py-3 text-center text-base font-bold text-[#111111] transition-colors hover:bg-[#f5f5f5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:min-h-[60px] md:px-5 md:text-[17px]"
            data-testid="legacy-experience-popup-continue"
          >
            {copy.continueAction}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
