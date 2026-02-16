'use client';

import React, { useState } from 'react';
import { DollarSign, TrendingUp, CreditCard, Wallet, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SalesTab({ bookings, apps }: { bookings: any[], apps: any[] }) {
  const [dateFilter, setDateFilter] = useState('30D');
  const [settlementTab, setSettlementTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');

  // 날짜 필터
  const filterDate = (date: string) => {
    const now = new Date();
    const target = new Date(date);
    const diffDays = (now.getTime() - target.getTime()) / (1000 * 3600 * 24);
    if (dateFilter === '1D') return diffDays <= 1;
    if (dateFilter === '7D') return diffDays <= 7;
    if (dateFilter === '30D') return diffDays <= 30;
    if (dateFilter === '3M') return diffDays <= 90;
    if (dateFilter === '1Y') return diffDays <= 365;
    return true;
  };

  // 🟢 [수정] 유효한 매출 데이터 필터링 (완료됨 + 취소됐는데 위약금 있는거)
  const validBookings = bookings.filter(b => 
    filterDate(b.created_at) && 
    (b.status === 'completed' || (b.status === 'cancelled' && (b.platform_revenue > 0 || b.host_payout_amount > 0)))
  );
  
  // 🟢 [수정] 매출/수익 계산 (DB 컬럼 기반)
  const totalRevenue = validBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  
  // 플랫폼 수익: platform_revenue 컬럼이 있으면 쓰고, 없으면(옛날데이터) 대충 계산
  const platformFee = validBookings.reduce((sum, b) => {
     return sum + (b.platform_revenue || (b.amount - (b.host_payout_amount || (b.amount * 0.8)))); 
  }, 0);

  const hostPayout = validBookings.reduce((sum, b) => {
     return sum + (b.host_payout_amount || (b.amount * 0.8));
  }, 0);

  const averageOrderValue = validBookings.length > 0 ? totalRevenue / validBookings.length : 0;

  // 🟢 [핵심] 정산 예정 내역 계산 (위약금 포함)
  const calculateSettlements = () => {
    const settlementMap = new Map();

    // 정산 대상: 완료된 건 + 취소 위약금 건
    const targetBookings = bookings.filter(b => 
       b.status === 'completed' || (b.status === 'cancelled' && b.host_payout_amount > 0)
    );

    targetBookings.forEach(booking => {
      const hostId = booking.experiences?.host_id;
      if (!hostId) return;

      if (!settlementMap.has(hostId)) {
        const hostInfo = apps.find(a => a.user_id === hostId);
        settlementMap.set(hostId, {
          id: hostId,
          hostName: hostInfo?.name || '알 수 없음',
          bank: hostInfo?.bank_name ? `${hostInfo.bank_name} ${hostInfo.account_number}` : '계좌 미등록',
          accountHolder: hostInfo?.account_holder || '-',
          totalAmount: 0,
          count: 0,
          status: booking.payout_status || 'pending', 
        });
      }

      const current = settlementMap.get(hostId);
      
      // 🟢 [중요] 호스트 줄 돈 계산
      let payout = 0;
      if (booking.host_payout_amount > 0) {
          payout = booking.host_payout_amount; // 이미 계산된 값 사용 (위약금 포함)
      } else {
          payout = (booking.amount || 0) * 0.8; // 옛날 데이터용 (80%)
      }

      // 탭 구분에 따라 필터링 (지급완료된 건은 제외하거나 포함)
      if (settlementTab === 'PENDING' && booking.payout_status === 'paid') return;
      if (settlementTab === 'COMPLETED' && booking.payout_status !== 'paid') return;

      current.totalAmount += payout;
      current.count += 1;
    });

    return Array.from(settlementMap.values()).filter((i:any) => i.count > 0);
  };

  const settlementList = calculateSettlements();

  return (
    <div className="flex-1 space-y-8 overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-300">
      
      {/* 헤더 & 필터 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wallet className="text-yellow-500"/> 매출 및 재무 현황
          </h2>
          <p className="text-sm text-slate-500 mt-1">기간별 매출 추이와 호스트 정산 내역을 관리합니다.</p>
        </div>
        <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold">
          {['1D', '7D', '30D', '3M', '1Y', 'ALL'].map(f => (
            <button 
              key={f} onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-md transition-all ${dateFilter === f ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="총 거래액 (GMV)" value={`₩${totalRevenue.toLocaleString()}`} sub={`기간 내 총 결제`} icon={<DollarSign size={20} className="text-white"/>} bg="bg-slate-900" />
        <StatCard title="순매출 (Net Revenue)" value={`₩${platformFee.toLocaleString()}`} sub="플랫폼 수익 (수수료)" icon={<TrendingUp size={20} className="text-white"/>} bg="bg-blue-600" />
        <StatCard title="정산 예정금 (AP)" value={`₩${hostPayout.toLocaleString()}`} sub="호스트 지급액" icon={<CreditCard size={20} className="text-white"/>} bg="bg-purple-600" />
        <StatCard title="객단가 (AOV)" value={`₩${Math.round(averageOrderValue).toLocaleString()}`} sub="건당 평균 결제액" icon={<Wallet size={20} className="text-slate-900"/>} bg="bg-yellow-400" text="text-slate-900"/>
      </div>

      {/* 정산 리스트 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex gap-6">
            <button onClick={()=>setSettlementTab('PENDING')} className={`font-bold text-sm pb-0 border-b-2 transition-all ${settlementTab==='PENDING' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>정산 대기 (Pending)</button>
            <button onClick={()=>setSettlementTab('COMPLETED')} className={`font-bold text-sm pb-0 border-b-2 transition-all ${settlementTab==='COMPLETED' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>정산 완료 (History)</button>
          </div>
          {settlementTab === 'PENDING' && (
            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
              <CheckCircle size={14}/> 정산 탭에서 지급 실행
            </button>
          )}
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-500 text-xs uppercase border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">호스트 정보</th>
              <th className="px-6 py-4">지급 총액</th>
              <th className="px-6 py-4">계좌 정보</th>
              <th className="px-6 py-4">건수</th>
              <th className="px-6 py-4 text-right">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {settlementList.length > 0 ? settlementList.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{item.hostName}</div>
                  <div className="text-xs text-slate-400">{item.accountHolder}</div>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-purple-600">₩{item.totalAmount.toLocaleString()}</td>
                <td className="px-6 py-4 text-slate-500 flex items-center gap-1">
                  {item.bank === '계좌 미등록' ? <AlertTriangle size={14} className="text-red-500"/> : <CreditCard size={14}/>} 
                  {item.bank}
                </td>
                <td className="px-6 py-4 text-slate-500">{item.count}건</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${item.bank === '계좌 미등록' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                    {item.bank === '계좌 미등록' ? '계좌 필요' : (settlementTab === 'PENDING' ? '지급 대기' : '지급 완료')}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">내역이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// (StatCard 컴포넌트는 기존과 동일)
function StatCard({ title, value, sub, icon, bg, text = 'text-white' }: any) {
  return (
    <div className={`p-5 rounded-2xl shadow-sm border border-slate-100 bg-white flex flex-col justify-between h-32 relative overflow-hidden group`}>
      <div className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center ${bg} shadow-md group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</div>
      <div>
        <div className={`text-2xl font-black ${text === 'text-white' ? 'text-slate-900' : text} tracking-tight`}>{value}</div>
        <div className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</div>
      </div>
    </div>
  );
}