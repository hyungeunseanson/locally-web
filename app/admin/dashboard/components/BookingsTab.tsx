'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Search, Copy, Calendar, 
  MoreHorizontal, CreditCard, Phone, MapPin, Download, 
  TrendingUp, Mail, User, Fingerprint, ExternalLink, Code, AlertTriangle 
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';

export default function BookingsTab({ bookings }: { bookings: any[] }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🟢 [수정 1] 필터 탭에 'CANCELLED' 추가
  const [filterType, setFilterType] = useState<'ALL' | 'UPCOMING' | 'PAST' | 'CANCELLED'>('ALL');
  
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showRawData, setShowRawData] = useState(false);

  // 🟢 [수정 2] 유효 데이터 필터링 (대소문자 모두 허용)
  // DB에 'cancelled' 소문자로 저장된 데이터도 포함시킴
  const validBookings = bookings.filter(b => {
    const s = b.status?.toUpperCase();
    return s === 'PAID' || s === 'CONFIRMED' || s === 'CANCELLED' || s === 'CANCELLATION_REQUESTED';
  });

  // 🟢 [수정 3] 검색 및 탭 필터링 로직 강화
  const filteredBookings = validBookings.filter(b => {
    // 검색
    const searchString = `${b.contact_name} ${b.contact_phone} ${b.experiences?.title} ${b.id} ${b.profiles?.email || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    
    // 날짜 계산
    const expDate = new Date(`${b.date} ${b.time}`);
    const now = new Date();
    const isUpcoming = expDate >= now;
    const status = b.status?.toUpperCase();

    // 탭별 로직
    if (filterType === 'UPCOMING') {
      // 예정된 예약은 '취소되지 않은' 미래의 예약
      return matchesSearch && isUpcoming && status !== 'CANCELLED' && status !== 'CANCELLATION_REQUESTED';
    }
    if (filterType === 'PAST') {
      // 지난 예약은 '취소되지 않은' 과거의 예약
      return matchesSearch && !isUpcoming && status !== 'CANCELLED' && status !== 'CANCELLATION_REQUESTED';
    }
    if (filterType === 'CANCELLED') {
      // 취소된 건만 보기
      return matchesSearch && (status === 'CANCELLED' || status === 'CANCELLATION_REQUESTED');
    }
    
    // 전체 보기 (모두 포함)
    return matchesSearch;
  });

  // 정산 통계 (결제 완료된 건만)
  const paidBookings = validBookings.filter(b => {
    const s = b.status?.toUpperCase();
    return s === 'PAID' || s === 'CONFIRMED';
  });

  const stats = paidBookings.reduce((acc, b) => {
    const guestPay = b.amount || 0;
    const hostPrice = b.total_price || 0;
    const platformProfit = (guestPay - hostPrice) + (hostPrice * 0.2);
    const hostPayout = hostPrice * 0.8;
    return {
      gmv: acc.gmv + guestPay,
      revenue: acc.revenue + platformProfit,
      payout: acc.payout + hostPayout
    };
  }, { gmv: 0, revenue: 0, payout: 0 });

  const downloadCSV = () => {
    const headers = ['주문번호', '예약자명', '이메일', '전화번호', '체험명', '날짜', '시간', '인원', '결제금액', '상태', '생성일'];
    const rows = filteredBookings.map(b => [
      b.id,
      b.contact_name,
      b.profiles?.email || 'N/A',
      b.contact_phone,
      b.experiences?.title,
      b.date,
      b.time,
      b.guests,
      b.amount,
      b.status,
      b.created_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `예약상세내역_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('복사되었습니다.', 'success');
  };

  return (
    <div className="flex h-full gap-6">
      
      {/* 리스트 영역 */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* 상단 통계 */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center px-6 shrink-0">
          <div className="flex gap-8">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">총 거래액 (GMV)</div>
              <div className="text-xl font-black">₩{stats.gmv.toLocaleString()}</div>
            </div>
            <div className="h-10 w-[1px] bg-slate-700 mx-2"></div>
            <div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase mb-0.5">순매출 (Net Revenue)</div>
              <div className="text-xl font-black text-emerald-400">₩{stats.revenue.toLocaleString()}</div>
            </div>
          </div>
          <button onClick={downloadCSV} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">
            <Download size={14}/> 엑셀 다운로드
          </button>
        </div>

        {/* 툴바 & 탭 */}
        <div className="p-4 border-b border-slate-100 flex gap-3 bg-slate-50 shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="이름, 이메일, 주문번호, 체험명 검색..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* 🟢 [수정 4] 탭 메뉴 확장 */}
          <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
            {['ALL', 'UPCOMING', 'PAST', 'CANCELLED'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterType === type ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {type === 'ALL' ? '전체' : type === 'UPCOMING' ? '예정' : type === 'PAST' ? '완료' : '취소됨'}
              </button>
            ))}
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 border-b border-slate-100 shadow-sm">
              <tr>
                <th className="px-6 py-3">체험 정보</th>
                <th className="px-6 py-3">예약자</th>
                <th className="px-6 py-3">결제 금액</th>
                <th className="px-6 py-3">상태</th>
                <th className="px-6 py-3 text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm bg-white">
              {filteredBookings.map((bk) => (
                <tr 
                  key={bk.id} 
                  onClick={() => setSelectedBooking(bk)}
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedBooking?.id === bk.id ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 line-clamp-1 mb-1">{bk.experiences?.title}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {/* 취소된 건은 날짜에 취소선 표시 */}
                      <span className={bk.status?.toUpperCase() === 'CANCELLED' ? "line-through opacity-50" : (new Date(`${bk.date} ${bk.time}`) < new Date() ? "opacity-50" : "text-blue-600 font-bold")}>
                        {bk.date} · {bk.time}
                      </span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{bk.guests}명</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{bk.contact_name || '이름 없음'}</div>
                    <div className="text-xs text-slate-500">{bk.contact_phone}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold">
                    ₩{Number(bk.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const s = bk.status?.toUpperCase();
                      if (s === 'PAID' || s === 'CONFIRMED') {
                        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle2 size={12}/> 확정</span>;
                      } else if (s === 'CANCELLED' || s === 'CANCELLATION_REQUESTED') {
                        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle size={12}/> 취소</span>;
                      } else {
                        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{s}</span>;
                      }
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <MoreHorizontal size={16} className="text-slate-400"/>
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 오른쪽: 상세 패널 */}
      {selectedBooking ? (
        <div className="w-[450px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-300 relative z-20">
          
          {/* 헤더 */}
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Booking Detail</div>
              <h3 className="font-bold text-lg leading-tight">{selectedBooking.contact_name}님의 예약</h3>
            </div>
            <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><XCircle size={24} className="text-slate-400"/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
            
            {/* 취소 상태 경고 */}
            {(selectedBooking.status?.toUpperCase() === 'CANCELLED' || selectedBooking.status?.toUpperCase() === 'CANCELLATION_REQUESTED') && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 items-start">
                <AlertTriangle className="text-red-500 shrink-0" size={20}/>
                <div>
                  <h4 className="font-bold text-red-700 text-sm">취소된 예약입니다</h4>
                  <p className="text-xs text-red-600 mt-1">
                    사유: {selectedBooking.cancel_reason || '사용자 또는 관리자 취소'}
                  </p>
                </div>
              </div>
            )}

            {/* 수익 분석 카드 */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={120}/></div>
               
               <div className="flex justify-between items-end mb-4">
                 <div className="text-xs text-slate-400">게스트 총 결제금액</div>
                 <div className="text-2xl font-black">₩{Number(selectedBooking.amount).toLocaleString()}</div>
               </div>
               
               <div className="bg-white/10 p-3 rounded-lg space-y-2 text-sm backdrop-blur-sm">
                 <div className="flex justify-between opacity-80">
                    <span>호스트 공급가</span>
                    <span>₩{(selectedBooking.total_price || 0).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between opacity-80">
                    <span>플랫폼 수수료 (Total)</span>
                    <span className="text-emerald-300">+ ₩{((selectedBooking.amount - selectedBooking.total_price) + (selectedBooking.total_price * 0.2)).toLocaleString()}</span>
                 </div>
                 <div className="h-[1px] bg-white/20 my-2"></div>
                 <div className="flex justify-between font-bold">
                    <span>호스트 정산액 (Payout)</span>
                    <span>₩{(selectedBooking.total_price * 0.8).toLocaleString()}</span>
                 </div>
               </div>

               <div className="mt-4 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                   <CreditCard size={12}/> {selectedBooking.tid || 'TID 없음'}
                 </div>
                 {selectedBooking.tid && (
                   <button className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                     영수증 <ExternalLink size={10}/>
                   </button>
                 )}
               </div>
            </div>

            {/* 상세 정보 (User Info) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2 border-b pb-2"><User size={16}/> 예약자 상세 정보</h4>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><User size={16} className="text-slate-500"/></div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Name</div>
                        <div className="text-sm font-bold text-slate-900">{selectedBooking.contact_name}</div>
                      </div>
                   </div>
                   <button onClick={() => handleCopy(selectedBooking.contact_name)}><Copy size={14} className="text-slate-400 hover:text-black"/></button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><Phone size={16} className="text-slate-500"/></div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Phone</div>
                        <div className="text-sm font-bold text-slate-900">{selectedBooking.contact_phone}</div>
                      </div>
                   </div>
                   <button onClick={() => handleCopy(selectedBooking.contact_phone)}><Copy size={14} className="text-slate-400 hover:text-black"/></button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><Mail size={16} className="text-slate-500"/></div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Email</div>
                        <div className="text-sm font-bold text-slate-900">{selectedBooking.profiles?.email || 'N/A'}</div>
                      </div>
                   </div>
                   <button onClick={() => handleCopy(selectedBooking.profiles?.email)}><Copy size={14} className="text-slate-400 hover:text-black"/></button>
                </div>
              </div>

              {selectedBooking.message && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                   <div className="text-[10px] font-bold text-yellow-600 uppercase mb-1">Guest Message</div>
                   <div className="text-sm text-yellow-900">{selectedBooking.message}</div>
                </div>
              )}
            </div>

            {/* RAW DATA */}
            <div className="border-t pt-4">
               <button 
                 onClick={() => setShowRawData(!showRawData)}
                 className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 mb-3"
               >
                 <Code size={14}/> Raw Data {showRawData ? '▲' : '▼'}
               </button>
               {showRawData && (
                 <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed">
                      {JSON.stringify(selectedBooking, null, 2)}
                    </pre>
                 </div>
               )}
            </div>

          </div>
          
          {/* 액션 버튼 */}
          <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0">
             <button 
                onClick={() => { if(confirm('Phase 5에서 환불 API 연동 예정입니다.')) {} }}
                className="w-full py-4 bg-white border-2 border-slate-200 text-slate-400 font-bold rounded-xl hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                예약 취소 및 강제 환불
              </button>
          </div>
        </div>
      ) : (
        <div className="w-[450px] bg-slate-50 border border-slate-200 border-dashed rounded-2xl flex items-center justify-center flex-col text-slate-400 gap-3">
           <Search size={48} className="opacity-10"/>
           <span className="text-sm font-bold">리스트에서 예약을 선택하세요</span>
        </div>
      )}
    </div>
  );
}