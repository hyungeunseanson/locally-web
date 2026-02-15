'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, MapPin } from 'lucide-react';
import { ExperienceCardSkeleton } from '@/app/components/skeletons/ExperienceCardSkeleton';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 언어 도구 가져오기
import { getContent } from '@/app/utils/contentHelper'; // 🟢 번역기 가져오기

interface ExperienceCardProps {
  data: any;
  loading?: boolean;
}

export default function ExperienceCard({ data, loading }: ExperienceCardProps) {
  const { language } = useLanguage(); // 🟢 현재 언어 확인 ('ko', 'en' 등)

  if (loading) {
    return <ExperienceCardSkeleton />;
  }

  // 대표 이미지 선택 (photos 배열의 첫 번째 또는 image_url)
  const imageUrl = data.photos && data.photos.length > 0 
    ? data.photos[0] 
    : (data.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb');

  // 🟢 [핵심] 제목과 카테고리를 언어에 맞게 변환!
  const title = getContent(data, 'title', language);
  const category = getContent(data, 'category', language);
  // 도시는 아직 번역 데이터가 없으므로 그대로 둠 (나중에 city_en 추가 가능)
  const location = data.city || data.location; 

  return (
    <Link href={`/experiences/${data.id}`} className="group block h-full">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-200 mb-3">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
          <Star size={12} className="fill-orange-400 text-orange-400" />
          <span className="text-xs font-bold text-slate-800">4.98</span>
        </div>
        {data.status === 'pending' && (
           <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-md text-[10px] font-bold uppercase shadow-sm">
             심사 중
           </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1"><MapPin size={12}/> {location}</span>
          <span>·</span>
          <span>{category}</span>
        </div>

        <div className="pt-1 flex items-baseline gap-1">
          <span className="text-sm font-bold text-slate-900">₩{data.price?.toLocaleString()}</span>
          <span className="text-xs text-slate-400 font-normal">/ 인</span>
        </div>
      </div>
    </Link>
  );
}