'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import { Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      <div className="flex-1 max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-black mb-4">커뮤니티 포럼</h1>
          <p className="text-slate-500">전 세계 로컬리 호스트와 게스트들의 생생한 여행 이야기를 만나보세요.</p>
          
          <div className="flex justify-center flex-wrap gap-2 mt-6">
            {['전체', '한국어', 'English', '日本語', '中文'].map((lang, idx) => (
              <button key={idx} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${idx === 0 ? 'bg-black text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden cursor-pointer">
              <Image 
                src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&w=400&q=80`}
                alt="Community Post" 
                fill 
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                // 실제 구현 시 유효한 이미지 URL 사용 필요. 여기서는 에러 방지용으로 빈 src 처리 혹은 기본 이미지 사용 권장.
                // 편의상 랜덤 이미지가 아닌 고정된 예시 이미지로 대체합니다.
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold">
                <span className="flex items-center gap-1"><Heart className="fill-white" size={20}/> {Math.floor(Math.random() * 300)}</span>
                <span className="flex items-center gap-1"><MessageCircle className="fill-white" size={20}/> {Math.floor(Math.random() * 50)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}