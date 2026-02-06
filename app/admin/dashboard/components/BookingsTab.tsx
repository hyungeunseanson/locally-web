'use client';

import React, { useState } from 'react';
import { Calendar, User, DollarSign, Clock, CheckCircle2, XCircle, AlertCircle, FileText, MessageCircle, X, Ban, CreditCard } from 'lucide-react';

export default function BookingsTab({ bookings }: { bookings: any[] }) {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // 필터링 및 정렬
  const filteredBookings = bookings
    .filter(b => filterStatus === 'ALL' || b.status === filterStatus)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 상태 뱃지
  const StatusBadge = ({ status }: { status: string }) => {
    switch(status) {
      case 'confirmed': return <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-100"><CheckCircle2 size={12}/> 예약 확정</span>;
      case 'cancelled': return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100"><XCircle size={12}/> 취소됨</span>;
      case 'pending': return <span className="flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-1 rounded text-xs font-bold border border-yellow-100"><Clock size={12}/> 승인 대기</span>;
      default: return <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs">상태 미정</span>;
    }
  };

  return (
    <div className="flex-1 h-full flex overflow-hidden relative">
      
      {/* 메인 리스트 영역 */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedBooking ? 'w-2/3 pr-4' : 'w-full'}`}>
        
        {/* 상단 요약 & 필터 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm shrink-0">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">예약 통합 관리</h2>
              <p className="text-sm text-slate-500">전체 예약 내역을 모니터링하고 이슈를 처리합니다.</p>
            </div>
            <div className="flex gap-2">
              {['ALL', 'pending', 'confirmed', 'cancelled'].map(status => (
                <button 
                  key={status} 
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filterStatus === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {status === 'ALL' ? '전체 보기' : status}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">총 예약액(GMV)</div>
              <div className="text-lg font-black text-slate-900">₩{filteredBookings.reduce((acc, b) => acc + (b.total_price||0), 0).toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">확정율</div>
              <div className="text-lg font-black text-blue-600">
                {bookings.length > 0 ? Math.round((bookings.filter(b=>b.status==='confirmed').length / bookings.length) * 100) : 0}%
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">취소/환불</div>
              <div className="text-lg font-black text-red-500">{bookings.filter(b=>b.status==='cancelled').length}건</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase">대기 중</div>
              <div className="text-lg font-black text-yellow-600">{bookings.filter(b=>b.status==='pending').length}건</div>
            </div>
          </div>
        </div>

        {/* 리스트 테이블 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10 font-bold">
                <tr>
                  <th className="px-6 py-3">예약 번호/일시</th>
                  <th className="px-6 py-3">체험 정보</th>
                  <th className="px-6 py-3">게스트</th>
                  <th className="px-6 py-3">결제 금액</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredBookings.map((bk) => (
                  <tr key={bk.id} onClick={() => setSelectedBooking(bk)} className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedBooking?.id === bk.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4">
                      {/* ✅ String() 처리로 BigInt 에러 방지 */}
                      <div className="font-mono text-xs text-slate-400 mb-1">#{String(bk.id).substring(0,8)}</div>
                      <div className="text-slate-900 font-medium">{new Date(bk.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 line-clamp-1">{bk.experiences?.title}</div>
                      <div className="text-xs text-slate-500">{bk.date} · {bk.guests}명</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">G</div>
                        <span className="truncate max-w-[100px]">{bk.user_email || '게스트'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">₩{Number(bk.total_price).toLocaleString()}</td>
                    <td className="px-6 py-4"><StatusBadge status={bk.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-slate-900 underline text-xs">상세</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🟢 [신규] 상세 보기 슬라이드 패널 (누락된 부분 복구 완료) */}
      {selectedBooking && (
        <div className="w-[450px] bg-white border-l border-slate-200 h-full shadow-2xl absolute right-0 top-0 z-20 flex flex-col animate-in slide-in-from-right duration-300">
          
          {/* 헤더 */}
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Booking Detail</h3>
              <div className="text-[10px] text-slate-400 font-mono">ID: {selectedBooking.id}</div>
            </div>
            <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* 1. 예약 상태 및 결제 요약 */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <StatusBadge status={selectedBooking.status} />
                <span className="text-xs text-slate-400 font-mono">{new Date(selectedBooking.created_at).toLocaleString()}</span>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                <div className="flex justify-between text-sm mb-2 text-slate-600">
                  <span>체험 기본료 (x{selectedBooking.guests})</span>
                  <span>₩{(selectedBooking.total_price * 0.9).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-2 text-slate-600">
                  <span>플랫폼 수수료 (10%)</span>
                  <span>₩{(selectedBooking.total_price * 0.1).toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-200 my-2"></div>
                <div className="flex justify-between font-bold text-lg">
                  <span>총 결제금액</span>
                  <span className="text-rose-600">₩{Number(selectedBooking.total_price).toLocaleString()}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <CreditCard size={12}/> 카드 결제 (************1234)
                </div>
              </div>
            </div>

            {/* 2. 게스트 & 호스트 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-slate-100 rounded-xl">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Guest</div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">G</div>
                  <span className="text-sm font-bold truncate">게스트 이름</span>
                </div>
                <div className="text-xs text-slate-500">+82 10-1234-5678</div>
              </div>
              <div className="p-4 border border-slate-100 rounded-xl">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Host</div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">H</div>
                  <span className="text-sm font-bold truncate">호스트 이름</span>
                </div>
                <div className="text-xs text-slate-500">010-9876-5432</div>
              </div>
            </div>

            {/* 3. 예약 로그 (타임라인) */}
            <div>
              <h4 className="font-bold text-sm mb-4 flex items-center gap-2"><FileText size={16}/> 예약 처리 로그</h4>
              <div className="pl-2 border-l-2 border-slate-100 space-y-6 ml-1">
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-3 h-3 rounded-full bg-slate-300"></div>
                  <div className="text-xs text-slate-400 mb-0.5">{new Date(selectedBooking.created_at).toLocaleString()}</div>
                  <div className="text-sm font-bold">예약 접수 및 결제 완료</div>
                </div>
                {selectedBooking.status === 'confirmed' && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[5px] top-1 w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="text-xs text-slate-400 mb-0.5">{new Date(selectedBooking.created_at).toLocaleString()}</div>
                    <div className="text-sm font-bold text-green-700">예약 자동 확정 (즉시 예약)</div>
                  </div>
                )}
                {selectedBooking.status === 'cancelled' && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[5px] top-1 w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="text-xs text-slate-400 mb-0.5">{new Date().toLocaleString()}</div>
                    <div className="text-sm font-bold text-red-600">예약 취소됨 (사유: 게스트 요청)</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 하단 관리자 액션 버튼 */}
          <div className="p-5 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
            <button className="bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-100 text-sm flex items-center justify-center gap-2">
              <MessageCircle size={16}/> 메시지 보내기
            </button>
            <button 
              onClick={() => { if(confirm('결제를 취소하고 전액 환불하시겠습니까?')) alert('환불 처리되었습니다.'); }}
              className="bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Ban size={16}/> 예약 취소/환불
            </button>
          </div>
        </div>
      )}
    </div>
  );
}