'use client';

import React from 'react';
import { X, Printer, Share, MapPin } from 'lucide-react';

interface ReceiptModalProps {
  trip: any;
  onClose: () => void;
}

export default function ReceiptModal({ trip, onClose }: ReceiptModalProps) {
  if (!trip) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden font-sans">
        
        {/* 헤더 */}
        <div className="flex justify-between items-start p-6 pb-2">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-900"/>
          </button>
          <div className="text-right">
            <h2 className="text-lg font-bold text-slate-900">영수증</h2>
            <p className="text-xs text-slate-500 font-mono mt-1">ID: {trip.orderId}</p>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="px-8 py-4">
          <div className="border-b border-slate-100 pb-8 mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{trip.title}</h1>
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              <span className="font-medium text-slate-900">호스트: {trip.hostName}</span>
              <span>•</span>
              <span>{trip.location}</span>
            </div>
          </div>

          {/* 일정 정보 */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">일정</div>
              <div className="font-medium text-slate-900">{trip.date}</div>
              <div className="text-sm text-slate-500">{trip.time}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">인원 및 옵션</div>
              <div className="font-medium text-slate-900">게스트 {trip.guests}명</div>
              <div className="text-sm text-slate-500">{trip.isPrivate ? '프라이빗 투어' : '그룹 투어'}</div>
            </div>
          </div>

          {/* 결제 내역 */}
          <div className="border-t border-slate-100 pt-8 mb-8">
            <h3 className="font-bold text-slate-900 mb-4">결제 세부 정보</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">₩{Number(trip.price / trip.guests).toLocaleString()} x {trip.guests}명</span>
                <span className="text-slate-900">₩{Number(trip.price).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">서비스 수수료</span>
                <span className="text-slate-900">₩0</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                <span className="font-bold text-slate-900 text-base">합계 (KRW)</span>
                <span className="font-black text-slate-900 text-xl">₩{Number(trip.price).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="bg-slate-50 -mx-8 px-8 py-6 border-t border-slate-100 flex justify-between items-center">
             <div className="text-xs text-slate-500">
               <div>결제 완료됨</div>
               <div className="mt-1 font-mono">{new Date().toLocaleDateString()}</div>
             </div>
             <div className="flex gap-2">
               <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                 <Printer size={14}/> 인쇄
               </button>
               <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 rounded-lg text-xs font-bold text-white hover:bg-slate-800 transition-colors">
                 <Share size={14}/> 저장
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}