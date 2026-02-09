'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Star, Globe, Clock } from 'lucide-react'; // 🟢 Clock 아이콘 추가
import Image from 'next/image';
import { useWishlist } from '@/app/hooks/useWishlist'; // 🟢 훅 임포트

export default function ExperienceCard({ item }: { item: any }) {
  // 🟢 훅 사용 (로직 한 줄로 끝!)
  const { isSaved, toggleWishlist } = useWishlist(item.id);

  const languages = item.languages || ['한국어']; 
  const imageUrl = item.photos && item.photos[0] ? item.photos[0] : "https://images.unsplash.com/photo-1542051841857-5f90071e7989";
// 🟢 [누락된 부분 추가] 소요 시간 포맷팅 변수 선언
  const durationText = item.duration ? `${item.duration}시간` : null;
  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        <Image 
          src={imageUrl} 
          alt={item.title} 
          fill 
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />

        <button 
          onClick={toggleWishlist}
          className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10"
        >
          <Heart 
            size={24} 
            fill={isSaved ? "#F43F5E" : "rgba(0,0,0,0.5)"} 
            strokeWidth={2} 
            className={isSaved ? "text-rose-500" : ""}
          />
        </button>
      </div>
      
      <div className="space-y-1 px-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">{item.city || '서울'} · {item.category}</h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" /><span>4.95</span><span className="text-slate-400 font-normal">(32)</span>
          </div>
        </div>
        
{/* 🟢 [수정] 시간 및 언어 정보 함께 표시 */}
<div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
           {durationText && (
             <div className="flex items-center gap-1">
               <Clock size={12} className="text-slate-400"/>
               <span>{durationText}</span>
             </div>
           )}
           <div className="flex items-center gap-1">
             <Globe size={12} className="text-slate-400"/>
             <span>{languages.join(' · ')} 진행</span>
           </div>
        </div>

        <div className="mt-1">
          <span className="font-bold text-slate-900 text-[15px]">₩{Number(item.price).toLocaleString()}</span>
          <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
        </div>
      </div>
    </Link>
  );
}