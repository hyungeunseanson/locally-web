'use client';

import React, { useState } from 'react';
import { 
  Download, Search, Calendar, User, 
  ArrowRight, CreditCard, Wallet, TrendingUp, AlertCircle
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';

export default function MasterLedgerTab({ bookings, onRefresh }: { bookings: any[], onRefresh: () => void }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // 1. 장부 데이터 필터링 (결제 완료 이상 건만 대상)
  const ledgerData = bookings.filter(b => {
    const isPaid = ['PAID', 'confirmed', 'completed'].includes(b.status);
    const dateMatch = b.date?.startsWith(monthFilter);
    const searchString = `${b.experiences?.profiles?.name} ${b.experiences?.title} ${b.contact_name} ${b.id}`.toLowerCase();
    const searchMatch = searchString.includes(searchTerm.toLowerCase());
    return isPaid && dateMatch && searchMatch;
  });

  // 2. 통합 합계 계산 (KPI)
  const totals = ledgerData.reduce((acc, curr) => {
    acc.totalSales += Number(curr.amount || 0); // 고객 실결제액 합계
    acc.totalBasePrice += Number(curr.total_experience_price || 0); // 호스트 원가 합계
    acc.totalPayout += Number(curr.host_payout_amount || (curr.total_experience_price * 0.8)); // 80% 정산금
    acc.totalProfit += Number(curr.platform_revenue || (curr.amount - (curr.total_experience_price * 0.8))); // 플랫폼 수익
    return acc;
  }, { totalSales: 0, totalBasePrice: 0, totalPayout: 0, totalProfit: 0 });

  // 3. 엑셀 CSV 다운로드 기능
  const downloadLedgerCSV = () => {
    const headers = ['Date', 'Partner', 'Tour', 'Customer', 'Base Price', 'Total Price', 'Payout(80%)', 'Sales(Paid)', 'Revenue'];
    const rows = ledgerData.map(b => [
      b.date,
      b.experiences?.profiles?.name || 'Unknown',
      `"${b.experiences?.title}"`,
      `"${b.contact_name}(${b.guests}인)"`,
      b.price_at_booking,
      b.total_experience_price,
      b.host_payout_amount,
      b.amount,
      b.platform_revenue
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `locally_master_ledger_${monthFilter}.csv`;
    link.click();
    showToast('장부가 CSV로 다운로드되었습니다.', 'success');
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      
      {/* KPI 대시보드 (엑셀 요약) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-lg shadow-slate-200">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales (매출)</div>
          <div className="text-2xl font-black">₩{totals.totalSales.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-1">고객 실결제 총액</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Payout (지급액)</div>
          <div className="text-2xl font-black text-rose-600">₩{totals.totalPayout.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">호스트 정산 총액 (80%)</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue (수익)</div>
          <div className="text-2xl font-black text-blue-600">₩{totals.totalProfit.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">플랫폼 순이익</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bookings (건수)</div>
          <div className="text-2xl font-black text-slate-900">{ledgerData.length}건</div>
          <div className="text-[10px] text-slate-400 mt-1">{monthFilter} 기준 내역</div>
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex gap-4 items-center">
          <input 
            type="month" 
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-rose-500/20"
          />
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input 
              type="text" 
              placeholder="파트너, 예약자, 체험명 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
            />
          </div>
        </div>
        <button 
          onClick={downloadLedgerCSV}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
        >
          <Download size={18}/> 엑셀(CSV) 내보내기
        </button>
      </div>

      {/* 마스터 장부 테이블 */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1 scrollbar-hide">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Partner</th>
                <th className="px-4 py-4">Tour Item</th>
                <th className="px-4 py-4 text-center">Customer</th>
                <th className="px-4 py-4 text-right">Price</th>
                <th className="px-4 py-4 text-right">Total Price</th>
                <th className="px-4 py-4 text-right text-rose-600 bg-rose-50/30">To Partner(80%)</th>
                <th className="px-4 py-4 text-right text-slate-900 bg-slate-100/50">매출(Paid)</th>
                <th className="px-4 py-4 text-right text-blue-600">수익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ledgerData.length === 0 ? (
                <tr><td colSpan={9} className="py-32 text-center text-slate-400">선택한 기간에 완료된 예약이 없습니다.</td></tr>
              ) : (
                ledgerData.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4 font-mono text-slate-500">{b.date?.slice(5)}</td>
                    <td className="px-4 py-4 font-bold text-slate-900">{b.experiences?.profiles?.name || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="max-w-[180px] truncate font-medium text-slate-700" title={b.experiences?.title}>
                        {b.experiences?.title}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600">
                      {b.contact_name}({b.guests}인)
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-slate-400">
                      {Number(b.price_at_booking).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-slate-900 font-bold">
                      {Number(b.total_experience_price).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-black text-rose-600 bg-rose-50/30">
                      {Number(b.host_payout_amount || (b.total_experience_price * 0.8)).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900 bg-slate-100/50">
                      {Number(b.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-black text-blue-600">
                      {Number(b.platform_revenue || (b.amount - (b.total_experience_price * 0.8))).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* 장부 푸터 요약 */}
        <div className="bg-slate-900 p-4 flex justify-end gap-12 text-white border-t border-slate-800">
           <div className="flex gap-3 items-center">
             <span className="text-[10px] font-black text-slate-400 uppercase">Grand Total Payout</span>
             <span className="text-lg font-black text-rose-400">₩{totals.totalPayout.toLocaleString()}</span>
           </div>
           <div className="flex gap-3 items-center">
             <span className="text-[10px] font-black text-slate-400 uppercase">Grand Total Profit</span>
             <span className="text-lg font-black text-blue-400">₩{totals.totalProfit.toLocaleString()}</span>
           </div>
        </div>
      </div>
    </div>
  );
}
