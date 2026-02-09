'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Star, Globe } from 'lucide-react';
import Image from 'next/image'; // 🟢 Next/Image 추가

export default function ExperienceCard({ item }: { item: any }) {
  // DB에 languages 필드가 없을 경우를 대비해 기본값 설정
  const languages = item.languages || ['한국어']; 
  const imageUrl = item.photos && item.photos[0] ? item.photos[0] : "https://images.unsplash.com/photo-1542051841857-5f90071e7989";

  return (
    <Link href={`/experiences/${item.id}`} className="block group">
      {/* 🟢 relative는 유지해야 fill이 작동함 */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-200 mb-3 border border-transparent group-hover:shadow-md transition-shadow">
        
        {/* 🟢 Image 컴포넌트로 교체 */}
        <Image 
          src={imageUrl} 
          alt={item.title}
          fill // 부모 div에 꽉 차게 설정
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw" // 성능 최적화 (모바일/PC 사이즈 대응)
        />

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
        
        {/* ✅ [신규] 언어 정보 표시 */}
        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
          <Globe size={12} className="text-slate-400"/>
          <span>{languages.join(' · ')} 진행</span>
        </div>

        <div className="mt-1">
          <span className="font-bold text-slate-900 text-[15px]">₩{Number(item.price).toLocaleString()}</span>
          <span className="text-[15px] text-slate-900 font-normal"> / 인</span>
        </div>
      </div>
    </Link>
  );
}