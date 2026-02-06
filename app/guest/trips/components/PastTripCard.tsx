'use client';

import React from 'react';

interface PastTripCardProps {
  trip: any;
  onOpenReview: (trip: any) => void;
}

export default function PastTripCard({ trip, onOpenReview }: PastTripCardProps) {
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-all bg-white group flex flex-col p-6 h-full">
      <div className="mb-auto">
        <div className="font-bold mb-2 truncate text-slate-900 leading-snug text-lg">{trip.title}</div>
        <div className="text-sm text-slate-500 font-medium">{trip.date}</div>
      </div>
      
      {trip.status !== 'cancelled' ? (
        <button 
          onClick={() => onOpenReview(trip)} 
          className="text-sm font-semibold underline underline-offset-4 text-slate-900 hover:text-slate-600 transition-colors mt-4 text-left w-fit"
        >
          후기 작성하기
        </button>
      ) : (
        <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded w-fit mt-4 inline-block">
          취소됨
        </span>
      )}
    </div>
  );
}