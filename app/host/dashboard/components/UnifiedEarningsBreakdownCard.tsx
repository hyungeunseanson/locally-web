'use client';

import { useLanguage } from '@/app/context/LanguageContext';
import type { HostUnifiedEarningsSummary } from '@/app/types/hostEarnings';

type UnifiedEarningsBreakdownCardProps = {
  summary: HostUnifiedEarningsSummary;
};

function BreakdownCell({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{label}</p>
      <p data-testid={testId} className="mt-2 text-lg font-black text-slate-900 md:text-xl">
        {value}
      </p>
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
      className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <BreakdownCell
          label={t('hp_earn_breakdown_experience_pending')}
          value={`₩${summary.experience.pending_payout_amount.toLocaleString()}`}
          testId="host-earnings-breakdown-experience-pending"
        />
        <BreakdownCell
          label={t('hp_earn_breakdown_service_pending')}
          value={`₩${summary.service.pending_payout_amount.toLocaleString()}`}
          testId="host-earnings-breakdown-service-pending"
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-500 md:text-xs">
            {t('hp_earn_breakdown_in_progress')}
          </p>
          <p
            data-testid="host-earnings-breakdown-in-progress"
            className="mt-2 text-[13px] font-bold text-slate-900 md:text-sm"
          >
            {t('hp_earn_breakdown_in_progress_split')
              .replace('{experience}', `₩${summary.experience.in_progress_amount.toLocaleString()}`)
              .replace('{service}', `₩${summary.service.in_progress_amount.toLocaleString()}`)}
          </p>
          <p
            data-testid="host-earnings-breakdown-note"
            className="mt-2 text-[11px] leading-relaxed text-slate-500 md:text-xs"
          >
            {t('hp_earn_breakdown_note')}
          </p>
        </div>
      </div>
    </div>
  );
}
