'use client';

import React from 'react';

interface PastTripCardProps {
  trip: any;
  onOpenReview: (trip: any) => void;
}

export default function PastTripCard({ trip, onOpenReview }: PastTripCardProps) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all bg-white group flex flex-col p-5 h-full">
      <div className="mb-auto">
        <div className="font-bold mb-1 truncate text-slate-900 leading-snug text-lg">{trip.title}</div>
        <div className="text-xs text-slate-500 mb-4 font-medium">{trip.date}</div>
      </div>
      
      {trip.status !== 'cancelled' ? (
        <button 
          onClick={() => onOpenReview(trip)} 
          className="text-xs font-bold underline text-left hover:text-blue-600 transition-colors mt-2"
        >
          후기 작성
        </button>
      ) : (
        <span className="text-xs text-red-400 font-medium bg-red-50 px-2 py-1 rounded w-fit mt-2">
          취소된 여행
        </span>
      )}
    </div>
  );
}