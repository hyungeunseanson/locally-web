'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Receipt, Map, ChevronRight } from 'lucide-react';
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
    <div className="group bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row h-auto relative mb-6">
      
      {/* 🟢 이미지 영역 */}
      <div className="w-full md:w-72 h-48 md:h-auto relative shrink-0 overflow-hidden bg-slate-50">
        <Link href={`/experiences/${trip.expId}`} className="block h-full w-full">
          {trip.image ? (
            <img 
              src={trip.image} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              alt={trip.title} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">이미지 없음</div>
          )}
        </Link>
        {/* D-Day 뱃지 - 더 심플하게 */}
        <div className="absolute top-3 left-3 bg-white text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 uppercase tracking-wider border border-slate-100">
          {trip.dDay}
        </div>
      </div>

      {/* 🟢 정보 영역 */}
      <div className="flex-1 p-6 flex flex-col justify-between relative">
        {/* 더보기 메뉴 버튼 (절대 위치로 배치) */}
        <div className="absolute top-4 right-4 z-20">
            <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <MoreHorizontal size={20} className="text-slate-400"/>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-10 w-44 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 font-medium">
                  <button onClick={addToCalendar} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-slate-700">
                    캘린더에 추가
                  </button>
                  <button onClick={() => onCancel(trip.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600">
                    예약 취소
                  </button>
                </div>
              </>
            )}
        </div>

        <div className="pr-10"> {/* 메뉴 버튼 공간 확보 */}
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            {trip.date} · {trip.time}
          </div>

          <Link href={`/experiences/${trip.expId}`}>
            <h3 className="text-xl font-extrabold text-slate-900 leading-snug mb-2 group-hover:underline decoration-2 underline-offset-4 transition-all cursor-pointer line-clamp-2">
              {trip.title}
            </h3>
          </Link>
          <div className="text-sm text-slate-500">
             <span className="font-medium text-slate-700">{trip.hostName}</span>님이 호스팅
          </div>
        </div>
        
        {/* 하단 버튼 - 깔끔한 텍스트 링크 스타일 */}
        <div className="flex items-center gap-5 mt-6 pt-4 border-t border-slate-50">
          <button 
            onClick={openGoogleMaps} 
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors py-2"
          >
            <Map size={16} className="text-slate-400 mb-0.5"/> 길찾기
          </button>
          <button 
            onClick={() => onOpenReceipt(trip)} 
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors py-2"
          >
            <Receipt size={16} className="text-slate-400 mb-0.5"/> 영수증
          </button>
          
          <Link href={`/experiences/${trip.expId}`} className="ml-auto hidden md:block">
             <button className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-900">
               <ChevronRight size={20}/>
             </button>
          </Link>
        </div>
      </div>
    </div>
  );
}