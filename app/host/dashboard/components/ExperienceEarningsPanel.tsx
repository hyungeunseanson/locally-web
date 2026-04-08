'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

import Skeleton from '@/app/components/ui/Skeleton';
import {
  BOOKING_CONFIRMED_STATUSES,
  isCancelledOnlyBookingStatus,
  isCompletedBookingStatus,
} from '@/app/constants/bookingStatus';
import { useLanguage } from '@/app/context/LanguageContext';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';
import { createClient } from '@/app/utils/supabase/client';
import { isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';

import { formatDateKey, formatLatestPayoutDate } from './earningsShared';

type ExperienceEarningsBookingRow = {
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

type ExperienceEarningsStats = {
  totalPayout: number;
  pendingPayout: number;
  paidPayout: number;
  completedBookingCount: number;
  payoutItemCount: number;
  latestPaidAt: string | null;
};

function getBookingChartDateKey(booking: ExperienceEarningsBookingRow) {
  if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    return booking.date;
  }

  return formatDateKey(new Date(booking.created_at));
}

export default function ExperienceEarningsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const { t, lang } = useLanguage();

  const [experienceLoading, setExperienceLoading] = useState(true);
  const [showExperienceSummary, setShowExperienceSummary] = useState(false);
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);
  const [experienceStats, setExperienceStats] = useState<ExperienceEarningsStats>({
    totalPayout: 0,
    pendingPayout: 0,
    paidPayout: 0,
    completedBookingCount: 0,
    payoutItemCount: 0,
    latestPaidAt: null,
  });
  const [experienceChartData, setExperienceChartData] = useState<
    {
      date: string;
      amount: number;
      itemCount: number;
      label: string;
      isToday: boolean;
    }[]
  >([]);

  useEffect(() => {
    const fetchExperienceEarnings = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setExperienceLoading(false);
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

          bookings = ((fallbackResult.data || []) as ExperienceEarningsBookingRow[]).map((booking) => ({
            ...booking,
            payout_paid_at: null,
          }));
          error = fallbackResult.error;
        }

        if (error) {
          throw error;
        }

        let totalPayout = 0;
        let pendingPayout = 0;
        let paidPayout = 0;
        let completedBookingCount = 0;
        let payoutItemCount = 0;
        let latestPaidAt: string | null = null;

        const dailyIncome: Record<string, number> = {};
        const dailyItemCounts: Record<string, number> = {};

        (bookings as ExperienceEarningsBookingRow[] | null)?.forEach((booking) => {
          const itemPayout = getBookingHostPayout(booking);
          if (isCancelledOnlyBookingStatus(booking.status) && itemPayout <= 0) {
            return;
          }

          const dateStr = getBookingChartDateKey(booking);
          totalPayout += itemPayout;
          payoutItemCount += 1;

          if (isCompletedBookingStatus(booking.status)) {
            completedBookingCount += 1;
          }

          if (booking.payout_status === 'paid') {
            paidPayout += itemPayout;
            if (!latestPaidAt || (booking.payout_paid_at && booking.payout_paid_at > latestPaidAt)) {
              latestPaidAt = booking.payout_paid_at || latestPaidAt;
            }
          } else {
            pendingPayout += itemPayout;
          }

          dailyIncome[dateStr] = (dailyIncome[dateStr] || 0) + itemPayout;
          dailyItemCounts[dateStr] = (dailyItemCounts[dateStr] || 0) + 1;
        });

        const today = new Date();
        const chart = [];

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

        setExperienceStats({
          totalPayout,
          pendingPayout,
          paidPayout,
          completedBookingCount,
          payoutItemCount,
          latestPaidAt,
        });
        setExperienceChartData(chart);
      } catch (error) {
        console.error('[HOST] experience earnings panel error:', error);
      } finally {
        setExperienceLoading(false);
      }
    };

    void fetchExperienceEarnings();
  }, [supabase]);

  if (experienceLoading) {
    return <Skeleton className="h-[500px] w-full rounded-3xl" />;
  }

  return (
    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl shadow-slate-200/60 border border-slate-100 relative">
      <div
        data-testid="host-earnings-scope-note"
        className="mb-5 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-600 md:mb-6 md:text-xs"
      >
        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <p>{t('hp_earn_scope_note')}</p>
      </div>

      <div className="text-center mb-6 md:mb-10 relative z-10">
        <p className="text-slate-400 font-bold text-[10px] md:text-xs mb-1.5 md:mb-2 flex items-center justify-center gap-1 uppercase tracking-wider">
          {t('hp_earn_pending')} <Info size={12} />
        </p>
        <h1 data-testid="host-earnings-total-payout" className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">
          ₩{experienceStats.pendingPayout.toLocaleString()}
        </h1>
        <p
          data-testid="host-earnings-last-paid-inline"
          className="mt-1 text-[10px] font-medium text-slate-400 md:text-xs"
        >
          {t('hp_earn_last_paid_inline')}:{' '}
          {formatLatestPayoutDate(experienceStats.latestPaidAt, lang) || t('hp_earn_last_paid_empty')}
        </p>

        <div
          data-testid="host-earnings-completed-booking-count"
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
        >
          {t('hp_earn_count_completed').replace('{count}', String(experienceStats.completedBookingCount))}
        </div>
      </div>

      <div className="h-44 md:h-56 mt-4 flex items-end justify-between gap-1 md:gap-4 relative z-10">
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
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></div>
                ) : (
                  <div className="w-2.5 h-2.5 opacity-0"></div>
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

      <div className="mt-6">
        <button
          onClick={() => setShowExperienceSummary((current) => !current)}
          className="w-full bg-white hover:bg-slate-50 transition-colors py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 shadow-sm"
        >
          {showExperienceSummary ? t('hp_earn_hide_summary') : t('hp_earn_show_summary')}
          {showExperienceSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showExperienceSummary && (
          <div className="mt-4 bg-slate-50 rounded-3xl p-6 md:p-8 animate-in slide-in-from-top-4 duration-300 fade-in border border-slate-100">
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
                  {experienceStats.completedBookingCount}
                  {t('unit_cases')}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('hp_earn_payout_items')}</span>
                <span data-testid="host-earnings-summary-payout-items" className="font-bold text-slate-900">
                  {experienceStats.payoutItemCount}
                  {t('unit_cases')}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('hp_earn_pending')}</span>
                <span data-testid="host-earnings-summary-pending-payout" className="font-bold text-slate-900">
                  ₩{experienceStats.pendingPayout.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('hp_earn_completed')}</span>
                <span data-testid="host-earnings-summary-paid-payout" className="font-bold text-slate-900">
                  ₩{experienceStats.paidPayout.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('hp_earn_last_paid')}</span>
                <span data-testid="host-earnings-summary-last-paid" className="font-bold text-slate-900">
                  {formatLatestPayoutDate(experienceStats.latestPaidAt, lang) || t('hp_earn_last_paid_empty')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-black text-sm md:text-base text-slate-900">{t('hp_earn_net')}</span>
                <span data-testid="host-earnings-summary-net-payout" className="font-black text-xl md:text-2xl text-slate-900">
                  ₩{experienceStats.totalPayout.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 text-right mt-1">{t('hp_earn_tax_note')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
