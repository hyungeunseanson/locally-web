'use client';

import React, { useState } from 'react';
import { MapPin, MoreHorizontal, Receipt, MessageSquare, Map } from 'lucide-react';
import Link from 'next/link';
import CancellationModal from './CancellationModal'; // ✅ [추가]

interface TripCardProps {
  trip: any;
  onRequestCancel: (id: number, reason: string) => Promise<boolean>; // ✅ [변경] 사유 포함 & 비동기 처리
  onOpenReceipt: (trip: any) => void;
  isProcessing: boolean; // ✅ [추가] 로딩 상태
}

export default function TripCard({ trip, onRequestCancel, onOpenReceipt, isProcessing }: TripCardProps) { // ✅ Props 이름 변경 확인
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false); // ✅ [추가] 모달 상태

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
    <div className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 border border-slate-100">
      
      {/* 🟢 이미지 영역 */}
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
        
        {/* D-Day 뱃지 */}
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
          {trip.dDay}
        </div>

        {/* 더보기 버튼 */}
        <div className="absolute top-4 right-4">
            <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-2 bg-white/90 hover:bg-white rounded-full shadow-sm transition-colors text-slate-700">
              <MoreHorizontal size={18}/>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-10 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-medium">
                  <button onClick={addToCalendar} className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 text-slate-700">캘린더 추가</button>
{/* ✅ [수정] 예약 취소 버튼 로직 변경 */}
{trip.status === 'cancellation_requested' ? (
    <button disabled className="w-full text-left px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed">
      취소 대기중
    </button>
  ) : (
    <button 
      onClick={() => {
        setIsMenuOpen(false); // 메뉴 닫기
        setShowCancelModal(true); // 모달 열기
      }} 
      className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 text-red-600"
    >
      예약 취소
    </button>
  )}
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
        
        {/* 하단 버튼 그룹 (메시지 버튼 추가됨) */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
          <Link href={`/guest/inbox?hostId=${trip.hostId}`} className="flex-1">
            <button className="w-full text-center py-2 text-sm font-semibold text-slate-600 hover:text-black hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <MessageSquare size={16} className="text-slate-400"/> 메시지
            </button>
          </Link>
          <div className="w-[1px] h-3 bg-slate-200"></div>
          <button 
            onClick={openGoogleMaps} 
            className="flex-1 text-center py-2 text-sm font-semibold text-slate-600 hover:text-black hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Map size={16} className="text-slate-400"/> 지도
          </button>
          <div className="w-[1px] h-3 bg-slate-200"></div>
          <button 
            onClick={() => onOpenReceipt(trip)} 
            className="flex-1 text-center py-2 text-sm font-semibold text-slate-600 hover:text-black hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Receipt size={16} className="text-slate-400"/> 영수증
          </button>
        </div>
      </div>
      {/* ✅ [추가] 취소 모달 연결 */}
      <CancellationModal 
  isOpen={showCancelModal}
  onClose={() => setShowCancelModal(false)}
  isProcessing={isProcessing}
  onConfirm={async (reason) => {
    // ✅ [변경] trip.hostId를 세 번째 인자로 함께 넘겨줍니다.
    const success = await onRequestCancel(trip.id, reason, trip.hostId); 
    if (success) setShowCancelModal(false);
  }}
/>
    </div>
  );
}