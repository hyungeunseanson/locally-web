'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Search, Copy, Download, 
  Calendar, CreditCard, Phone, Mail, User, AlertTriangle, X 
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';

export default function BookingsTab({ bookings, onRefresh }: { bookings: any[], onRefresh?: () => void }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'UPCOMING' | 'PAST' | 'CANCELLED'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. 통계 계산 로직 (GMV, Payout, Net Revenue)
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

  // 2. 필터링 로직
  const filteredBookings = bookings.filter(b => {
    const searchString = `${b.contact_name} ${b.contact_phone} ${b.experiences?.title} ${b.id} ${b.profiles?.email || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const status = b.status?.toUpperCase();
    const isUpcoming = new Date(`${b.date} ${b.time}`) >= new Date();

    if (!matchesSearch) return false;

    if (filterType === 'CANCELLED') return status === 'CANCELLED' || status === 'DECLINED' || status === 'CANCELLATION_REQUESTED';
    if (filterType === 'UPCOMING') return status !== 'CANCELLED' && isUpcoming;
    if (filterType === 'PAST') return status !== 'CANCELLED' && !isUpcoming;
    
    return true; // ALL
  });

  // 3. CSV 다운로드
  const downloadCSV = () => {
    const headers = ['Booking ID', 'Date', 'Time', 'Experience', 'Guest Name', 'Guest Email', 'Amount', 'Status', 'Payout Status'];
    const rows = filteredBookings.map(b => [
      b.id, b.date, b.time, `"${b.experiences?.title}"`, b.contact_name, b.profiles?.email, b.amount, b.status, b.payout_status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
    
    showToast('예약 내역이 다운로드되었습니다.', 'success');
  };

  // 4. 복사 기능
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('클립보드에 복사되었습니다.', 'success');
  };

  // 5. 관리자 강제 취소 (핵심 기능)
  const handleForceCancel = async () => {
    if (!selectedBooking) return;
    if (!confirm('⚠️ 경고: 관리자 권한으로 강제 취소(전액 환불)를 진행하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id, reason: '관리자 직권 취소', isHostCancel: true }),
      });
      if (!res.ok) throw new Error('취소 요청 실패');
      
      showToast('관리자 권한으로 취소 처리되었습니다.', 'success');
      setSelectedBooking(null);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally { 
      setIsProcessing(false); 
    }
  };

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* 상단 통계 카드 (복구됨) */}
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

        {/* 컨트롤 바 */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shrink-0">
          <div className="flex gap-2">
            {['ALL', 'UPCOMING', 'PAST', 'CANCELLED'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterType === type 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {type === 'ALL' ? '전체' : type === 'UPCOMING' ? '예정됨' : type === 'PAST' ? '완료됨' : '취소됨'}
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
              <input 
                type="text" 
                placeholder="예약자, 체험명, 이메일..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 ring-slate-900 w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={downloadCSV} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 border border-slate-200" title="Excel 다운로드">
              <Download size={18}/>
            </button>
          </div>
        </div>

        {/* 리스트 테이블 */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">체험 정보 / 일시</th>
                  <th className="px-6 py-3">게스트</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3 text-right">결제 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredBookings.map((bk) => (
                  <tr 
                    key={bk.id} 
                    onClick={() => setSelectedBooking(bk)} 
                    className={`cursor-pointer transition-colors group ${
                        selectedBooking?.id === bk.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm line-clamp-1 mb-1">{bk.experiences?.title}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar size={12}/> {bk.date} · {bk.time}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-medium text-slate-700 text-sm">{bk.contact_name}</div>
                       <div className="text-[10px] text-slate-400 font-mono">{bk.profiles?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                       <StatusBadge status={bk.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">₩{Number(bk.amount).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                            {bk.payout_status === 'paid' ? '정산 완료' : '정산 대기'}
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 text-center">
            총 {filteredBookings.length}건의 데이터
          </div>
        </div>
      </div>

      {/* 오른쪽 상세 패널 (완벽 구현) */}
      {selectedBooking && (
        <div className="w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-300 relative z-20 shrink-0">
           {/* 패널 헤더 */}
           <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                  <div className="text-xs font-bold text-slate-400 uppercase mb-1">Booking Details</div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedBooking.experiences?.title}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                      <Calendar size={14}/> {selectedBooking.date} {selectedBooking.time}
                  </div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-900"><X size={20}/></button>
           </div>

           {/* 패널 바디 */}
           <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* 게스트 정보 */}
              <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <User size={16}/> 게스트 정보
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm border border-slate-100">
                      <div className="flex justify-between items-center group">
                          <span className="text-slate-500">이름</span>
                          <span className="font-medium text-slate-900 flex items-center gap-2">
                              {selectedBooking.contact_name}
                              <Copy size={12} className="text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => handleCopy(selectedBooking.contact_name)}/>
                          </span>
                      </div>
                      <div className="flex justify-between items-center group">
                          <span className="text-slate-500">연락처</span>
                          <span className="font-medium text-slate-900 flex items-center gap-2">
                              {selectedBooking.contact_phone}
                              <Phone size={12} className="text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => handleCopy(selectedBooking.contact_phone)}/>
                          </span>
                      </div>
                      <div className="flex justify-between items-center group">
                          <span className="text-slate-500">이메일</span>
                          <span className="font-medium text-slate-900 flex items-center gap-2">
                              {selectedBooking.profiles?.email}
                              <Mail size={12} className="text-slate-300 cursor-pointer hover:text-slate-600" onClick={() => handleCopy(selectedBooking.profiles?.email)}/>
                          </span>
                      </div>
                  </div>
              </div>

              {/* 결제 정보 */}
              <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard size={16}/> 결제 정보
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-100">
                          <span className="text-sm text-slate-600">총 결제금액</span>
                          <span className="text-lg font-black text-slate-900">₩{Number(selectedBooking.amount).toLocaleString()}</span>
                      </div>
                      <div className="p-4 bg-white space-y-2 text-xs">
                          <div className="flex justify-between text-slate-500">
                              <span>결제 상태</span>
                              <span className="font-bold text-slate-700">{selectedBooking.status}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                              <span>결제 수단</span>
                              <span className="font-mono">{selectedBooking.payment_method || 'CARD'}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                              <span>주문 번호</span>
                              <span className="font-mono text-[10px]">{selectedBooking.order_id || selectedBooking.id}</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* 관리자 액션 (강제 취소) */}
              {['confirmed', 'paid', 'completed'].includes(selectedBooking.status.toLowerCase()) && (
                  <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                          <AlertTriangle size={16}/> 관리자 권한
                      </h4>
                      <button 
                        onClick={handleForceCancel}
                        disabled={isProcessing}
                        className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing ? '처리 중...' : '예약 강제 취소 (전액 환불)'}
                      </button>
                      <p className="text-[10px] text-slate-400 mt-2 text-center">
                          * PG사 결제 취소 및 DB 상태 변경이 동시에 수행됩니다.
                      </p>
                  </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}

// 상태 뱃지 컴포넌트
function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  
  if (s === 'confirmed' || s === 'paid' || s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
        <CheckCircle2 size={12}/> 확정됨
      </span>
    );
  }
  
  if (s === 'cancelled' || s === 'declined') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-100">
        <XCircle size={12}/> 취소됨
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
      {status}
    </span>
  );
}