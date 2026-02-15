'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, Globe, Clock } from 'lucide-react';
import { useWishlist } from '@/app/hooks/useWishlist';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가
import { getContent } from '@/app/utils/contentHelper'; // 🟢 추가

// 🟢 [수정] item 대신 data로 통일 (표준화)
export default function ExperienceCard({ data }: { data: any }) {
  const { isSaved, toggleWishlist } = useWishlist(data.id);
  const { language } = useLanguage(); // 🟢 언어 설정 가져오기

  // 🟢 [핵심] 제목과 카테고리를 언어에 맞춰서 변환!
  const title = getContent(data, 'title', language);
  const category = getContent(data, 'category', language);
  
  // 이미지 처리 (없으면 기본 이미지)
  const imageUrl = data.photos && data.photos.length > 0 
    ? data.photos[0] 
    : "https://images.unsplash.com/photo-1542051841857-5f90071e7989";

  const languages = data.languages || ['한국어']; 
  const durationText = data.duration ? `${data.duration}시간` : null;

  return (
    <Link href={`/experiences/${data.id}`} className="block group">
      {/* 🟢 [디자인 복구] 4:5 비율, 둥근 모서리, 배경색 등 원본 스타일 유지 */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        <Image 
          src={imageUrl} 
          alt={title} 
          fill 
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />

        <button 
          onClick={(e) => { e.preventDefault(); toggleWishlist(); }}
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
          {/* 🟢 변환된 카테고리 표시 */}
          <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">
            {data.city || '서울'} · {category}
          </h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" />
            <span>4.95</span>
            <span className="text-slate-400 font-normal">(32)</span>
          </div>
        </div>
        
        {/* 🟢 변환된 제목 표시 */}
        <p className="text-[15px] text-slate-500 line-clamp-1">{title}</p>

        {/* 부가 정보 (시간, 언어) */}
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
          <span className="font-bold text-slate-900 text-[15px]">₩{Number(data.price).toLocaleString()}</span>
          <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
        </div>
      </div>
    </Link>
  );
}