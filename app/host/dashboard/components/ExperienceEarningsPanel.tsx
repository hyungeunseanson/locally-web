'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

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

function isExperienceChartBookingRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readExperienceChartNumber(
  row: Record<string, unknown>,
  key: keyof ExperienceChartBookingRow
): number | null | undefined {
  const value = row[key];
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function readExperienceChartString(
  row: Record<string, unknown>,
  key: keyof ExperienceChartBookingRow
): string | null | undefined {
  const value = row[key];
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : undefined;
}

function normalizeExperienceChartBookingRow(raw: unknown): ExperienceChartBookingRow | null {
  if (!isExperienceChartBookingRecord(raw)) {
    return null;
  }

  const createdAt = readExperienceChartString(raw, 'created_at');
  const status = readExperienceChartString(raw, 'status');

  if (!createdAt || !status) {
    return null;
  }

  return {
    amount: readExperienceChartNumber(raw, 'amount'),
    total_price: readExperienceChartNumber(raw, 'total_price'),
    total_experience_price: readExperienceChartNumber(raw, 'total_experience_price'),
    created_at: createdAt,
    date: readExperienceChartString(raw, 'date'),
    status,
    host_payout_amount: readExperienceChartNumber(raw, 'host_payout_amount'),
    platform_revenue: readExperienceChartNumber(raw, 'platform_revenue'),
    price_at_booking: readExperienceChartNumber(raw, 'price_at_booking'),
    solo_guarantee_price: readExperienceChartNumber(raw, 'solo_guarantee_price'),
    payout_status: readExperienceChartString(raw, 'payout_status'),
    payout_paid_at: readExperienceChartString(raw, 'payout_paid_at') ?? null,
  };
}

function normalizeExperienceChartBookingRows(rawRows: unknown): ExperienceChartBookingRow[] {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows.reduce<ExperienceChartBookingRow[]>((rows, rawRow) => {
    const normalizedRow = normalizeExperienceChartBookingRow(rawRow);
    if (normalizedRow) {
      rows.push(normalizedRow);
    }
    return rows;
  }, []);
}

function getBookingChartDateKey(booking: ExperienceChartBookingRow) {
  if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    return booking.date;
  }

  return formatDateKey(new Date(booking.created_at));
}

export default function ExperienceEarningsPanel({ summary }: ExperienceEarningsPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const { t, lang } = useLanguage();

  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);
  const [experienceChartData, setExperienceChartData] = useState<ExperienceChartPoint[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const totalPayout =
    summary.pending_payout_amount + summary.in_progress_amount + summary.paid_payout_amount;
  const detailsPanelId = 'host-earnings-details-panel';

  useEffect(() => {
    let cancelled = false;

    const fetchExperienceChart = async () => {
      try {
        setChartLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          return;
        }

        const initialResult = await supabase
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

        let bookings = normalizeExperienceChartBookingRows(initialResult.data);
        let error = initialResult.error;

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

          bookings = normalizeExperienceChartBookingRows(fallbackResult.data);
          error = fallbackResult.error;
        }

        if (error) {
          throw error;
        }

        const dailyIncome: Record<string, number> = {};
        const dailyItemCounts: Record<string, number> = {};

        bookings.forEach((booking) => {
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
      } catch (error) {
        if (cancelled) return;
        console.error('[HOST] experience earnings panel error:', error);
        setChartError(error instanceof Error ? error.message : 'Failed to load experience earnings.');
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    };

    void fetchExperienceChart();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div
      data-testid="host-earnings-experience-section"
      className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/60 md:overflow-visible md:rounded-[2.5rem] md:p-8"
    >
      <div
        className="mb-5 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-600 md:mb-6 md:text-xs"
      >
        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <p>{t('hp_earn_scope_note')}</p>
      </div>

      <div className="relative z-10 mb-6 text-center md:mb-10">
        <p className="mb-1.5 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:mb-2 md:text-xs">
          {t('hp_earn_pending')} <Info size={12} />
        </p>
        <h1 data-testid="host-earnings-experience-pending" className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
          ₩{summary.pending_payout_amount.toLocaleString()}
        </h1>
      </div>

      {chartLoading ? (
        <Skeleton className="h-[260px] w-full rounded-3xl" />
      ) : chartError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-5 text-sm font-medium text-rose-700">
          {chartError}
        </div>
      ) : (
        <>
          <div className="relative z-10 mt-4 flex h-44 items-end justify-between gap-1 md:h-56 md:gap-4">
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col justify-between opacity-10">
              <div className="h-px w-full border-t border-dashed border-slate-900"></div>
              <div className="h-px w-full border-t border-dashed border-slate-900"></div>
              <div className="h-px w-full border-t border-dashed border-slate-900"></div>
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
                      className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[150px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-white shadow-md transition-opacity opacity-0 group-hover:opacity-100 md:w-[180px] ${
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
                      <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"></div>
                    ) : (
                      <div className="h-2.5 w-2.5 opacity-0"></div>
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
        </>
      )}

      <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6 md:p-8">
        <button
          type="button"
          data-testid="host-earnings-details-toggle"
          aria-expanded={isDetailsOpen}
          aria-controls={detailsPanelId}
          className="flex w-full items-center justify-between gap-4 text-left"
          onClick={() => setIsDetailsOpen((current) => !current)}
        >
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800 md:text-lg">{t('hp_earn_details')}</h3>
            <p className="mt-1 text-[11px] font-medium text-slate-400 md:text-xs">
              {isDetailsOpen ? t('hp_earn_hide_summary') : t('hp_earn_show_summary')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded border bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t('hp_earn_ytd')}
            </span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-slate-400 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {isDetailsOpen ? (
          <div id={detailsPanelId} data-testid="host-earnings-details-panel" className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t('hp_earn_count')}</span>
              <span data-testid="host-earnings-summary-completed-count" className="font-bold text-slate-900">
                {summary.completed_booking_count}
                {t('unit_cases')}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t('hp_earn_payout_items')}</span>
              <span data-testid="host-earnings-summary-payout-items" className="font-bold text-slate-900">
                {summary.payout_item_count}
                {t('unit_cases')}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t('hp_earn_in_progress')}</span>
              <span data-testid="host-earnings-summary-in-progress" className="font-bold text-slate-900">
                ₩{summary.in_progress_amount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t('hp_earn_completed')}</span>
              <span data-testid="host-earnings-summary-paid-payout" className="font-bold text-slate-900">
                ₩{summary.paid_payout_amount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t('hp_earn_last_paid')}</span>
              <span data-testid="host-earnings-summary-last-paid" className="font-bold text-slate-900">
                {formatLatestPayoutDate(summary.latest_paid_at, lang) || t('hp_earn_last_paid_empty')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-900 md:text-base">{t('hp_earn_net')}</span>
              <span data-testid="host-earnings-summary-net-payout" className="text-xl font-black text-slate-900 md:text-2xl">
                ₩{totalPayout.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">{t('hp_earn_tax_note')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
