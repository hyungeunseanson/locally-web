'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, Globe, Clock } from 'lucide-react';
import { useWishlist } from '@/app/hooks/useWishlist';
import { useLanguage } from '@/app/context/LanguageContext';
import { getContent } from '@/app/utils/contentHelper';

// 🟢 [중요] 이제 'data'라는 이름으로 통일해서 받습니다.
export default function ExperienceCard({ data }: { data: any }) {
  // 훅이 데이터 ID를 못 찾으면 에러가 날 수 있으므로 방어 코드 추가
  const experienceId = data?.id || '';
  const { isSaved, toggleWishlist } = useWishlist(experienceId);
  const { language } = useLanguage();

  if (!data) return null; // 데이터 없으면 아무것도 안 그림

  // 🟢 1. 다국어 제목/카테고리 가져오기
  const title = getContent(data, 'title', language);
  const category = getContent(data, 'category', language);
  
  // 🟢 2. 이미지 & 위치 정보 (옛날 데이터와 요즘 데이터 호환성 체크)
  const imageUrl = (data.photos && data.photos.length > 0) ? data.photos[0] : (data.image_url || "https://images.unsplash.com/photo-1542051841857-5f90071e7989");
  const location = data.city || data.location || '서울';
  
  // 🟢 3. 부가 정보
  const durationText = data.duration ? `${data.duration}시간` : null;
  const languages = data.languages || ['한국어'];

  return (
    <Link href={`/experiences/${data.id}`} className="block group h-full">
      {/* 🖼️ 이미지 영역 (4:5 비율 유지) */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        <Image 
          src={imageUrl} 
          alt={title} 
          fill 
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />

        {/* ❤️ 하트 버튼 (위치 고정) */}
        <button 
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); // 카드 클릭 방지
            toggleWishlist(); 
          }}
          className="absolute top-3 right-3 text-white/70 hover:text-white hover:scale-110 transition-all z-10 p-1"
        >
          <Heart 
            size={24} 
            fill={isSaved ? "#F43F5E" : "rgba(0,0,0,0.5)"} 
            strokeWidth={2} 
            className={isSaved ? "text-rose-500" : ""}
          />
        </button>
      </div>
      
      {/* 📝 텍스트 영역 */}
      <div className="space-y-1 px-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 text-[15px] truncate pr-2">
            {location} · {category}
          </h3>
          <div className="flex items-center gap-1 text-sm shrink-0">
            <Star size={14} fill="black" />
            <span>4.95</span>
            <span className="text-slate-400 font-normal">(32)</span>
          </div>
        </div>
        
        {/* 제목 */}
        <p className="text-[15px] text-slate-500 line-clamp-1">{title}</p>

        {/* 시간 및 언어 (작은 글씨) */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
           {durationText && (
             <div className="flex items-center gap-1">
               <Clock size={12}/>
               <span>{durationText}</span>
             </div>
           )}
           <div className="flex items-center gap-1">
             <Globe size={12}/>
             <span>{languages.join(' · ')}</span>
           </div>
        </div>

        {/* 가격 */}
        <div className="mt-1">
          <span className="font-bold text-slate-900 text-[15px]">₩{Number(data.price).toLocaleString()}</span>
          <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
        </div>
      </div>
    </Link>
  );
}