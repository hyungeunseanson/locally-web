'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

import Skeleton from '@/app/components/ui/Skeleton';
import { BOOKING_CONFIRMED_STATUSES, isCancelledOnlyBookingStatus } from '@/app/constants/bookingStatus';
import { useLanguage } from '@/app/context/LanguageContext';
import type { HostExperienceEarningsSummary } from '@/app/types/hostEarnings';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';
import { createClient } from '@/app/utils/supabase/client';
import { isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';

import { formatDateKey, formatLatestPayoutDate } from './earningsShared';

type ExperienceChartBookingRow = {
  amount?: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  created_at: string;
  date?: string | null;
  status: string;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  price_at_booking?: number | null;
  solo_guarantee_price?: number | null;
  payout_status?: string | null;
  payout_paid_at?: string | null;
};

type ExperienceChartPoint = {
  date: string;
  amount: number;
  itemCount: number;
  label: string;
  isToday: boolean;
};

type ExperienceEarningsPanelProps = {
  summary: HostExperienceEarningsSummary;
};

function getBookingChartDateKey(booking: ExperienceChartBookingRow) {
  if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    return booking.date;
  }

  return formatDateKey(new Date(booking.created_at));
}

export default function ExperienceEarningsPanel({ summary }: ExperienceEarningsPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const { t, lang } = useLanguage();

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoadedBody, setHasLoadedBody] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);
  const [experienceChartData, setExperienceChartData] = useState<ExperienceChartPoint[]>([]);

  const totalPayout =
    summary.pending_payout_amount + summary.in_progress_amount + summary.paid_payout_amount;

  useEffect(() => {
    if (!isExpanded || hasLoadedBody) {
      return;
    }

    let cancelled = false;

    const fetchExperienceChart = async () => {
      try {
        setBodyLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          return;
        }

        let { data: bookings, error } = await supabase
          .from('bookings')
          .select(`
            amount,
            total_price,
            total_experience_price,
            created_at,
            date,
            status,
            host_payout_amount,
            platform_revenue,
            price_at_booking,
            solo_guarantee_price,
            payout_status,
            payout_paid_at,
            experiences!inner ( host_id )
          `)
          .eq('experiences.host_id', user.id)
          .in('status', [...BOOKING_CONFIRMED_STATUSES, 'cancelled', 'CANCELLED']);

        if (error && isMissingPayoutPaidAtColumnError(error)) {
          const fallbackResult = await supabase
            .from('bookings')
            .select(`
              amount,
              total_price,
              total_experience_price,
              created_at,
              date,
              status,
              host_payout_amount,
              platform_revenue,
              price_at_booking,
              solo_guarantee_price,
              payout_status,
              experiences!inner ( host_id )
            `)
            .eq('experiences.host_id', user.id)
            .in('status', [...BOOKING_CONFIRMED_STATUSES, 'cancelled', 'CANCELLED']);

          bookings = ((fallbackResult.data || []) as ExperienceChartBookingRow[]).map((booking) => ({
            ...booking,
            payout_paid_at: null,
          }));
          error = fallbackResult.error;
        }

        if (error) {
          throw error;
        }

        const dailyIncome: Record<string, number> = {};
        const dailyItemCounts: Record<string, number> = {};

        (bookings as ExperienceChartBookingRow[] | null)?.forEach((booking) => {
          const itemPayout = getBookingHostPayout(booking);
          if (isCancelledOnlyBookingStatus(booking.status) && itemPayout <= 0) {
            return;
          }

          const dateStr = getBookingChartDateKey(booking);
          dailyIncome[dateStr] = (dailyIncome[dateStr] || 0) + itemPayout;
          dailyItemCounts[dateStr] = (dailyItemCounts[dateStr] || 0) + 1;
        });

        const today = new Date();
        const chart: ExperienceChartPoint[] = [];

        for (let i = -7; i <= 4; i += 1) {
          const date = new Date();
          date.setDate(today.getDate() + i);
          const dateStr = formatDateKey(date);

          chart.push({
            date: dateStr,
            amount: dailyIncome[dateStr] || 0,
            itemCount: dailyItemCounts[dateStr] || 0,
            label: String(date.getDate()),
            isToday: i === 0,
          });
        }

        if (cancelled) return;

        setExperienceChartData(chart);
        setHasLoadedBody(true);
      } catch (error) {
        if (cancelled) return;
        console.error('[HOST] experience earnings panel error:', error);
        setBodyError(error instanceof Error ? error.message : 'Failed to load experience earnings.');
      } finally {
        if (!cancelled) {
          setBodyLoading(false);
        }
      }
    };

    void fetchExperienceChart();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedBody, isExpanded, supabase]);

  return (
    <div
      data-testid="host-earnings-experience-section"
      className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/60"
    >
      <button
        type="button"
        data-testid="host-earnings-experience-toggle"
        onClick={() => setIsExpanded((current) => !current)}
        className="w-full px-5 py-5 text-left md:px-7 md:py-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:text-xs">
              {t('hp_earn_section_experience')}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500 md:text-xs">
              {t('hp_earn_scope_note')}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-500">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{t('hp_earn_pending')}</p>
            <p
              data-testid="host-earnings-experience-pending"
              className="mt-2 text-xl font-black text-slate-900 md:text-2xl"
            >
              ₩{summary.pending_payout_amount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{t('hp_earn_in_progress')}</p>
            <p
              data-testid="host-earnings-experience-in-progress"
              className="mt-2 text-xl font-black text-slate-900 md:text-2xl"
            >
              ₩{summary.in_progress_amount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{t('hp_earn_completed')}</p>
            <p
              data-testid="host-earnings-experience-paid"
              className="mt-2 text-xl font-black text-slate-900 md:text-2xl"
            >
              ₩{summary.paid_payout_amount.toLocaleString()}
            </p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-5 md:px-7 md:py-6">
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-600 md:mb-6 md:text-xs">
            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <p>{t('hp_earn_scope_note')}</p>
          </div>

          {bodyLoading ? (
            <Skeleton className="h-[260px] w-full rounded-3xl" />
          ) : bodyError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-5 text-sm font-medium text-rose-700">
              {bodyError}
            </div>
          ) : (
            <>
              <div className="h-44 md:h-56 mt-1 flex items-end justify-between gap-1 md:gap-4 relative z-10">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 z-0">
                  <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
                  <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
                  <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
                </div>

                {experienceChartData.map((item) => {
                  const isTooltipVisible = activeTooltipDate === item.date;

                  return (
                    <div
                      key={item.date}
                      data-testid={`host-earnings-group-${item.date}`}
                      className="group relative z-10 flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1.5 pb-1"
                      onMouseEnter={() => setActiveTooltipDate(item.date)}
                      onMouseLeave={() => setActiveTooltipDate((current) => (current === item.date ? null : current))}
                      onClick={() => setActiveTooltipDate((current) => (current === item.date ? null : item.date))}
                    >
                      <div className="relative flex w-full flex-col items-center">
                        <div
                          data-testid={`host-earnings-tooltip-${item.date}`}
                          className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[150px] md:w-[180px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-white shadow-md transition-opacity opacity-0 group-hover:opacity-100 ${
                            isTooltipVisible ? 'opacity-100' : ''
                          }`}
                        >
                          <div className="mb-0.5 text-[10px] font-bold text-slate-300 md:text-[11px]">{item.date}</div>
                          <div className="text-xs font-black md:text-sm">₩{item.amount.toLocaleString()}</div>
                          <div suppressHydrationWarning className="mt-1 text-[10px] text-slate-300 md:text-xs">
                            {t('hp_earn_bar_total_caption')}
                          </div>
                          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900"></div>
                        </div>

                        {item.isToday ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                        ) : (
                          <div className="h-2.5 w-2.5 opacity-0" />
                        )}
                      </div>

                      <span className={`text-[10px] font-bold ${item.isToday ? 'text-slate-900' : 'text-slate-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p
                data-testid="host-earnings-today-marker-note"
                className="mt-4 text-center text-[10px] font-medium text-slate-400 md:text-xs"
              >
                {t('hp_earn_today_marker_note')}
              </p>

              <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-base md:text-lg text-slate-800">{t('hp_earn_details')}</h3>
                  <span className="text-[10px] font-bold bg-white border px-2 py-1 rounded text-slate-400 uppercase tracking-wide">
                    {t('hp_earn_ytd')}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">{t('hp_earn_count')}</span>
                    <span data-testid="host-earnings-summary-completed-count" className="font-bold text-slate-900">
                      {summary.completed_booking_count}
                      {t('unit_cases')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">{t('hp_earn_payout_items')}</span>
                    <span data-testid="host-earnings-summary-payout-items" className="font-bold text-slate-900">
                      {summary.payout_item_count}
                      {t('unit_cases')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">{t('hp_earn_pending')}</span>
                    <span data-testid="host-earnings-summary-pending-payout" className="font-bold text-slate-900">
                      ₩{summary.pending_payout_amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">{t('hp_earn_in_progress')}</span>
                    <span data-testid="host-earnings-summary-in-progress" className="font-bold text-slate-900">
                      ₩{summary.in_progress_amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">{t('hp_earn_completed')}</span>
                    <span data-testid="host-earnings-summary-paid-payout" className="font-bold text-slate-900">
                      ₩{summary.paid_payout_amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">{t('hp_earn_last_paid')}</span>
                    <span data-testid="host-earnings-summary-last-paid" className="font-bold text-slate-900">
                      {formatLatestPayoutDate(summary.latest_paid_at, lang) || t('hp_earn_last_paid_empty')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-black text-sm md:text-base text-slate-900">{t('hp_earn_net')}</span>
                    <span data-testid="host-earnings-summary-net-payout" className="font-black text-xl md:text-2xl text-slate-900">
                      ₩{totalPayout.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 text-right mt-1">{t('hp_earn_tax_note')}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
