'use client';

import React from 'react';
import { ChevronRight, CheckCircle, Mountain } from 'lucide-react'; // 🟢 아이콘 추가
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가
import { useRouter } from 'next/navigation';

interface PastTripCardProps {
  trip: any;
  onOpenReview: (trip: any) => void;
}

export default function PastTripCard({ trip, onOpenReview }: PastTripCardProps) {
  const { t } = useLanguage(); // 🟢 추가
  const router = useRouter();

  const handleCardClick = () => {
    if (trip.expId) {
      router.push(`/experiences/${trip.expId}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="flex items-center gap-3 md:gap-4 py-3.5 md:p-4 md:rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer border-b md:border border-slate-100 md:border-transparent md:hover:border-slate-100 last:border-b-0"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCardClick();
      }}
    >
      <div className="w-14 h-14 md:w-14 md:h-14 bg-slate-100 rounded-lg md:rounded-[10px] overflow-hidden shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)] md:shadow-none flex items-center justify-center border border-slate-100 md:border-transparent">
        {trip.photos && trip.photos.length > 0 ? (
          <img src={trip.photos[0]} alt={trip.title} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
        ) : trip.image ? (
          <img src={trip.image} alt={trip.title} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
        ) : (
          <Mountain className="w-5 h-5 text-slate-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-[13px] md:text-sm text-slate-900 truncate">{trip.title}</h4>
        <div className="text-[11px] md:text-xs text-slate-500 mt-0.5">{trip.date}</div>

        {trip.status !== 'cancelled' ? (
          // 🟢 [수정] 후기 작성 여부에 따라 UI 분기
          trip.hasReview ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] md:text-xs font-semibold text-green-600 flex items-center gap-1">
                <CheckCircle className="w-[11px] h-[11px] md:w-3 md:h-3" /> 후기 작성 완료
              </span>
              {trip.review?.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReview(trip); // review 데이터 포함 → 수정 모드로 열림
                  }}
                  className="text-[10px] md:text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:underline"
                >
                  수정
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenReview(trip);
              }}
              className="text-[11px] md:text-xs font-semibold text-blue-600 hover:underline mt-1"
            >
              {t('trip_review')} {/* 🟢 교체 (후기 작성하기) */}
            </button>
          )
        ) : (
          <span className="text-[10px] text-slate-400 mt-1 inline-block bg-slate-100 px-1.5 py-0.5 rounded">취소됨</span>
        )}
      </div>

      <ChevronRight className="w-[14px] h-[14px] md:w-4 md:h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
    </div>
  );
}
