'use client';

import React, { useState } from 'react';
import { 
  Download, Search, Calendar, User, 
  ArrowRight, CreditCard, Wallet, TrendingUp, AlertCircle, X,
  CheckCircle2, XCircle, Copy, Phone, Mail, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import Image from 'next/image';

export default function MasterLedgerTab({ bookings, onRefresh }: { bookings: any[], onRefresh: () => void }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // 초기값 비움 = 전체 기간
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'CANCELLED'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. 장부 데이터 필터링
  const ledgerData = bookings.filter(b => {
    // 날짜 필터 (값이 있을 때만 적용)
    const dateMatch = !monthFilter || b.date?.startsWith(monthFilter);
    
    // 검색어 매칭
    const searchString = `${b.experiences?.profiles?.name} ${b.experiences?.title} ${b.contact_name} ${b.id} ${b.profiles?.email}`.toLowerCase();
    const searchMatch = searchString.includes(searchTerm.toLowerCase());

    // 상태 필터링
    const status = b.status;
    let statusMatch = false;

    if (statusFilter === 'ALL') {
      // 전체 보기: 입금대기, 결제완료, 취소됨 모두 포함
      statusMatch = ['PENDING', 'PAID', 'confirmed', 'completed', 'cancelled', 'declined', 'cancellation_requested'].includes(status);
    } else if (statusFilter === 'PAID') {
      statusMatch = ['PAID', 'confirmed', 'completed'].includes(status);
    } else if (statusFilter === 'PENDING') {
      statusMatch = status === 'PENDING';
    } else if (statusFilter === 'CANCELLED') {
      statusMatch = ['cancelled', 'declined', 'cancellation_requested'].includes(status);
    }

    return dateMatch && searchMatch && statusMatch;
  });

  // 2. 통합 합계 계산 (KPI) - 취소된 건은 제외
  const totals = ledgerData.reduce((acc, curr) => {
    if (['cancelled', 'declined', 'cancellation_requested'].includes(curr.status)) return acc;
    
    acc.totalSales += Number(curr.amount || 0); 
    acc.totalBasePrice += Number(curr.total_experience_price || 0); 
    acc.totalPayout += Number(curr.host_payout_amount || (curr.total_experience_price * 0.8)); 
    acc.totalProfit += Number(curr.platform_revenue || (curr.amount - (curr.total_experience_price * 0.8))); 
    return acc;
  }, { totalSales: 0, totalBasePrice: 0, totalPayout: 0, totalProfit: 0 });

  // 3. 엑셀 CSV 다운로드
  const downloadLedgerCSV = () => {
    const headers = ['Date', 'Booking ID', 'Partner', 'Tour', 'Customer', 'Status', 'Base Price', 'Total Price', 'Payout(80%)', 'Sales(Paid)', 'Revenue'];
    const rows = ledgerData.map(b => [
      b.date,
      b.id,
      b.experiences?.profiles?.name || 'Unknown',
      `"${b.experiences?.title}"`,
      `"${b.contact_name}(${b.guests}인)"`,
      b.status,
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
    link.download = `locally_ledger_${monthFilter || 'ALL'}.csv`;
    link.click();
    showToast('장부가 CSV로 다운로드되었습니다.', 'success');
  };

  const handleConfirmPayment = async (bookingId: number) => {
    if (!confirm('입금이 확인되었습니까? 예약을 확정합니다.')) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/bookings/confirm-payment', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      if (!res.ok) throw new Error('처리 실패');
      showToast('입금 확인 완료!', 'success');
      onRefresh();
      setSelectedBooking(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally { setIsProcessing(false); }
  };

  const handleForceCancel = async (bookingId: string) => {
    if (!confirm('⚠️ 정말로 강제 취소(전액 환불)하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: '관리자 직권 취소', isHostCancel: true }),
      });
      if (!res.ok) throw new Error('취소 실패');
      showToast('취소 처리되었습니다.', 'success');
      onRefresh();
      setSelectedBooking(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally { setIsProcessing(false); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('복사되었습니다.', 'success');
  };

  const renderStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (['paid', 'confirmed', 'completed'].includes(s)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">확정</span>;
    if (s === 'pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 animate-pulse">입금 대기</span>;
    if (['cancelled', 'declined', 'cancellation_requested'].includes(s)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">취소됨</span>;
    return <span className="text-xs text-slate-500">{status}</span>;
  };

  return (
    <div className="flex h-full gap-6 relative">
      <div className={`flex-1 flex flex-col space-y-6 transition-all duration-300 ${selectedBooking ? 'w-2/3' : 'w-full'}`}>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-lg shadow-slate-200">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales</div>
            <div className="text-2xl font-black">₩{totals.totalSales.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 mt-1">실결제 매출</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payout (80%)</div>
            <div className="text-2xl font-black text-rose-600">₩{totals.totalPayout.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-1">지급 예정액</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue</div>
            <div className="text-2xl font-black text-blue-600">₩{totals.totalProfit.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-1">순수익</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bookings</div>
            <div className="text-2xl font-black text-slate-900">{ledgerData.length}건</div>
            <div className="text-[10px] text-slate-400 mt-1">{monthFilter || '전체 기간'}</div>
          </div>
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <div className="flex gap-4 items-center">
            <input 
              type="month" 
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-rose-500/20"
            />
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: '전체' },
                { id: 'PENDING', label: '입금대기' },
                { id: 'PAID', label: '확정됨' },
                { id: 'CANCELLED', label: '취소됨' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input 
                type="text" 
                placeholder="장부 검색 (이름, 예약번호)" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
              />
            </div>
            <button 
              onClick={downloadLedgerCSV}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
            >
              <Download size={18}/>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-y-auto flex-1 scrollbar-hide">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-4 w-24">Status</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Partner</th>
                  <th className="px-4 py-4">Tour Item</th>
                  <th className="px-4 py-4 text-center">Customer</th>
                  <th className="px-4 py-4 text-right">Price</th>
                  <th className="px-4 py-4 text-right">Payout(80%)</th>
                  <th className="px-4 py-4 text-right text-slate-900 bg-slate-100/50">매출(Paid)</th>
                  <th className="px-4 py-4 text-right text-blue-600">수익</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ledgerData.length === 0 ? (
                  <tr><td colSpan={9} className="py-32 text-center text-slate-400">데이터가 없습니다.</td></tr>
                ) : (
                  ledgerData.map((b) => (
                    <tr 
                      key={b.id} 
                      onClick={() => setSelectedBooking(b)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedBooking?.id === b.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-4 py-4">{renderStatusBadge(b.status)}</td>
                      <td className="px-4 py-4 font-mono text-slate-500">{b.date?.slice(5)}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{b.experiences?.profiles?.name || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="max-w-[150px] truncate font-medium text-slate-700" title={b.experiences?.title}>
                          {b.experiences?.title}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-600">
                        {b.contact_name}({b.guests})
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-400">
                        {Number(b.price_at_booking).toLocaleString()}
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
        </div>
      </div>

      {selectedBooking && (
        <div className="w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-300 absolute right-0 top-0 bottom-0 z-20">
           <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1">Booking Detail</div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedBooking.experiences?.title}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                      <Calendar size={14}/> {selectedBooking.date} {selectedBooking.time}
                  </div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-900"><X size={20}/></button>
           </div>

           <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <User size={16}/> 게스트 정보
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm border border-slate-100">
                      <div className="flex justify-between items-center">
                          <span className="text-slate-500">이름</span>
                          <span className="font-medium text-slate-900 flex items-center gap-2">
                              {selectedBooking.contact_name}
                              <Copy size={12} className="text-slate-300 cursor-pointer hover:text-black" onClick={() => handleCopy(selectedBooking.contact_name)}/>
                          </span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-500">연락처</span>
                          <span className="font-medium text-slate-900 flex items-center gap-2">
                              {selectedBooking.contact_phone}
                              <Phone size={12} className="text-slate-300 cursor-pointer hover:text-black" onClick={() => handleCopy(selectedBooking.contact_phone)}/>
                          </span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-500">이메일</span>
                          <span className="font-medium text-slate-900 flex items-center gap-2">
                              {selectedBooking.profiles?.email}
                              <Mail size={12} className="text-slate-300 cursor-pointer hover:text-black" onClick={() => handleCopy(selectedBooking.profiles?.email)}/>
                          </span>
                      </div>
                  </div>
              </div>

              <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard size={16}/> 결제 및 정산
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-100">
                          <span className="text-sm text-slate-600">결제 금액</span>
                          <span className="text-lg font-black text-slate-900">₩{Number(selectedBooking.amount).toLocaleString()}</span>
                      </div>
                      <div className="p-4 bg-white space-y-2 text-xs">
                          <div className="flex justify-between text-slate-500">
                              <span>결제 수단</span>
                              <span className={`font-bold ${selectedBooking.payment_method === 'bank' ? 'text-blue-600' : 'text-slate-700'}`}>
                                {selectedBooking.payment_method === 'bank' ? '무통장 입금' : '카드 결제'}
                              </span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                              <span>주문 번호</span>
                              <span className="font-mono text-[10px]">{selectedBooking.order_id || selectedBooking.id}</span>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-orange-500"/> 관리자 액션
                  </h4>
                  
                  {selectedBooking.status === 'PENDING' && (
                    <button 
                      onClick={() => handleConfirmPayment(selectedBooking.id)}
                      disabled={isProcessing}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-200"
                    >
                      {isProcessing ? '처리 중...' : '💰 입금 확인 (예약 확정)'}
                    </button>
                  )}

                  {['confirmed', 'paid', 'completed'].includes(selectedBooking.status.toLowerCase()) && (
                    <button 
                      onClick={() => handleForceCancel(selectedBooking.id)}
                      disabled={isProcessing}
                      className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors border border-red-100"
                    >
                      {isProcessing ? '처리 중...' : '예약 강제 취소 (전액 환불)'}
                    </button>
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
