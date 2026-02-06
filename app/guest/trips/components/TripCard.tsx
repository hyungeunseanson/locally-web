'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Receipt, Calendar, Map, ChevronRight, Lock } from 'lucide-react';
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
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col sm:flex-row h-auto sm:h-56 relative mb-6">
      
      {/* 🟢 이미지 영역 */}
      <div className="w-full sm:w-72 relative shrink-0 overflow-hidden bg-slate-100">
        <Link href={`/experiences/${trip.expId}`} className="block h-full w-full">
          {trip.image ? (
            <img 
              src={trip.image} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              alt={trip.title} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No Image</div>
          )}
        </Link>
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 uppercase tracking-wide">
          {trip.dDay}
        </div>
      </div>

      {/* 🟢 정보 영역 */}
      <div className="flex-1 p-6 flex flex-col">
        {/* 상단 */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
            <span>{trip.date} • {trip.time}</span>
            {trip.isPrivate && (
              <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-2 normal-case">
                <Lock size={8} /> Private
              </span>
            )}
          </div>
          
          <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-slate-50 rounded-full transition-colors">
              <MoreHorizontal size={20} className="text-slate-400"/>
            </button>
            
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-8 w-40 bg-white border border-slate-100 rounded-lg shadow-xl z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                  <button onClick={addToCalendar} className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 text-slate-700 font-medium">
                    캘린더에 추가
                  </button>
                  <button onClick={() => onCancel(trip.id)} className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 text-red-600 font-medium">
                    예약 취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 타이틀 */}
        <div className="mb-auto">
          <Link href={`/experiences/${trip.expId}`}>
            <h3 className="text-xl font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors cursor-pointer">
              {trip.title}
            </h3>
          </Link>
          <div className="flex items-center gap-1 text-sm text-slate-500">
             <span className="font-medium text-slate-700">Hosted by {trip.hostName}</span>
          </div>
        </div>
        
        {/* 하단 버튼 */}
        <div className="flex items-center gap-4 mt-4 border-t border-slate-100 pt-4">
          <button 
            onClick={openGoogleMaps} 
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <Map size={16} className="text-slate-400"/> 길찾기
          </button>
          <div className="w-[1px] h-3 bg-slate-200"></div>
          <button 
            onClick={() => onOpenReceipt(trip)} 
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <Receipt size={16} className="text-slate-400"/> 영수증 보기
          </button>
          
          <Link href={`/experiences/${trip.expId}`} className="ml-auto">
             <button className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600">
               <ChevronRight size={16}/>
             </button>
          </Link>
        </div>
      </div>
    </div>
  );
}