'use client';

import React, { useState } from 'react';
import { MapPin, MoreVertical, Calendar, Map, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface TripCardProps {
  trip: any;
  onCancel: (id: number) => void;
  onOpenReceipt: (trip: any) => void;
}

export default function TripCard({ trip, onCancel, onOpenReceipt }: TripCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const addToCalendar = () => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${trip.address}`);
    const location = encodeURIComponent(trip.address);
    const dateStr = trip.date.replace(/-/g, ''); 
    const dates = `${dateStr}/${dateStr}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`, '_blank');
    setIsMenuOpen(false);
  };

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.address)}`, '_blank');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        
        {/* 🟢 이미지 (왼쪽, 작고 컴팩트하게) */}
        <div className="w-full sm:w-32 h-32 relative shrink-0">
          <Link href={`/experiences/${trip.expId}`} className="block w-full h-full">
            {trip.image ? (
              <img src={trip.image} className="w-full h-full object-cover" alt={trip.title} />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">No Img</div>
            )}
          </Link>
          {/* D-Day 뱃지 (작게) */}
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {trip.dDay}
          </div>
        </div>

        {/* 🟢 정보 영역 */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="pr-8">
               <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                 <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{trip.time}</span>
                 {trip.isPrivate && <span className="text-amber-600">Private</span>}
               </div>
               <Link href={`/experiences/${trip.expId}`}>
                 <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1 hover:underline cursor-pointer">
                   {trip.title}
                 </h3>
               </Link>
               <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                 <MapPin size={12}/> {trip.location} · {trip.hostName}
               </div>
            </div>

            {/* 더보기 메뉴 */}
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <MoreVertical size={16} className="text-slate-400"/>
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 top-6 w-36 bg-white border border-slate-100 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                    <button onClick={addToCalendar} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700">캘린더 추가</button>
                    <button onClick={() => onCancel(trip.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600">예약 취소</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 하단 액션 (텍스트 링크형) */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50">
            <button onClick={openGoogleMaps} className="text-xs font-bold text-slate-600 hover:text-black flex items-center gap-1 transition-colors">
              <Map size={12}/> 지도보기
            </button>
            <button onClick={() => onOpenReceipt(trip)} className="text-xs font-bold text-slate-600 hover:text-black flex items-center gap-1 transition-colors">
              <Calendar size={12}/> 상세/영수증
            </button>
            <Link href={`/experiences/${trip.expId}`} className="ml-auto">
               <ChevronRight size={16} className="text-slate-300 hover:text-black transition-colors"/>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}