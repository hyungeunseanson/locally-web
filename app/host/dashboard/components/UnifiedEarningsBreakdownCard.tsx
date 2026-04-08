'use client';

import { useLanguage } from '@/app/context/LanguageContext';
import type { HostUnifiedEarningsSummary } from '@/app/types/hostEarnings';

type UnifiedEarningsBreakdownCardProps = {
  summary: HostUnifiedEarningsSummary;
};

function BreakdownRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm font-medium text-slate-600 md:text-[15px]">{label}</span>
      <span data-testid={testId} className="shrink-0 text-base font-black text-slate-900 md:text-lg">
        {value}
      </span>
    </div>
  );
}

export default function UnifiedEarningsBreakdownCard({
  summary,
}: UnifiedEarningsBreakdownCardProps) {
  const { t } = useLanguage();

  return (
    <div
      data-testid="host-earnings-breakdown-card"
      className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 md:px-5"
    >
      <BreakdownRow
        label={t('hp_earn_breakdown_experience_pending')}
        value={`₩${summary.experience.pending_payout_amount.toLocaleString()}`}
        testId="host-earnings-breakdown-experience-pending"
      />
      <BreakdownRow
        label={t('hp_earn_breakdown_service_pending')}
        value={`₩${summary.service.pending_payout_amount.toLocaleString()}`}
        testId="host-earnings-breakdown-service-pending"
      />

      <div className="my-2 h-px bg-slate-200" />

      <div className="flex items-start justify-between gap-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 md:text-[15px]">
            {t('hp_earn_breakdown_in_progress')}
          </p>
          <p
            data-testid="host-earnings-breakdown-note"
            className="mt-1 text-[11px] leading-relaxed text-slate-500 md:text-xs"
          >
            {t('hp_earn_breakdown_note')}
          </p>
        </div>
        <span
          data-testid="host-earnings-breakdown-in-progress"
          className="shrink-0 text-right text-[13px] font-bold text-slate-900 md:text-sm"
        >
          {t('hp_earn_breakdown_in_progress_split')
            .replace('{experience}', `₩${summary.experience.in_progress_amount.toLocaleString()}`)
            .replace('{service}', `₩${summary.service.in_progress_amount.toLocaleString()}`)}
        </span>
      </div>
    </div>
  );
}
