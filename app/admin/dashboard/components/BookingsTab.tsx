'use client';

import React from 'react';
import { Calendar, User, DollarSign, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function BookingsTab({ bookings }: { bookings: any[] }) {
  // 최신순 정렬
  const sortedBookings = [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // 상태별 뱃지
  const StatusBadge = ({ status }: { status: string }) => {
    switch(status) {
      case 'confirmed': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold"><CheckCircle2 size={12}/> 확정됨</span>;
      case 'cancelled': return <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded text-xs font-bold"><XCircle size={12}/> 취소됨</span>;
      default: return <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-xs font-bold"><AlertCircle size={12}/> 대기중</span>;
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg">
          <div className="text-xs text-slate-400 uppercase font-bold mb-1">총 예약 건수</div>
          <div className="text-2xl font-black">{bookings.length}건</div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <div className="text-xs text-slate-500 uppercase font-bold mb-1">오늘 신규 예약</div>
          <div className="text-2xl font-black text-rose-500">
            {bookings.filter(b => new Date(b.created_at).toDateString() === new Date().toDateString()).length}건
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <div className="text-xs text-slate-500 uppercase font-bold mb-1">예약 대기</div>
          <div className="text-2xl font-black text-yellow-500">
            {bookings.filter(b => b.status === 'pending').length}건
          </div>
        </div>
      </div>

      {/* 예약 리스트 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 font-bold text-lg flex items-center gap-2">
          <Clock className="text-slate-400"/> 예약 타임라인
        </div>
        <div className="divide-y divide-slate-100">
          {sortedBookings.map((booking) => (
            <div key={booking.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center">
               <div className="flex-1">
                 <div className="flex items-center gap-2 mb-2">
                   <StatusBadge status={booking.status || 'confirmed'} />
                   <span className="text-xs text-slate-400">{new Date(booking.created_at).toLocaleString()} 예약접수</span>
                 </div>
                 <h4 className="font-bold text-lg text-slate-900 mb-1">{booking.experiences?.title || '체험 정보 없음'}</h4>
                 <div className="flex gap-4 text-sm text-slate-600">
                   <span className="flex items-center gap-1"><User size={14}/> {booking.guests}명</span>
                   <span className="flex items-center gap-1"><Calendar size={14}/> {booking.date}</span>
                 </div>
               </div>
               
               <div className="text-right">
                 <div className="text-lg font-black text-slate-900">₩{Number(booking.total_price).toLocaleString()}</div>
                 <button className="text-xs text-slate-400 underline hover:text-slate-900 mt-1">상세 내역 보기</button>
               </div>
            </div>
          ))}
          {sortedBookings.length === 0 && <div className="p-10 text-center text-slate-400">예약 내역이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}