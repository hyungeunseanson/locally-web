'use client';

import React from 'react';
import { X, Share, MapPin, Calendar, User, CheckCircle, Smartphone } from 'lucide-react';

interface ReceiptModalProps {
  trip: any;
  onClose: () => void;
}

export default function ReceiptModal({ trip, onClose }: ReceiptModalProps) {
  if (!trip) return null;

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `[Locally] ${trip.title} 예약`,
          text: `${trip.date} ${trip.title} 예약 내역입니다.`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('공유 취소');
      }
    } else {
      alert('링크가 복사되었습니다 (클립보드 기능 구현 필요)');
    }
  };

  const pricePerGuest = trip.guests > 0 ? trip.price / trip.guests : trip.price;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden font-sans h-[85vh] sm:h-auto flex flex-col">
        
        {/* 헤더 */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-900"/>
          </button>
          <h2 className="text-base font-bold text-slate-900">예약 상세</h2>
          <div className="w-8"></div>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-col items-center text-center mb-8">
             <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 text-green-600">
                <CheckCircle size={24}/>
             </div>
             <h1 className="text-xl font-bold text-slate-900">예약 확정됨</h1>
             <p className="text-sm text-slate-500 mt-1 font-mono">{trip.orderId}</p>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{trip.title}</h3>
                <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Calendar size={14} className="text-slate-400"/> <span>{trip.date} · {trip.time}</span></div>
                    <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-400"/> <span>{trip.location}</span></div>
                    <div className="flex items-center gap-2"><User size={14} className="text-slate-400"/> <span>{trip.guests}명 ({trip.isPrivate ? '프라이빗' : '그룹'})</span></div>
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
                <h4 className="font-bold text-sm text-slate-900 mb-3">호스트 정보</h4>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs">
                        {trip.hostName.substring(0,1)}
                    </div>
                    <div>
                        <div className="font-bold text-sm">{trip.hostName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Smartphone size={10}/> {trip.hostPhone || '연락처 비공개'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
                <h4 className="font-bold text-sm text-slate-900 mb-3">결제 정보</h4>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                        <span>₩{Number(pricePerGuest).toLocaleString()} x {trip.guests}명</span>
                        <span>₩{Number(trip.price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed border-slate-200">
                        <span className="font-bold text-slate-900">합계</span>
                        <span className="font-black text-slate-900 text-lg">₩{Number(trip.price).toLocaleString()}</span>
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0">
           <button onClick={handleShare} className="w-full py-3.5 bg-slate-900 rounded-xl text-sm font-bold text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
             <Share size={16}/> 예약 내역 공유하기
           </button>
        </div>
      </div>
    </div>
  );
}