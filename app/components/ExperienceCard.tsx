'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Star } from 'lucide-react';

export default function ExperienceCard({ item }: { item: any }) {
  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        <img src={item.photos && item.photos[0] ? item.photos[0] : "https://images.unsplash.com/photo-1542051841857-5f90071e7989"} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        <button className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10">
          <Heart size={24} fill="rgba(0,0,0,0.5)" strokeWidth={2} />
        </button>
      </div>
      <div className="space-y-1 px-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">{item.city || '서울'} · {item.category}</h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" /><span>4.95</span><span className="text-slate-400 font-normal">(32)</span>
          </div>
        </div>
        <p className="text-[15px] text-slate-500 line-clamp-1">{item.title}</p>
        <div className="mt-1">
          <span className="font-bold text-slate-900 text-[15px]">₩{Number(item.price).toLocaleString()}</span>
          <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
        </div>
      </div>
    </Link>
  );
}