'use client';

import React, { useEffect, useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Info, BookOpen, CreditCard } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Skeleton from '@/app/components/ui/Skeleton';
import {
  BOOKING_CONFIRMED_STATUSES,
  isCancelledOnlyBookingStatus,
  isCompletedBookingStatus,
} from '@/app/constants/bookingStatus';
import { useLanguage } from '@/app/context/LanguageContext';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';
import { isMissingPayoutPaidAtColumnError } from '@/app/utils/payoutPaidAt';

type EarningsBookingRow = {
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

type EarningsStats = {
  totalPayout: number;
  pendingPayout: number;
  paidPayout: number;
  completedBookingCount: number;
  payoutItemCount: number;
  latestPaidAt: string | null;
};

function formatLatestPayoutDate(value: string | null, locale: string) {
  if (!value) return null;

  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };

  return new Intl.DateTimeFormat(localeMap[locale] || 'ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getBookingChartDateKey(booking: EarningsBookingRow) {
  if (booking.date && /^\d{4}-\d{2}-\d{2}$/.test(booking.date)) {
    return booking.date;
  }

  return formatDateKey(new Date(booking.created_at));
}

export default function Earnings() {
  const supabase = createClient();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);

  const [stats, setStats] = useState<EarningsStats>({
    totalPayout: 0,
    pendingPayout: 0,
    paidPayout: 0,
    completedBookingCount: 0,
    payoutItemCount: 0,
    latestPaidAt: null,
  });

  const [chartData, setChartData] = useState<{
    date: string;
    amount: number;
    itemCount: number;
    label: string;
    isToday: boolean;
  }[]>([]);

  useEffect(() => {
    const closeMenu = () => setShowSettings(false);
    if (showSettings) document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [showSettings]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 예약 데이터 가져오기
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

          bookings = ((fallbackResult.data || []) as EarningsBookingRow[]).map((booking) => ({
            ...booking,
            payout_paid_at: null,
          }));
          error = fallbackResult.error;
        }

        if (error) throw error;

        let totalPayout = 0;
        let pendingPayout = 0;
        let paidPayout = 0;
        let completedBookingCount = 0;
        let payoutItemCount = 0;
        let latestPaidAt: string | null = null;

        const dailyIncome: Record<string, number> = {};
        const dailyItemCounts: Record<string, number> = {};

        (bookings as EarningsBookingRow[] | null)?.forEach((booking) => {
          const itemPayout = getBookingHostPayout(booking);
          if (isCancelledOnlyBookingStatus(booking.status) && itemPayout <= 0) {
            return;
          }

          const dateStr = getBookingChartDateKey(booking);
          totalPayout += itemPayout;
          payoutItemCount++;

          if (isCompletedBookingStatus(booking.status)) {
            completedBookingCount++;
          }

          if (booking.payout_status === 'paid') {
            paidPayout += itemPayout;
            if (!latestPaidAt || (booking.payout_paid_at && booking.payout_paid_at > latestPaidAt)) {
              latestPaidAt = booking.payout_paid_at || latestPaidAt;
            }
          } else {
            pendingPayout += itemPayout;
          }

          if (dailyIncome[dateStr]) {
            dailyIncome[dateStr] += itemPayout;
          } else {
            dailyIncome[dateStr] = itemPayout;
          }

          if (dailyItemCounts[dateStr]) {
            dailyItemCounts[dateStr] += 1;
          } else {
            dailyItemCounts[dateStr] = 1;
          }
        });

        // 차트 데이터 생성
        const chart = [];
        const today = new Date();

        for (let i = -7; i <= 4; i++) {
          const d = new Date();
          d.setDate(today.getDate() + i);
          const dateStr = formatDateKey(d);
          const dayLabel = String(d.getDate());

          chart.push({
            date: dateStr,
            amount: dailyIncome[dateStr] || 0,
            itemCount: dailyItemCounts[dateStr] || 0,
            label: dayLabel,
            isToday: i === 0
          });
        }

        setStats({
          totalPayout,
          pendingPayout,
          paidPayout,
          completedBookingCount,
          payoutItemCount,
          latestPaidAt,
        });

        setChartData(chart);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase]);

  if (loading) return <Skeleton className="w-full h-[500px] rounded-3xl" />;

  const maxAmount = Math.max(...chartData.map(d => d.amount), 10000);

  return (
    <div className="max-w-md mx-auto md:max-w-none md:mx-0 min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 상단 헤더 & 설정 버튼 */}
      <div className="flex items-center justify-between mb-4 md:mb-8 px-1 md:px-2 relative z-50">
        <h2 className="text-lg md:text-2xl font-bold text-slate-900">{t('hp_earn_title')}</h2>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
            }}
            className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Settings size={20} />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => router.push('/host/help')}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-3 border-b border-slate-50"
              >
                <BookOpen size={16} className="text-slate-400" /> {t('host_guidebook')}
              </button>
              <button
                onClick={() => router.push('/host/dashboard?tab=profile')}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-3"
              >
                <CreditCard size={16} className="text-slate-400" /> {t('manage_payout_account')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 메인 카드 */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl shadow-slate-200/60 border border-slate-100 relative">
        <div
          data-testid="host-earnings-scope-note"
          className="mb-5 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-600 md:mb-6 md:text-xs"
        >
          <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <p>{t('hp_earn_scope_note')}</p>
        </div>

        <div
          data-testid="host-earnings-payout-summary"
          className="mb-5 grid grid-cols-1 gap-3 md:mb-6 md:grid-cols-3"
        >
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 md:text-[11px]">
              {t('hp_earn_pending')}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900 md:text-xl">
              ₩{stats.pendingPayout.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 md:text-[11px]">
              {t('hp_earn_completed')}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900 md:text-xl">
              ₩{stats.paidPayout.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 md:text-[11px]">
              {t('hp_earn_last_paid')}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900 md:text-base">
              {formatLatestPayoutDate(stats.latestPaidAt, lang) || t('hp_earn_last_paid_empty')}
            </p>
          </div>
        </div>

        <div className="text-center mb-6 md:mb-10 relative z-10">
          <p className="text-slate-400 font-bold text-[10px] md:text-xs mb-1.5 md:mb-2 flex items-center justify-center gap-1 uppercase tracking-wider">
            {t('hp_earn_total_pending')} <Info size={12} />
          </p>
          <h1 data-testid="host-earnings-total-payout" className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">
            ₩{stats.totalPayout.toLocaleString()}
          </h1>

          <div
            data-testid="host-earnings-completed-booking-count"
            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600"
          >
            {t('hp_earn_count_completed').replace('{count}', String(stats.completedBookingCount))}
          </div>
        </div>

        <div className="h-44 md:h-56 mt-4 flex items-end justify-between gap-1 md:gap-4 relative z-10">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 z-0">
            <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
            <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
            <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
          </div>

          {chartData.map((d, i) => {
            const isTooltipVisible = activeTooltipDate === d.date;

            return (
              <div
                key={i}
                data-testid={`host-earnings-group-${d.date}`}
                className="group relative z-10 flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1.5 pb-1"
                onMouseEnter={() => setActiveTooltipDate(d.date)}
                onMouseLeave={() => setActiveTooltipDate((current) => (current === d.date ? null : current))}
                onClick={() => setActiveTooltipDate((current) => (current === d.date ? null : d.date))}
              >
                <div className="relative flex flex-col items-center w-full">
                  <div
                    data-testid={`host-earnings-tooltip-${d.date}`}
                    className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[150px] md:w-[180px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-white shadow-md transition-opacity opacity-0 group-hover:opacity-100 ${
                      isTooltipVisible ? 'opacity-100' : ''
                    }`}
                  >
                    <div className="mb-0.5 text-[10px] font-bold text-slate-300 md:text-[11px]">{d.date}</div>
                    <div className="text-xs font-black md:text-sm">₩{d.amount.toLocaleString()}</div>
                    <div suppressHydrationWarning className="mt-1 text-[10px] text-slate-300 md:text-xs">
                      {t('hp_earn_bar_total_caption')}
                    </div>
                    <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900"></div>
                  </div>

                  {d.isToday ? (
                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></div>
                  ) : (
                    // 보이지 않는 점선 역할의 공간(높이 유지)
                    <div className="w-2.5 h-2.5 opacity-0"></div>
                  )}
                </div>

                <span className={`text-[10px] font-bold ${d.isToday ? 'text-slate-900' : 'text-slate-400'}`}>
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
        <p
          data-testid="host-earnings-today-marker-note"
          className="mt-4 text-center text-[10px] font-medium text-slate-400 md:text-xs"
        >
          {t('hp_earn_today_marker_note')}
        </p>
      </div>

      {/* 하단 요약 */}
      <div className="mt-6">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="w-full bg-white hover:bg-slate-50 transition-colors py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 shadow-sm"
        >
          {showSummary ? t('hp_earn_hide_summary') : t('hp_earn_show_summary')}
          {showSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSummary && (
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
                  {stats.completedBookingCount}{t('unit_cases')}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t('hp_earn_payout_items')}</span>
                <span data-testid="host-earnings-summary-payout-items" className="font-bold text-slate-900">
                  {stats.payoutItemCount}{t('unit_cases')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-black text-sm md:text-base text-slate-900">{t('hp_earn_net')}</span>
                <span className="font-black text-xl md:text-2xl text-slate-900">₩{stats.totalPayout.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-slate-400 text-right mt-1">{t('hp_earn_tax_note')}</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
