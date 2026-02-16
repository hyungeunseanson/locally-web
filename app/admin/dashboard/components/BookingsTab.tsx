'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Search, Copy, Download, 
  TrendingUp, CreditCard, Phone, Mail, User, Code, AlertTriangle, MoreHorizontal 
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';

export default function BookingsTab({ bookings, onRefresh }: { bookings: any[], onRefresh?: () => void }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'UPCOMING' | 'PAST' | 'CANCELLED'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🟢 [복구] 1. 통계 계산 로직 (GMV, Payout, Net Revenue)
  const validBookings = bookings.filter(b => ['confirmed', 'PAID', 'completed', 'cancelled'].includes(b.status));
  
  const stats = validBookings.reduce((acc, b) => {
    const amount = Number(b.amount || 0);
    const payout = Number(b.host_payout_amount ?? (amount * 0.8));
    const revenue = Number(b.platform_revenue ?? (amount * 0.2));

    if (b.status !== 'cancelled') {
      acc.gmv += amount;
      acc.netRevenue += revenue;
      acc.payout += payout;
    } else {
      // 취소 건은 위약금 수익만 반영
      acc.netRevenue += Number(b.platform_revenue || 0);
    }
    return acc;
  }, { gmv: 0, netRevenue: 0, payout: 0 });

  // 🟢 [복구] 2. CSV 다운로드 기능
  const downloadCSV = () => {
    const headers = ['ID', 'Date', 'Guest', 'Experience', 'Amount', 'Status', 'Email'];
    const rows = filteredBookings.map(b => [
      b.id, b.date, b.contact_name, b.experiences?.title, b.amount, b.status, b.profiles?.email
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  // 🟢 [복구] 3. 이메일 포함 검색 및 필터링
  const filteredBookings = bookings.filter(b => {
    const searchString = `${b.contact_name} ${b.contact_phone} ${b.experiences?.title} ${b.id} ${b.profiles?.email || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const status = b.status?.toUpperCase();
    const isUpcoming = new Date(`${b.date} ${b.time}`) >= new Date();

    if (filterType === 'CANCELLED') return matchesSearch && (status === 'CANCELLED' || status === 'CANCELLATION_REQUESTED');
    if (filterType === 'UPCOMING') return matchesSearch && isUpcoming && status !== 'CANCELLED';
    if (filterType === 'PAST') return matchesSearch && !isUpcoming && status !== 'CANCELLED';
    return matchesSearch;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('복사되었습니다.', 'success');
  };

  const handleForceCancel = async () => {
    if (!selectedBooking) return;
    if (!confirm('경고: 관리자 권한으로 강제 취소(전액 환불)를 진행하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id, reason: '관리자 직권 취소', isHostCancel: true }),
      });
      if (!res.ok) throw new Error('취소 실패');
      showToast('성공적으로 처리되었습니다.', 'success');
      setSelectedBooking(null);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        
        {/* 🟢 [복구] 상단 통계 카드 섹션 */}
        <div className="grid grid-cols-3 gap-4 shrink-0">
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total GMV (누적 거래액)</div>
              <div className="text-2xl font-black text-slate-900">₩{stats.gmv.toLocaleString()}</div>
           </div>
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Net Revenue (플랫폼 수익)</div>
              <div className="text-2xl font-black text-blue-600">₩{stats.netRevenue.toLocaleString()}</div>
           </div>
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Payout (호스트 지급액)</div>
              <div className="text-2xl font-black text-emerald-600">₩{stats.payout.toLocaleString()}</div>
           </div>
        </div>

        {/* 리스트 컨트롤 (검색 + 다운로드) */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shrink-0">
          <div className="flex gap-2">
            {['ALL', 'UPCOMING', 'PAST', 'CANCELLED'].map((t) => (
              <button key={t} onClick={() => setFilterType(t as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
              <input type="text" placeholder="검색 (이름, 이메일, 체험명...)" className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 ring-blue-500 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
            <button onClick={downloadCSV} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors border border-slate-200" title="Excel 다운로드">
              <Download size={18}/>
            </button>
          </div>
        </div>

        {/* 테이블 리스트 영역 */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-y-auto h-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Booking / Date</th>
                  <th className="px-6 py-3">Guest</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredBookings.map((bk) => (
                  <tr key={bk.id} onClick={() => setSelectedBooking(bk)} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${selectedBooking?.id === bk.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm line-clamp-1">{bk.experiences?.title}</div>
                      <div className="text-[10px] text-slate-400">{bk.date} {bk.time}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-medium text-slate-700">{bk.contact_name}</div>
                       <div className="text-[10px] text-slate-400 font-mono">{bk.profiles?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bk.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>{bk.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">₩{Number(bk.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 오른쪽 상세 패널 (이전 답변의 복구된 코드 그대로 유지) */}
      {selectedBooking && (
        <div className="w-[450px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-300 relative z-20">
           {/* ... (이전 상세 정보 카드 로직들: Name, Phone, Email 카드 및 복사버튼 등) ... */}
        </div>
      )}
    </div>
  );
}