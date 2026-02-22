'use client';

import React, { useEffect, useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Info, BookOpen, CreditCard } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Skeleton from '@/app/components/ui/Skeleton';

export default function Earnings() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [stats, setStats] = useState({
    gross: 0,        // 총 매출
    fee: 0,          // 플랫폼 수수료
    exchangeFee: 0,  // 결제망 수수료
    net: 0,          // 최종 정산금
    count: 0         // ✅ [복구] 예약 건수
  });

  const [chartData, setChartData] = useState<{
    date: string;
    amount: number;
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
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select(`
            total_price,
            created_at,
            status,
            host_payout_amount,
            experiences!inner ( host_id )
          `)
          .eq('experiences.host_id', user.id)
          .neq('status', 'declined')
          .neq('status', 'cancellation_requested');

        if (error) throw error;

        let totalGross = 0;
        let totalFee = 0;
        let totalExchange = 0;
        let totalNet = 0;
        let validCount = 0;

        const dailyIncome: Record<string, number> = {};

        bookings?.forEach((b: any) => {
          // [H-1] Skip cancelled bookings with no payout
          if (b.status === 'cancelled' && (!b.host_payout_amount || b.host_payout_amount <= 0)) {
            return;
          }

          const dateStr = b.created_at.split('T')[0];
          let itemGross = 0;
          let itemFee = 0;
          let itemExchange = 0;
          let itemNet = 0;

          if (b.status === 'cancelled') {
            // For cancelled bookings with payout, the payout is the final net amount.
            // We treat it as 0 fees for display since they were deducted at source (backend).
            itemNet = b.host_payout_amount || 0;
            itemGross = b.host_payout_amount || 0; // Effective gross for host
            itemFee = 0;
            itemExchange = 0;
          } else {
            // 정상 완료 건: 결제액의 80%를 호스트에게 지급 (관리자 정산 장부 로직과 완전히 동일)
            itemGross = b.total_price || 0;
            itemNet = Math.floor(itemGross * 0.8);
            itemFee = Math.floor(itemGross * 0.2); // 플랫폼 수익 (수수료)
            itemExchange = 0; // 결제망 수수료는 호스트 정산금에 포함시키지 않음(플랫폼에서 부담 또는 위약금에서 제외)
          }

          totalGross += itemGross;
          totalFee += itemFee;
          totalExchange += itemExchange;
          totalNet += itemNet;
          validCount++;

          if (dailyIncome[dateStr]) {
            dailyIncome[dateStr] += itemNet;
          } else {
            dailyIncome[dateStr] = itemNet;
          }
        });

        // 차트 데이터 생성
        const chart = [];
        const today = new Date();

        for (let i = -7; i <= 4; i++) {
          const d = new Date();
          d.setDate(today.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const dayLabel = String(d.getDate());

          chart.push({
            date: dateStr,
            amount: dailyIncome[dateStr] || 0,
            label: dayLabel,
            isToday: i === 0
          });
        }

        setStats({
          gross: totalGross,
          fee: totalFee,
          exchangeFee: totalExchange,
          net: totalNet,
          count: validCount // ✅ [복구] 건수 저장
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
      <div className="flex items-center justify-between mb-8 px-2 relative z-50">
        <h2 className="text-2xl font-bold text-slate-900">호스팅 수입</h2>
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
                onClick={() => router.push('/help')}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-3 border-b border-slate-50"
              >
                <BookOpen size={16} className="text-slate-400" /> 호스트 가이드북
              </button>
              <button
                onClick={() => router.push('/host/dashboard?tab=profile')}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-3"
              >
                <CreditCard size={16} className="text-slate-400" /> 정산 계좌 관리
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 메인 카드 */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden">

        <div className="text-center mb-10 relative z-10">
          <p className="text-slate-400 font-bold text-xs mb-2 flex items-center justify-center gap-1 uppercase tracking-wider">
            정산 예정 금액 <Info size={12} />
          </p>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-2">
            ₩{stats.net.toLocaleString()}
          </h1>

          {/* ✅ [추가] 예약 건수 뱃지 (이게 빠져있었습니다!) */}
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
            총 {stats.count}건의 예약 완료
          </div>
        </div>

        <div className="h-48 flex items-end justify-between gap-2 md:gap-4 relative z-10">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 z-0">
            <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
            <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
            <div className="border-t border-slate-900 border-dashed w-full h-px"></div>
          </div>

          {chartData.map((d, i) => {
            const heightPercent = (d.amount / maxAmount) * 100;
            const barHeight = Math.max(heightPercent, 4);

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer relative z-10">
                {/* ✅ [수정] 툴팁에 날짜 표시 추가 */}
                <div className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-slate-900 text-white text-[10px] px-2 py-1.5 rounded transition-opacity whitespace-nowrap z-20 shadow-md text-center">
                  <div className="font-bold mb-0.5 text-slate-300">{d.date}</div>
                  <div className="font-bold">₩{d.amount.toLocaleString()}</div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>

                <div
                  className={`w-full max-w-[20px] rounded-t-lg transition-all duration-500 ease-out relative 
                        ${d.isToday ? 'bg-slate-900' : 'bg-slate-200 group-hover:bg-slate-300'}`}
                  style={{ height: `${barHeight}%` }}
                >
                  {d.isToday && (
                    <div className="absolute -top-1 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></div>
                  )}
                </div>

                <span className={`text-[10px] font-bold ${d.isToday ? 'text-slate-900' : 'text-slate-400'}`}>
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 하단 요약 */}
      <div className="mt-6">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="w-full bg-white hover:bg-slate-50 transition-colors py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 shadow-sm"
        >
          {showSummary ? '요약 접기' : '수입 상세 내역 보기'}
          {showSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSummary && (
          <div className="mt-4 bg-slate-50 rounded-3xl p-6 md:p-8 animate-in slide-in-from-top-4 duration-300 fade-in border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800">정산 상세 내역</h3>
              <span className="text-[10px] font-bold bg-white border px-2 py-1 rounded text-slate-400 uppercase tracking-wide">
                Year to Date
              </span>
            </div>

            <div className="space-y-4">
              {/* ✅ [추가] 여기에도 건수 표시 */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">총 예약 건수</span>
                <span className="font-bold text-slate-900">{stats.count}건</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">총 매출 (게스트 결제액)</span>
                <span className="font-bold text-slate-900">₩{stats.gross.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">서비스 수수료 (20%)</span>
                <span className="font-bold text-rose-500">- ₩{stats.fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">결제망 이용료 (3%)</span>
                <span className="font-bold text-rose-500">- ₩{stats.exchangeFee.toLocaleString()}</span>
              </div>

              <div className="border-t border-slate-200 border-dashed my-4"></div>

              <div className="flex justify-between items-center">
                <span className="font-black text-base text-slate-900">최종 지급액 (Net)</span>
                <span className="font-black text-2xl text-slate-900">₩{stats.net.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-slate-400 text-right mt-1">* 세금 처리는 호스트 본인의 책임입니다.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}