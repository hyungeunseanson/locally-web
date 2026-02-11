'use client';

import React, { useState } from 'react';
import { DollarSign, TrendingUp, CreditCard, Wallet, Calendar, Download, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SalesTab({ bookings, apps }: { bookings: any[], apps: any[] }) {
  const [dateFilter, setDateFilter] = useState('30D');
  const [settlementTab, setSettlementTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');

  // 기간 필터링 로직
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

  const filteredBookings = bookings.filter(b => filterDate(b.created_at) && b.status !== 'cancelled');
  
  // 핵심 지표 계산
  const totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
// 🟢 [수수료 정책 반영] 
  // 전체 매출의 20%를 플랫폼 수익으로 잡음 (고객 수수료 포함된 전체 파이에서 20%)
  const platformFee = totalRevenue * 0.20; 
  const hostPayout = totalRevenue - platformFee; // 나머지 80%는 호스트 몫
  const averageOrderValue = filteredBookings.length > 0 ? totalRevenue / filteredBookings.length : 0;

// 3. 🟢 [핵심] 정산 예정 내역 자동 계산 (Host Grouping Logic)
const calculateSettlements = () => {
  const settlementMap = new Map();

  // '이용 완료(completed)'된 예약만 정산 대상으로 잡음
  const completedBookings = bookings.filter(b => b.status === 'completed');

  completedBookings.forEach(booking => {
    const hostId = booking.experiences?.host_id;
    if (!hostId) return;

    if (!settlementMap.has(hostId)) {
      // 호스트 정보(계좌 등) 매칭
      const hostInfo = apps.find(a => a.user_id === hostId);
      
      settlementMap.set(hostId, {
        id: hostId,
        hostName: hostInfo?.name || '알 수 없음',
        // 계좌 정보가 없으면 '미등록' 표시
        bank: hostInfo?.bank_name ? `${hostInfo.bank_name} ${hostInfo.account_number}` : '계좌 미등록',
        accountHolder: hostInfo?.account_holder || '-',
        totalAmount: 0,
        count: 0,
        status: 'pending', // 아직 정산 테이블이 없으므로 기본 '대기' 상태
        lastDate: booking.date
      });
    }

    const current = settlementMap.get(hostId);
    // 호스트에게 줄 돈 = 결제금액의 80% (플랫폼 수수료 20% 제외)
    current.totalAmount += (booking.total_price || 0) * 0.8; 
    current.count += 1;
  });

  return Array.from(settlementMap.values());
};

const settlementList = calculateSettlements();

  return (
    <div className="flex-1 space-y-8 overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-300">
      
      {/* 1. 매출 대시보드 헤더 */}
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

      {/* 2. 핵심 재무 지표 (KPI) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="총 거래액 (GMV)" 
          value={`₩${totalRevenue.toLocaleString()}`} 
          sub={`지난 ${dateFilter} 동안`} 
          icon={<DollarSign size={20} className="text-white"/>} 
          bg="bg-slate-900" 
        />
        <StatCard 
          title="순매출 (Net Revenue)" 
          value={`₩${platformFee.toLocaleString()}`} 
          sub="플랫폼 수수료 (15%)" 
          icon={<TrendingUp size={20} className="text-white"/>} 
          bg="bg-blue-600" 
        />
        <StatCard 
          title="정산 예정금 (AP)" 
          value={`₩${hostPayout.toLocaleString()}`} 
          sub="호스트 지급액" 
          icon={<CreditCard size={20} className="text-white"/>} 
          bg="bg-purple-600" 
        />
        <StatCard 
          title="객단가 (AOV)" 
          value={`₩${Math.round(averageOrderValue).toLocaleString()}`} 
          sub="예약 1건당 평균" 
          icon={<Wallet size={20} className="text-slate-900"/>} 
          bg="bg-yellow-400" 
          text="text-slate-900"
        />
      </div>

      {/* 3. 호스트 정산 관리 시스템 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex gap-6">
            <button onClick={()=>setSettlementTab('PENDING')} className={`font-bold text-sm pb-0 border-b-2 transition-all ${settlementTab==='PENDING' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>정산 대기 (Next Payout)</button>
            <button onClick={()=>setSettlementTab('COMPLETED')} className={`font-bold text-sm pb-0 border-b-2 transition-all ${settlementTab==='COMPLETED' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>정산 완료 (History)</button>
          </div>
          {settlementTab === 'PENDING' && (
            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
              <CheckCircle size={14}/> 3월 정산 일괄 실행
            </button>
          )}
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-500 text-xs uppercase border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">호스트 정보</th>
              <th className="px-6 py-4">정산 금액</th>
              <th className="px-6 py-4">입금 계좌</th>
              <th className="px-6 py-4">지급 예정일</th>
              <th className="px-6 py-4 text-right">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {settlementList.length > 0 ? settlementList.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  {/* hostName과 accountHolder 사용 */}
                  <div className="font-bold text-slate-900">{item.hostName}</div>
                  <div className="text-xs text-slate-400">{item.accountHolder}</div>
                </td>
                {/* totalAmount 사용 */}
                <td className="px-6 py-4 font-mono font-bold text-purple-600">₩{item.totalAmount.toLocaleString()}</td>
                <td className="px-6 py-4 text-slate-500 flex items-center gap-1">
                  {/* 계좌 미등록 시 빨간 아이콘 */}
                  {item.bank === '계좌 미등록' ? <AlertTriangle size={14} className="text-red-500"/> : <CreditCard size={14}/>} 
                  {item.bank}
                </td>
                <td className="px-6 py-4 text-slate-500">{item.count}건</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${item.bank === '계좌 미등록' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                    {item.bank === '계좌 미등록' ? '계좌 필요' : '대기중'}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">정산할 내역이 없습니다. (완료된 예약이 없음)</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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