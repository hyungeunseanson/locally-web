'use client';

import React from 'react';
import { X, Download, CheckCircle2 } from 'lucide-react';

export default function ReceiptModal({ trip, onClose }: { trip: any, onClose: () => void }) {
  if (!trip) return null;

  // 🟢 [안전 장치] 데이터가 없으면 빈 문자열 처리 (substring 에러 방지)
  const paymentDate = trip.paymentDate || trip.created_at || new Date().toISOString();
  // dateString 처리 시 안전하게
  const safeDate = (dateStr: string) => {
    try {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString();
    } catch { return '-'; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="bg-slate-900 p-4 md:p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-3 md:top-4 right-3 md:right-4 p-1.5 md:p-2 bg-white/10 rounded-full hover:bg-white/20"><X className="w-4 h-4 md:w-[18px] md:h-[18px]"/></button>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2.5 md:mb-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white"/>
          </div>
          <h2 className="text-[16px] md:text-lg font-bold">결제 영수증</h2>
          <p className="text-slate-400 text-[11px] md:text-xs mt-1">{safeDate(paymentDate)}</p>
        </div>

        <div className="p-4 md:p-6 space-y-5 md:space-y-6">
          <div className="space-y-3 md:space-y-4">
            <div className="flex justify-between text-[12px] md:text-sm">
              <span className="text-slate-500">주문번호</span>
              <span className="font-mono font-bold">{trip.orderId || trip.id?.substring(0, 15) || '-'}</span> 
              {/* 🟢 여기서 trip.id가 없으면 substring 에러 남 -> 옵셔널 체이닝(?.) 사용 */}
            </div>
            <div className="flex justify-between text-[12px] md:text-sm">
              <span className="text-slate-500">상품명</span>
              <span className="font-bold text-right w-36 md:w-40 truncate">{trip.title}</span>
            </div>
            <div className="flex justify-between text-[12px] md:text-sm">
              <span className="text-slate-500">일정</span>
              <span className="font-bold">{trip.date} {trip.time}</span>
            </div>
            <div className="flex justify-between text-[12px] md:text-sm">
              <span className="text-slate-500">인원</span>
              <span className="font-bold">{trip.guests}명</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-200 my-3 md:my-4"></div>

          <div className="flex justify-between items-end">
            <span className="text-[13px] md:text-sm font-bold text-slate-900">결제 금액</span>
            <span className="text-[22px] md:text-2xl font-black text-rose-500">₩{Number(trip.price || trip.amount || 0).toLocaleString()}</span>
          </div>

          <button onClick={() => window.print()} className="w-full py-2.5 md:py-3 bg-slate-100 text-slate-600 rounded-lg md:rounded-xl font-bold text-[13px] md:text-sm hover:bg-slate-200 flex items-center justify-center gap-1.5 md:gap-2">
            <Download className="w-[14px] h-[14px] md:w-4 md:h-4"/> 영수증 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
