'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Receipt, Lock, Calendar, Map } from 'lucide-react';
import Link from 'next/link';

interface TripCardProps {
  trip: any;
  onCancel: (id: number) => void;
  onOpenReceipt: (trip: any) => void;
}

export default function TripCard({ trip, onCancel, onOpenReceipt }: TripCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 구글 캘린더 연동
  const addToCalendar = () => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${trip.address}`);
    const location = encodeURIComponent(trip.address);
    // 날짜 포맷 (YYYYMMDD) - 단순화
    const dateStr = trip.date.replace(/-/g, ''); 
    const dates = `${dateStr}/${dateStr}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`, '_blank');
    setIsMenuOpen(false);
  };

  // 구글맵 바로가기
  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.address)}`, '_blank');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row relative group">
      
      {/* 🟢 좌측: 이미지 영역 (모바일 반응형) */}
      <div className="w-full sm:w-48 h-40 sm:h-auto relative shrink-0">
        {trip.image ? (
          <img src={trip.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={trip.title} />
        ) : (
          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No Image</div>
        )}
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10">
          {trip.dDay}
        </div>
      </div>

      {/* 🟢 우측: 정보 및 액션 영역 */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          {/* 상단 정보줄 */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1"><Calendar size={12}/> {trip.date} · {trip.time}</span>
              {trip.isPrivate && (
                <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Lock size={8} /> Private
                </span>
              )}
            </div>
            
            {/* 더보기 메뉴 */}
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <MoreHorizontal size={18} className="text-slate-400"/>
              </button>
              
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 top-8 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button onClick={addToCalendar} className="w-full text-left px-4 py-3 text-xs hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 border-b border-slate-50">
                      <Calendar size={12}/> 캘린더 추가
                    </button>
                    <button onClick={() => onCancel(trip.id)} className="w-full text-left px-4 py-3 text-xs hover:bg-red-50 text-red-500 font-bold">
                      예약 취소
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 타이틀 및 장소 */}
          <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1 hover:underline decoration-2 underline-offset-2">
            <Link href={`/experiences/${trip.expId}`}>{trip.title}</Link>
          </h3>
          <div className="text-sm text-slate-500 flex items-center gap-1 truncate mb-4">
            <MapPin size={14} className="shrink-0"/> {trip.location}
          </div>
        </div>
        
        {/* 하단 버튼 그룹 */}
        <div className="flex gap-2 mt-auto">
          <button 
            onClick={openGoogleMaps} 
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-200"
          >
            <Map size={14}/> 길찾기
          </button>
          <button 
            onClick={() => onOpenReceipt(trip)} 
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors shadow-md"
          >
            <Receipt size={14}/> 티켓 보기
          </button>
        </div>
      </div>
    </div>
  );
}