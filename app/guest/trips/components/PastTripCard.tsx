'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface PastTripCardProps {
  trip: any;
  onOpenReview: (trip: any) => void;
}

export default function PastTripCard({ trip, onOpenReview }: PastTripCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl bg-white hover:border-slate-200 transition-colors">
      <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0">
        {trip.image && <img src={trip.image} className="w-full h-full object-cover grayscale opacity-70" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{trip.date}</div>
        <h4 className="font-bold text-sm text-slate-900 truncate mb-2">{trip.title}</h4>
        
        {trip.status !== 'cancelled' ? (
          <button 
            onClick={() => onOpenReview(trip)} 
            className="text-xs font-bold text-black border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1 w-fit"
          >
            <Star size={10}/> 후기 쓰기
          </button>
        ) : (
          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">취소됨</span>
        )}
      </div>
    </div>
  );
}