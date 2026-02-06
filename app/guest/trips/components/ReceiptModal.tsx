'use client';

import React from 'react';
import { X, Share, MapPin, Calendar, User, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  trip: any;
  onClose: () => void;
}

export default function ReceiptModal({ trip, onClose }: ReceiptModalProps) {
  if (!trip) return null;

  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: `[Locally] ${trip.title} 예약 내역`,
                text: `${trip.date}에 예정된 ${trip.title} 여행의 영수증입니다. 예약번호: ${trip.orderId}`,
                url: window.location.href, // 또는 실제 영수증 페이지 URL
            });
        } catch (error) {
            console.log('공유 취소됨', error);
        }
    } else {
        alert('이 브라우저에서는 공유 기능을 지원하지 않습니다. URL을 복사해서 사용해주세요.');
    }
  };

  const pricePerGuest = trip.guests > 0 ? trip.price / trip.guests : trip.price;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden font-sans h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
        
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-900"/>
          </button>
          <h2 className="text-base font-bold text-slate-900">영수증</h2>
          <div className="w-8"></div> {/* 밸런스용 공백 */}
        </div>

        {/* 메인 컨텐츠 (스크롤 영역) */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* 완료 메시지 */}
          <div className="flex flex-col items-center text-center mb-8">
             <CheckCircle size={40} className="text-green-500 mb-2"/>
             <h1 className="text-xl font-bold text-slate-900">예약이 확정되었습니다.</h1>
             <p className="text-sm text-slate-500 mt-1">예약 번호: <span className="font-mono font-medium">{trip.orderId}</span></p>
          </div>

          {/* 상품 정보 */}
          <div className="border-b border-slate-100 pb-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-3 leading-tight">{trip.title}</h3>
            <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Calendar size={14}/> <span>{trip.date} · {trip.time}</span></div>
                <div className="flex items-center gap-2"><MapPin size={14}/> <span>{trip.location}</span></div>
                <div className="flex items-center gap-2"><User size={14}/> <span>게스트 {trip.guests}명 · {trip.isPrivate ? '프라이빗 투어' : '일반 투어'}</span></div>
            </div>
          </div>

          {/* 호스트 정보 */}
          <div className="border-b border-slate-100 pb-6 mb-6">
            <div className="text-sm font-bold text-slate-900 mb-1">호스트</div>
            <div className="text-sm text-slate-600">{trip.hostName} (연락처: {trip.hostPhone || '비공개'})</div>
          </div>

          {/* 결제 내역 (Price Breakdown) */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">요금 세부 정보</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">₩{Number(pricePerGuest).toLocaleString()} x {trip.guests}명</span>
                <span className="text-slate-900">₩{Number(trip.price).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">서비스 수수료</span>
                <span className="text-slate-900">₩0</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                <span className="font-bold text-slate-900 text-base">총 합계 (KRW)</span>
                <span className="font-black text-slate-900 text-lg">₩{Number(trip.price).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 고정 영역 */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0">
           <button onClick={handleShare} className="w-full py-3 bg-slate-900 rounded-xl text-sm font-bold text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
             <Share size={16}/> 공유하기
           </button>
        </div>
      </div>
    </div>
  );
}