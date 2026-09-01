'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { useLanguage } from '@/app/context/LanguageContext';

type ChatSafetyNoticeProps = {
  emailSettingsHref: string;
};

export default function ChatSafetyNotice({ emailSettingsHref }: ChatSafetyNoticeProps) {
  const { t } = useLanguage();

  return (
    <aside
      data-testid="chat-safety-notice"
      className="shrink-0 border-b border-amber-100/80 bg-amber-50/65 px-2.5 py-1.5 md:px-4 md:py-2"
      aria-label={t('chat_safety_title')}
    >
      <div className="flex min-h-[52px] max-h-[64px] items-start gap-1.5 md:min-h-[36px] md:max-h-none md:items-center md:gap-2.5">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 md:mt-0 md:h-4 md:w-4"
        />
        <div className="min-w-0 flex-1 md:flex md:items-center md:justify-between md:gap-4">
          <div className="min-w-0">
            <p className="truncate text-[10.5px] font-bold leading-3 text-slate-800 md:text-[11px] md:leading-4">
              {t('chat_safety_title')}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-[13px] tracking-[-0.025em] text-slate-600 md:hidden">
              {t('chat_safety_mobile_body')}
            </p>
            <p className="hidden text-[10px] leading-[14px] text-slate-600 md:block">
              {t('chat_safety_body')}
            </p>
          </div>
          <div className="mt-0.5 flex shrink-0 items-center gap-1 text-[9px] leading-3 text-slate-500 md:mt-0 md:text-[10px]">
            <span className="md:hidden">{t('chat_safety_mobile_email_prompt')}</span>
            <span className="hidden md:inline">{t('chat_safety_email_prompt')}</span>
            <Link
              data-testid="chat-safety-notification-link"
              href={emailSettingsHref}
              className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {t('chat_safety_email_link')}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
