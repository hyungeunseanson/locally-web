'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Receipt, MessageSquare, Map, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import CancellationModal from './CancellationModal';

interface TripCardProps {
  trip: any;
  // ✅ 인자 3개로 변경 (hostId 추가)
  onRequestCancel: (id: number, reason: string, hostId: string) => Promise<boolean>;
  onOpenReceipt: (trip: any) => void;
  isProcessing: boolean;
}

export default function TripCard({ trip, onRequestCancel, onOpenReceipt, isProcessing }: TripCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // 🟢 사진 슬라이드 상태 추가
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // 사진 목록 (없으면 기본 이미지)
  const photos = trip.photos && trip.photos.length > 0 
    ? trip.photos 
    : [trip.image || 'https://images.unsplash.com/photo-1540206395-688085723adb'];

  const nextPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentPhotoIndex < photos.length - 1) setCurrentPhotoIndex(prev => prev + 1);
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentPhotoIndex > 0) setCurrentPhotoIndex(prev => prev - 1);
  };

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
    <div className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 border border-slate-100 flex flex-col md:flex-row">
      
      {/* 🟢 왼쪽: 사진 슬라이더 (모바일은 상단) - 가로 세로 비율 고정 없이 자연스럽게 */}
      <div className="relative w-full md:w-[320px] h-[240px] md:h-auto shrink-0 bg-slate-200">
        <Link href={`/experiences/${trip.expId}`} className="block w-full h-full relative">
          <Image 
            src={photos[currentPhotoIndex]} 
            alt={trip.title}
            fill 
            className="object-cover transition-transform duration-700"
          />
        </Link>
        
        {/* 슬라이드 화살표 (사진이 2장 이상일 때만) */}
        {photos.length > 1 && (
          <>
            <button 
              onClick={prevPhoto} 
              disabled={currentPhotoIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-black shadow-sm disabled:opacity-0 transition-all z-10"
            >
              <ChevronLeft size={16}/>
            </button>
            <button 
              onClick={nextPhoto} 
              disabled={currentPhotoIndex === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-black shadow-sm disabled:opacity-0 transition-all z-10"
            >
              <ChevronRight size={16}/>
            </button>
            
            {/* 인디케이터 점 */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {photos.map((_: any, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all ${idx === currentPhotoIndex ? 'bg-white scale-110' : 'bg-white/50'}`}></div>
              ))}
            </div>
          </>
        )}
        
        {/* D-Day 뱃지 */}
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm z-10">
          {trip.dDay}
        </div>
      </div>

      {/* 오른쪽: 정보 영역 */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-start mb-1 relative">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Calendar size={12}/> {trip.date} · {trip.time}
            {trip.isPrivate && (
              <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">PRIVATE</span>
            )}
          </div>
          
          {/* 더보기 메뉴 버튼 */}
          <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <MoreHorizontal size={20}/>
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 top-8 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-medium">
                    <button onClick={addToCalendar} className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 text-slate-700">캘린더 추가</button>
                    {trip.status === 'cancellation_requested' ? (
                        <button disabled className="w-full text-left px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed">취소 대기중</button>
                      ) : (
                        <button onClick={() => { setIsMenuOpen(false); setShowCancelModal(true); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 text-red-600">예약 취소</button>
                      )}
                  </div>
                </>
              )}
          </div>
        </div>

        <Link href={`/experiences/${trip.expId}`} className="group-hover:text-rose-500 transition-colors">
          <h3 className="text-xl font-bold text-slate-900 leading-tight mb-2 line-clamp-1">
            {trip.title}
          </h3>
        </Link>
        
        <div className="text-sm text-slate-500 flex items-center gap-1 mb-auto">
           <MapPin size={14} className="text-slate-400"/> {trip.location}
        </div>
        
        <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-100 mt-6">
          <Link href={`/guest/inbox?hostId=${trip.hostId}`}>
            <button className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-black rounded-xl transition-all flex items-center justify-center gap-1.5">
              <MessageSquare size={14} className="opacity-70"/> 메시지
            </button>
          </Link>
          <button onClick={openGoogleMaps} className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-black rounded-xl transition-all flex items-center justify-center gap-1.5">
            <Map size={14} className="opacity-70"/> 지도
          </button>
          <button onClick={() => onOpenReceipt(trip)} className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-black rounded-xl transition-all flex items-center justify-center gap-1.5">
            <Receipt size={14} className="opacity-70"/> 영수증
          </button>
        </div>
      </div>
      
      <CancellationModal 
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        isProcessing={isProcessing}
        onConfirm={async (reason) => {
          const success = await onRequestCancel(trip.id, reason, trip.hostId); 
          if (success) setShowCancelModal(false);
        }}
      />
    </div>
  );
}