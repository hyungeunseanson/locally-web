'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MoreHorizontal, MapPin, Clock, Calendar, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, MessageSquare, Map, Receipt, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CancellationModal from './CancellationModal';

interface TripCardProps {
  trip: any;
  // 🟢 [복구] 기존 코드와 동일한 시그니처 (사유, hostId 포함)
  onRequestCancel: (id: number, reason: string, hostId: string) => Promise<boolean>;
  onOpenReceipt: (trip: any) => void;
  isProcessing: boolean;
}

export default function TripCard({ trip, onRequestCancel, onOpenReceipt, isProcessing }: TripCardProps) {
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // 🟢 사진 슬라이더 상태
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = trip.photos && trip.photos.length > 0 
    ? trip.photos 
    : [trip.image || 'https://via.placeholder.com/400'];

  const nextPhoto = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (currentPhotoIndex < photos.length - 1) setCurrentPhotoIndex(prev => prev + 1);
  };
  const prevPhoto = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (currentPhotoIndex > 0) setCurrentPhotoIndex(prev => prev - 1);
  };

  // 🟢 [복구] 날짜 포맷팅 함수
  const formatPaymentDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  // 🟢 상태 뱃지 로직 (기존 D-Day 로직과 통합)
  const getStatusInfo = () => {
    if (trip.status === 'confirmed' || trip.status === 'PAID') {
      const today = new Date();
      const tripDate = new Date(trip.date);
      const diffTime = tripDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return { label: '오늘 출발!', color: 'bg-rose-500 text-white', icon: <Clock size={12}/> };
      if (diffDays > 0 && diffDays <= 7) return { label: `${diffDays}일 후 출발`, color: 'bg-green-500 text-white', icon: <Calendar size={12}/> };
      return { label: '예약 확정', color: 'bg-white/90 text-slate-800', icon: <CheckCircle size={12}/> };
    }
    if (trip.status === 'pending') return { label: '승인 대기', color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12}/> };
    if (trip.status === 'cancellation_requested') return { label: '취소 요청중', color: 'bg-orange-100 text-orange-600', icon: <AlertCircle size={12}/> };
    if (trip.status === 'cancelled') return { label: '취소됨', color: 'bg-red-100 text-red-600', icon: <AlertCircle size={12}/> };
    return { label: trip.status, color: 'bg-slate-100 text-slate-500', icon: null };
  };

  const { label, color, icon } = getStatusInfo();

  // 캘린더 추가
  const addToCalendar = () => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${trip.location}`);
    const location = encodeURIComponent(trip.location);
    const dateStr = trip.date.replace(/-/g, ""); 
    const dates = `${dateStr}/${dateStr}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`, '_blank');
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col md:flex-row h-auto md:h-64">
        
        {/* 1. 왼쪽: 이미지 섹션 (슬라이더) */}
        <div className="w-full md:w-72 h-56 md:h-full relative bg-slate-200 shrink-0 cursor-pointer overflow-hidden group/slide">
           <Link href={`/experiences/${trip.expId}`} className="block w-full h-full relative">
             <Image 
               src={photos[currentPhotoIndex]} 
               alt={trip.title} 
               fill 
               className="object-cover transition-transform duration-700 group-hover:scale-105" 
             />
           </Link>

           {/* 🟢 [복구] PRIVATE 뱃지 */}
           {trip.isPrivate && (
              <div className="absolute top-3 right-3 z-10 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                 <Lock size={10}/> PRIVATE
              </div>
           )}

           {/* 상태/D-Day 뱃지 */}
           <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm backdrop-blur-md ${color}`}>
              {icon} {label}
           </div>

           {/* 슬라이드 컨트롤 */}
           {photos.length > 1 && (
             <>
               <button onClick={prevPhoto} disabled={currentPhotoIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-800 disabled:opacity-0 transition-all opacity-0 group-hover/slide:opacity-100 shadow-sm"><ChevronLeft size={16}/></button>
               <button onClick={nextPhoto} disabled={currentPhotoIndex === photos.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-800 disabled:opacity-0 transition-all opacity-0 group-hover/slide:opacity-100 shadow-sm"><ChevronRight size={16}/></button>
               <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                 {photos.map((_: any, idx: number) => (
                   <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all ${idx === currentPhotoIndex ? 'bg-white scale-125' : 'bg-white/40'}`}></div>
                 ))}
               </div>
             </>
           )}
        </div>

        {/* 2. 오른쪽: 정보 섹션 */}
        <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
           <div>
             <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col gap-1">
                   {/* 🟢 [복구] 오더 ID & 결제일시 */}
                   <div className="flex items-center gap-2 text-[10px] text-slate-400">
                     <span className="font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">#{trip.orderId}</span>
                     <span>결제: {formatPaymentDate(trip.paymentDate)}</span>
                   </div>
                   
                   <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mt-1">
                      <MapPin size={12}/> {trip.location || 'SEOUL'}
                   </div>
                </div>
                
                {/* 더보기 메뉴 */}
                <div className="relative group/menu">
                   <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                      <MoreHorizontal size={20}/>
                   </button>
                   <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-10 hidden group-hover/menu:block hover:block animate-in fade-in zoom-in-95 origin-top-right">
                      <button onClick={addToCalendar} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 font-medium">캘린더에 추가</button>
                      <button onClick={() => router.push(`/experiences/${trip.expId}`)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 font-medium">체험 다시 보기</button>
                      <div className="h-px bg-slate-100 my-1"></div>
                      
                      {/* 🟢 [복구] 취소 상태에 따른 버튼 처리 */}
                      {(trip.status === 'confirmed' || trip.status === 'PAID') ? (
                        <button 
                          onClick={() => setShowCancelModal(true)} 
                          className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-500 font-medium"
                        >
                          예약 취소 요청
                        </button>
                      ) : (
                        <button disabled className="w-full text-left px-4 py-2 text-xs text-slate-400 cursor-not-allowed">
                          {trip.status === 'cancelled' ? '취소 완료됨' : '취소 처리 중'}
                        </button>
                      )}
                   </div>
                </div>
             </div>

             <Link href={`/experiences/${trip.expId}`} className="block group-hover:text-rose-500 transition-colors mt-2">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 leading-tight line-clamp-2">{trip.title}</h3>
             </Link>

             <div className="flex flex-wrap gap-3 text-sm text-slate-600 mt-2">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                   <Calendar size={14} className="text-slate-400"/>
                   <span className="font-semibold text-slate-900">{trip.date}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                   <Clock size={14} className="text-slate-400"/>
                   <span className="font-semibold text-slate-900">{trip.time}</span>
                </div>
             </div>
           </div>

           {/* 🟢 [복구] 하단 3버튼 (메시지, 지도, 영수증) */}
           <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
              <button 
                // 🟢 [복구] hostId 파라미터 포함
                onClick={() => router.push(`/guest/inbox?hostId=${trip.hostId}`)} 
                className="py-2 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
              >
                 <MessageSquare size={14}/> 메시지
              </button>
              <button 
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.location)}`, '_blank')}
                className="py-2 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
              >
                 <Map size={14}/> 지도
              </button>
              <button 
                onClick={() => onOpenReceipt(trip)}
                className="py-2 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
              >
                 <Receipt size={14}/> 영수증
              </button>
           </div>
        </div>
      </div>

      {/* 🟢 [복구] 취소 사유 입력 모달 */}
      <CancellationModal 
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        isProcessing={isProcessing}
        onConfirm={async (reason) => {
          const success = await onRequestCancel(trip.id, reason, trip.hostId); 
          if (success) setShowCancelModal(false);
        }}
      />
    </>
  );
}