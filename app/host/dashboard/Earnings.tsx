'use client';

import React, { useEffect, useState } from 'react';
import { PieChart, TrendingUp, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Skeleton from '@/app/components/ui/Skeleton';

export default function Earnings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    gross: 0,   // 총 매출 (호스트 설정 가격 기준)
    fee: 0,     // 호스트 부담 수수료 (20%)
    net: 0,     // 최종 정산 예정액 (80%)
    count: 0    // 유효 예약 수
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1. total_price(호스트 설정 가격)를 가져옵니다. (amount는 게스트 수수료 포함 금액이므로 사용 X)
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select(`
            total_price,
            status,
            experiences!inner ( host_id )
          `)
          .eq('experiences.host_id', user.id)
          .neq('status', 'cancelled') 
          .neq('status', 'declined');

        if (error) throw error;
        
        let grossRevenue = 0;
        let validCount = 0;

        bookings?.forEach((b: any) => {
          // total_price가 없으면 amount를 대신 쓰도록 폴백 처리 (기존 데이터 호환)
          const price = b.total_price || 0; 
          grossRevenue += price;
          validCount++;
        });

        setStats({
          gross: grossRevenue,
          fee: grossRevenue * 0.2, // 호스트 수수료 20%
          net: grossRevenue * 0.8, // 정산액 80%
          count: validCount
        });

      } catch (err) {
        console.error('수익 데이터 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Skeleton className="w-full h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-slate-100 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={16}/></div>
            <p className="text-slate-500 text-xs font-bold">총 매출 (Gross Revenue)</p>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900">₩{stats.gross.toLocaleString()}</h3>
          <p className="text-xs text-slate-400 mt-1">총 {stats.count}건의 유효 예약</p>
        </div>

        <div className="p-6 border border-slate-100 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle size={16}/></div>
            <p className="text-slate-500 text-xs font-bold">호스트 수수료 (20%)</p>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-rose-500">- ₩{stats.fee.toLocaleString()}</h3>
          <p className="text-xs text-slate-400 mt-1">플랫폼 이용료</p>
        </div>

        <div className="p-6 border border-slate-900 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-200">
          <p className="text-slate-400 text-xs font-bold mb-2">정산 예정 금액 (Net Payout)</p>
          <h3 className="text-3xl md:text-4xl font-black text-white">₩{stats.net.toLocaleString()}</h3>
          <p className="text-xs text-slate-500 mt-1">매월 10일 정산됩니다.</p>
        </div>
      </div>

      {stats.count === 0 ? (
        <div className="p-12 border border-slate-100 rounded-2xl bg-slate-50/50 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
            <PieChart className="text-slate-300" size={32}/>
          </div>
          <h4 className="text-slate-900 font-bold mb-1">아직 수익 내역이 없습니다.</h4>
          <p className="text-slate-500 text-sm">첫 예약을 받고 수익을 창출해보세요!</p>
        </div>
      ) : (
        <div className="p-8 border border-slate-100 rounded-2xl bg-white">
          <h4 className="font-bold text-lg mb-4">정산 상세 내역</h4>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">항목</th>
                  <th className="px-4 py-3 text-right">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3">총 체험 판매액</td>
                  <td className="px-4 py-3 text-right font-bold">₩{stats.gross.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-rose-500">호스트 수수료 (20%)</td>
                  <td className="px-4 py-3 text-right text-rose-500">- ₩{stats.fee.toLocaleString()}</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-3 font-bold text-slate-900">최종 지급액</td>
                  <td className="px-4 py-3 text-right font-black text-blue-600">₩{stats.net.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}