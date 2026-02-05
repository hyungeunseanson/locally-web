'use client';

import React from 'react';
import { CheckCircle2, PenTool } from 'lucide-react';

interface TripCardProps {
  id: number;
  image: string;
  title: string;
  date: string;
  host: string;
  isReviewed?: boolean;
  onReviewClick: (trip: any) => void;
}

export default function TripCard({ id, image, title, date, host, isReviewed, onReviewClick }: TripCardProps) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full bg-white">
      <div className="aspect-[4/3] bg-slate-100 relative group">
        <img 
          src={image} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h4 className="font-bold text-lg mb-1 truncate text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500 mb-3">{date} · {host}</p>
        
        <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
            <CheckCircle2 size={14}/> 이용 완료
          </div>
          {isReviewed ? (
            <button disabled className="text-xs font-bold text-slate-400 px-3 py-1.5 bg-slate-100 rounded-lg cursor-default">
              작성 완료
            </button>
          ) : (
            <button 
              onClick={() => onReviewClick({ id, title, host, image })} 
              className="text-xs font-bold text-white px-3 py-1.5 bg-black rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 active:scale-95"
            >
              <PenTool size={12}/> 후기 작성
            </button>
          )}
        </div>
      </div>
    </div>
  );
}