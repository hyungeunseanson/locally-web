'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Receipt, MessageSquare, Map, Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import CancellationModal from './CancellationModal';

interface TripCardProps {
  trip: any;
  onRequestCancel: (id: number, reason: string, hostId: string) => Promise<boolean>;
  onOpenReceipt: (trip: any) => void;
  isProcessing: boolean;
}

export default function TripCard({ trip, onRequestCancel, onOpenReceipt, isProcessing }: TripCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // 🟢 사진 슬라이드 상태
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // 날짜 포맷팅 함수
  const formatPaymentDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  };
  
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
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${trip.address || trip.location}`);
    const location = encodeURIComponent(trip.address || trip.location);
    
    // 날짜 포맷 (YYYYMMDD)
    const dateObj = new Date(trip.date);
    const dateStr = dateObj.toISOString().replace(/-|:|\.\d\d\d/g, "").substring(0, 8); 
    const dates = `${dateStr}/${dateStr}`;
    
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`, '_blank');
    setIsMenuOpen(false);
  };

  const openGoogleMaps = () => {
    const query = encodeURIComponent(trip.address || trip.location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 flex flex-col md:flex-row h-auto md:h-64">
      
      {/* 🟢 왼쪽: 사진 슬라이더 */}
      <div className="relative w-full md:w-72 h-48 md:h-full shrink-0 bg-slate-200">
        <Link href={`/experiences/${trip.expId}`} className="block w-full h-full relative">
          <Image 
            src={photos[currentPhotoIndex]} 
            alt={trip.title}
            fill 
            className="object-cover transition-transform duration-700"
          />
          {/* 예약 상태 뱃지 (이미지 위) */}
          <div className="absolute top-3 right-3 z-10">
             {trip.status === 'confirmed' && <span className="bg-green-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">예약 확정</span>}
             {trip.status === 'cancelled' && <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">취소됨</span>}
             {trip.status === 'cancellation_requested' && <span className="bg-orange-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">취소 요청됨</span>}
          </div>
        </Link>
        
        {/* 슬라이드 화살표 (사진이 2장 이상일 때만) */}
        {photos.length > 1 && (
          <>
            <button 
              onClick={prevPhoto} 
              disabled={currentPhotoIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 hover:bg-black/50 text-white disabled:opacity-0 transition-all z-20 backdrop-blur-sm"
            >
              <ChevronLeft size={16}/>
            </button>
            <button 
              onClick={nextPhoto} 
              disabled={currentPhotoIndex === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/20 hover:bg-black/50 text-white disabled:opacity-0 transition-all z-20 backdrop-blur-sm"
            >
              <ChevronRight size={16}/>
            </button>
            
            {/* 인디케이터 점 */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
              {photos.map((_: any, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all ${idx === currentPhotoIndex ? 'bg-white scale-125' : 'bg-white/40'}`}></div>
              ))}
            </div>
          </>
        )}
        
        {/* D-Day 뱃지 */}
        {trip.dDay && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm z-10">
            {trip.dDay}
          </div>
        )}
      </div>

      {/* 오른쪽: 정보 영역 */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        
        {/* 상단 정보 (예약번호, 시간, 메뉴) */}
        <div>
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">#{trip.orderId}</span>
                 <span className="text-[10px] text-slate-400">결제: {formatPaymentDate(trip.paymentDate)}</span>
               </div>
               <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mt-1">
                  <Calendar size={12}/> {trip.date} 
                  <span className="text-slate-300">|</span> 
                  <Clock size={12}/> {trip.time}
                  {trip.isPrivate && (
                    <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 border border-rose-100">PRIVATE</span>
                  )}
               </div>
            </div>
            
            {/* 더보기 메뉴 버튼 */}
            <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <MoreHorizontal size={20}/>
                </button>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute right-0 top-8 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-medium">
                      <button onClick={addToCalendar} className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 text-slate-700">구글 캘린더 추가</button>
                      {trip.status === 'cancellation_requested' || trip.status === 'cancelled' ? (
                          <button disabled className="w-full text-left px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed">취소 처리중/완료</button>
                        ) : (
                          <button onClick={() => { setIsMenuOpen(false); setShowCancelModal(true); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 text-red-600">예약 취소 요청</button>
                        )}
                    </div>
                  </>
                )}
            </div>
          </div>

          <Link href={`/experiences/${trip.expId}`} className="group-hover:text-rose-500 transition-colors block mt-1">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-snug line-clamp-2">
              {trip.title}
            </h3>
          </Link>
          
          <div className="text-sm text-slate-500 flex items-center gap-1 mt-2">
             <MapPin size={14} className="text-slate-400 shrink-0"/> 
             <span className="line-clamp-1">{trip.location}</span>
          </div>
        </div>
        
        {/* 하단 버튼 그룹 */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-50">
          <Link href={`/guest/inbox?hostId=${trip.hostId}`} className="w-full">
            <button className="w-full py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-black rounded-lg transition-all flex items-center justify-center gap-1.5 h-9">
              <MessageSquare size={14} className="opacity-70"/> 메시지
            </button>
          </Link>
          <button onClick={openGoogleMaps} className="w-full py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-black rounded-lg transition-all flex items-center justify-center gap-1.5 h-9">
            <Map size={14} className="opacity-70"/> 지도
          </button>
          <button onClick={() => onOpenReceipt(trip)} className="w-full py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-black rounded-lg transition-all flex items-center justify-center gap-1.5 h-9">
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