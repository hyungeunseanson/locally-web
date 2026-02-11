'use client';

import React, { useEffect, useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Info, TrendingUp } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Skeleton from '@/app/components/ui/Skeleton';

export default function Earnings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  
  // 데이터 상태
  const [stats, setStats] = useState({
    gross: 0,   // 총 매출
    fee: 0,     // 수수료
    net: 0,     // 정산 예정액 (주인공)
    count: 0
  });

  // 차트 데이터 (최근 14일 or 이번달)
  const [chartData, setChartData] = useState<{date: string, amount: number, label: string}[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1. 예약 데이터 가져오기
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select(`
            total_price,
            date,
            status,
            experiences!inner ( host_id )
          `)
          .eq('experiences.host_id', user.id)
          .neq('status', 'cancelled') 
          .neq('status', 'declined')
          .neq('status', 'cancellation_requested'); // 취소 요청 중인 것도 일단 제외

        if (error) throw error;
        
        let grossRevenue = 0;
        let validCount = 0;
        const dailyIncome: Record<string, number> = {};

        // 오늘 날짜 기준 최근 7일 ~ 미래 7일 (또는 이번달) 데이터 생성용
        const today = new Date();
        
        bookings?.forEach((b: any) => {
          const price = b.total_price || 0; 
          grossRevenue += price;
          validCount++;

          // 차트용 일별 데이터 집계
          if (dailyIncome[b.date]) {
            dailyIncome[b.date] += price * 0.8; // 순수익 기준으로 차트 표시
          } else {
            dailyIncome[b.date] = price * 0.8;
          }
        });

        // 차트 데이터 포맷팅 (최근 7일 + 미래 5일 = 12개 막대 정도)
        const chart = [];
        for (let i = -7; i <= 4; i++) {
          const d = new Date();
          d.setDate(today.getDate() + i);
          const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
          const dayLabel = d.getDate().toString(); // 12, 13, 14...
          
          chart.push({
            date: dateStr,
            amount: dailyIncome[dateStr] || 0,
            label: dayLabel,
            isToday: i === 0
          });
        }

        setStats({
          gross: grossRevenue,
          fee: grossRevenue * 0.2, // 20%
          net: grossRevenue * 0.8, // 80% (내가 받을 돈)
          count: validCount
        });

        setChartData(chart);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Skeleton className="w-full h-[500px] rounded-3xl" />;

  // 차트의 최대값 계산 (그래프 높이 비율용)
  const maxAmount = Math.max(...chartData.map(d => d.amount), 10000); // 최소 10000원 기준

  return (
    <div className="max-w-md mx-auto md:max-w-none md:mx-0">
      
      {/* 🟢 1. 상단 헤더 영역 */}
      <div className="flex items-center justify-between mb-8 px-2">
        <h2 className="text-2xl font-bold text-slate-900">호스팅 수입</h2>
        <button className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
          <Settings size={20} />
        </button>
      </div>

      {/* 🟢 2. 메인 카드 (수입 & 차트) */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden">
        
        {/* 이번 달 수입 텍스트 */}
        <div className="text-center mb-8 relative z-10">
          <p className="text-slate-400 font-bold text-sm mb-2 flex items-center justify-center gap-1">
             이번 달 정산 예정 <Info size={14}/>
          </p>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">
            ₩{stats.net.toLocaleString()}
          </h1>
        </div>

        {/* 🟢 3. 커스텀 막대 그래프 */}
        <div className="h-48 flex items-end justify-between gap-2 md:gap-4 relative z-10 pt-4">
            {/* Y축 가이드라인 (배경) */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                <div className="border-t border-slate-900 w-full h-0"></div>
                <div className="border-t border-slate-900 w-full h-0"></div>
                <div className="border-t border-slate-900 w-full h-0"></div>
            </div>

            {chartData.map((d, i) => {
               const heightPercent = (d.amount / maxAmount) * 100; // 높이 % 계산
               return (
                 <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    {/* 툴팁 (금액) */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded transition-opacity whitespace-nowrap z-20">
                        ₩{d.amount.toLocaleString()}
                    </div>
                    
                    {/* 막대 바 */}
                    <div 
                      className={`w-full max-w-[20px] rounded-t-lg transition-all duration-500 ease-out relative ${d.isToday ? 'bg-slate-900' : 'bg-slate-200 group-hover:bg-slate-300'}`}
                      style={{ height: `${Math.max(heightPercent, 2)}%` }} // 최소 2% 높이 보장
                    >
                        {d.isToday && <div className="absolute -top-1 right-0 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></div>}
                    </div>
                    
                    {/* X축 날짜 */}
                    <span className={`text-[10px] font-bold ${d.isToday ? 'text-slate-900' : 'text-slate-400'}`}>
                        {d.label}
                    </span>
                 </div>
               )
            })}
        </div>
      </div>

      {/* 🟢 4. 하단 요약 토글 버튼 */}
      <div className="mt-6">
        <button 
          onClick={() => setShowSummary(!showSummary)}
          className="w-full bg-slate-50 hover:bg-slate-100 transition-colors py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-slate-600 group"
        >
          {showSummary ? '요약 접기' : '수입 요약 보기'}
          {showSummary ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>

        {/* 🟢 5. 상세 요약 내역 (슬라이드) */}
        {showSummary && (
          <div className="mt-4 bg-slate-50 rounded-3xl p-6 md:p-8 animate-in slide-in-from-top-4 duration-300 fade-in border border-slate-100">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800">올해 현재까지 요약</h3>
                <span className="text-xs font-bold bg-white border px-2 py-1 rounded text-slate-500">
                    2026.01.01 ~ 현재
                </span>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">총 수입 (게스트 결제액 기준)</span>
                    <span className="font-bold text-slate-900">₩{stats.gross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">로컬리 서비스 수수료 (20%)</span>
                    <span className="font-bold text-slate-400">- ₩{stats.fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">세금 원천징수 (3.3%)</span>
                    <span className="font-bold text-slate-400">₩0</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">환전 및 송금 수수료</span>
                    <span className="font-bold text-slate-400">₩0</span>
                </div>
                
                <div className="h-px bg-slate-200 my-4"></div>

                <div className="flex justify-between items-center">
                    <span className="font-black text-base text-slate-900">총 지급액 (KRW)</span>
                    <span className="font-black text-2xl text-slate-900">₩{stats.net.toLocaleString()}</span>
                </div>
             </div>
          </div>
        )}
      </div>

    </div>
  );
}