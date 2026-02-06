'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Calendar, Map } from 'lucide-react';
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
    <div className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 border border-slate-100">
      
      {/* 이미지 영역 (비율 시원하게) */}
      <div className="relative aspect-[16/9] sm:aspect-[2/1] overflow-hidden bg-slate-100">
        <Link href={`/experiences/${trip.expId}`} className="block w-full h-full">
          {trip.image ? (
            <img 
              src={trip.image} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              alt={trip.title} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">이미지 없음</div>
          )}
        </Link>
        
        {/* D-Day 뱃지 (심플하게) */}
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
          {trip.dDay}
        </div>

        {/* 더보기 버튼 (이미지 위로 올림 - 공간 절약) */}
        <div className="absolute top-4 right-4">
            <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-2 bg-white/90 hover:bg-white rounded-full shadow-sm transition-colors text-slate-700">
              <MoreHorizontal size={18}/>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-10 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-medium">
                  <button onClick={addToCalendar} className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 text-slate-700">캘린더 추가</button>
                  <button onClick={() => onCancel(trip.id)} className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 text-red-600">예약 취소</button>
                </div>
              </>
            )}
        </div>
      </div>

      {/* 정보 영역 */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            {trip.date} · {trip.time}
          </div>
          {trip.isPrivate && (
            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">PRIVATE</span>
          )}
        </div>

        <Link href={`/experiences/${trip.expId}`}>
          <h3 className="text-xl font-bold text-slate-900 leading-tight mb-2 group-hover:underline decoration-2 underline-offset-4 transition-all line-clamp-1">
            {trip.title}
          </h3>
        </Link>
        
        <div className="text-sm text-slate-500 flex items-center gap-1 mb-6">
           <MapPin size={14} className="text-slate-400"/> {trip.location}
        </div>
        
        {/* 하단 버튼 (깔끔한 텍스트형) */}
        <div className="flex gap-4 pt-4 border-t border-slate-100">
          <button 
            onClick={openGoogleMaps} 
            className="flex-1 text-center py-2 text-sm font-semibold text-slate-600 hover:text-black hover:bg-slate-50 rounded-lg transition-colors"
          >
            지도 보기
          </button>
          <div className="w-[1px] bg-slate-200 my-1"></div>
          <button 
            onClick={() => onOpenReceipt(trip)} 
            className="flex-1 text-center py-2 text-sm font-semibold text-slate-600 hover:text-black hover:bg-slate-50 rounded-lg transition-colors"
          >
            영수증 보기
          </button>
        </div>
      </div>
    </div>
  );
}