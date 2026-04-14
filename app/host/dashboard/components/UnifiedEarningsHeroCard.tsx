'use client';

import { Info } from 'lucide-react';

import { useLanguage } from '@/app/context/LanguageContext';
import type { HostUnifiedEarningsSummary } from '@/app/types/hostEarnings';

import { formatLatestPayoutDate } from './earningsShared';

type UnifiedEarningsHeroCardProps = {
  summary: HostUnifiedEarningsSummary;
};

export default function UnifiedEarningsHeroCard({ summary }: UnifiedEarningsHeroCardProps) {
  const { t, lang } = useLanguage();

  return (
    <div
      data-testid="host-earnings-unified-hero"
      className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-lg shadow-slate-200/50 md:px-6 md:py-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:text-xs">
            {t('hp_earn_unified_title')}
          </p>
          <h1
            data-testid="host-earnings-unified-total"
            className="mt-2 text-[30px] font-black tracking-tight text-slate-900 md:text-[42px]"
          >
            ₩{summary.total_pending_payout_amount.toLocaleString()}
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 md:text-xs">
            {t('hp_earn_unified_scope_note')}
          </p>
        </div>

        <div className="flex max-w-full flex-wrap items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500 md:text-xs">
          <Info size={14} className="shrink-0 text-slate-400" />
          <span data-testid="host-earnings-unified-last-paid" className="min-w-0 whitespace-normal break-words">
            {t('hp_earn_last_paid_inline')}: {formatLatestPayoutDate(summary.latest_paid_at, lang) || t('hp_earn_last_paid_empty')}
          </span>
        </div>
      </div>
    </div>
  );
}
