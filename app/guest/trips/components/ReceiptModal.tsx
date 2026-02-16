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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="bg-slate-900 p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={18}/></button>
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <CheckCircle2 size={24} className="text-white"/>
          </div>
          <h2 className="text-lg font-bold">결제 영수증</h2>
          <p className="text-slate-400 text-xs mt-1">{safeDate(paymentDate)}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">주문번호</span>
              <span className="font-mono font-bold">{trip.orderId || trip.id?.substring(0, 15) || '-'}</span> 
              {/* 🟢 여기서 trip.id가 없으면 substring 에러 남 -> 옵셔널 체이닝(?.) 사용 */}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">상품명</span>
              <span className="font-bold text-right w-40 truncate">{trip.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">일정</span>
              <span className="font-bold">{trip.date} {trip.time}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">인원</span>
              <span className="font-bold">{trip.guests}명</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-200 my-4"></div>

          <div className="flex justify-between items-end">
            <span className="text-sm font-bold text-slate-900">결제 금액</span>
            <span className="text-2xl font-black text-rose-500">₩{Number(trip.price || trip.amount || 0).toLocaleString()}</span>
          </div>

          <button onClick={() => window.print()} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 flex items-center justify-center gap-2">
            <Download size={16}/> 영수증 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}