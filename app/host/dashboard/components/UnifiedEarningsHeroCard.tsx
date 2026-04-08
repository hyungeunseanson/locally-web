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
      className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-xl shadow-slate-200/60 md:px-7 md:py-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:text-xs">
        {t('hp_earn_unified_title')}
      </p>
      <h1
        data-testid="host-earnings-unified-total"
        className="mt-3 text-[32px] font-black tracking-tight text-slate-900 md:text-5xl"
      >
        ₩{summary.total_pending_payout_amount.toLocaleString()}
      </h1>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 md:text-xs">
        {t('hp_earn_unified_scope_note')}
      </p>
      <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-slate-500 md:text-xs">
        <Info size={14} className="shrink-0 text-slate-400" />
        <span data-testid="host-earnings-unified-last-paid">
          {t('hp_earn_last_paid_inline')}: {formatLatestPayoutDate(summary.latest_paid_at, lang) || t('hp_earn_last_paid_empty')}
        </span>
      </div>
    </div>
  );
}
