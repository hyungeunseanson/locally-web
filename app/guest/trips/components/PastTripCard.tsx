'use client';

import React from 'react';
import { ChevronRight, CheckCircle } from 'lucide-react'; // 체크 아이콘 추가
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가

interface PastTripCardProps {
  trip: any;
  onOpenReview: (trip: any) => void;
}

export default function PastTripCard({ trip, onOpenReview }: PastTripCardProps) {
  const { t } = useLanguage(); // 🟢 추가
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors group cursor-default border border-transparent hover:border-slate-100">
      <div className="w-14 h-14 bg-slate-200 rounded-lg overflow-hidden shrink-0">
        {trip.image ? (
          <img src={trip.image} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
        ) : (
          <div className="w-full h-full bg-slate-200"></div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm text-slate-900 truncate">{trip.title}</h4>
        <div className="text-xs text-slate-500 mt-0.5">{trip.date}</div>
        
        {trip.status !== 'cancelled' ? (
          // 🟢 [수정] 후기 작성 여부에 따라 UI 분기
          trip.hasReview ? (
            <span className="text-xs font-semibold text-green-600 mt-1.5 flex items-center gap-1">
              <CheckCircle size={12}/> 후기 작성 완료
            </span>
          ) : (
            <button 
              onClick={() => onOpenReview(trip)} 
              className="text-xs font-semibold text-blue-600 hover:underline mt-1.5"
            >
{t('trip_review')} {/* 🟢 교체 (후기 작성하기) */}
            </button>
          )
        ) : (
          <span className="text-[10px] text-slate-400 mt-1.5 inline-block bg-slate-100 px-1.5 py-0.5 rounded">취소됨</span>
        )}
      </div>
      
      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors"/>
    </div>
  );
}