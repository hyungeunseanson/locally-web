'use client';

import React from 'react';
import { Bell, Calendar, User, DollarSign, Clock } from 'lucide-react';

export default function RealtimeBookings({ bookings }: { bookings: any[] }) {
  // 최신순 정렬
  const sortedBookings = [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Bell size={32} className="text-rose-500"/> 실시간 예약 현황
          </h2>
          <p className="text-slate-500 mt-2">지금 들어오고 있는 예약들을 실시간으로 확인하세요.</p>
        </div>
        <div className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl font-bold text-lg border border-rose-100">
          오늘 신규 예약: <span className="text-slate-900 ml-1">{bookings.filter(b => new Date(b.created_at).toDateString() === new Date().toDateString()).length}건</span>
        </div>
      </div>

      <div className="space-y-4">
        {sortedBookings.map((booking, idx) => (
          <div key={booking.id} className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 border border-slate-100 rounded-2xl bg-white hover:border-rose-200 hover:shadow-md transition-all group">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold shrink-0 group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">
              {idx + 1}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">New Booking</span>
                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {new Date(booking.created_at).toLocaleString()}</span>
              </div>
              <h3 className="font-bold text-lg text-slate-900">{booking.experiences?.title || '삭제된 체험'}</h3>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1"><User size={14}/> 게스트 {booking.guests}명</span>
                <span className="flex items-center gap-1"><Calendar size={14}/> 예약일: {booking.date}</span>
                <span className="flex items-center gap-1 font-bold text-rose-500"><DollarSign size={14}/> ₩{Number(booking.total_price).toLocaleString()}</span>
              </div>
            </div>

            <button className="px-5 py-2.5 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-900 hover:text-white transition-colors">
              상세 보기
            </button>
          </div>
        ))}

        {sortedBookings.length === 0 && (
          <div className="py-20 text-center text-slate-400">아직 접수된 예약이 없습니다.</div>
        )}
      </div>
    </div>
  );
}