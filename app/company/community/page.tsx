'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import Image from 'next/image';
import { Heart, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const POSTS = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  location: ['Kyoto, Japan', 'Seoul, Korea', 'Paris, France', 'Jeju, Korea'][i % 4],
  user: `user_${i}`,
  likes: Math.floor(Math.random() * 500) + 100
}));

export default function CommunityPage() {
  const router = useRouter();

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/account');
  };

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1440px] mx-auto px-4 md:px-6 py-12 md:py-24">
        <div className="md:hidden mb-6">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-20 border-b border-black pb-6 md:pb-8">
          <h1 className="text-3xl md:text-8xl font-black tracking-tighter">
            Community
          </h1>
          <div className="flex gap-2 md:gap-4 mt-4 md:mt-0 flex-wrap">
            {['All', 'Korea', 'Japan', 'Global'].map((filter, idx) => (
              <button key={idx} className={`text-[11px] md:text-sm font-bold uppercase tracking-widest px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-black transition-all ${idx === 0 ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* 그리드 (4:5 비율 적용) */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-y-10 md:gap-y-16 gap-x-4 md:gap-x-8">
          {POSTS.map((post, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-[4/5] overflow-hidden bg-[#F0F0F0] mb-4">
                <Image 
                  src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&w=600&q=80`}
                  alt="Community"
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* 호버 시 오버레이 */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-6">
                  <span className="text-white font-bold text-lg">{post.location}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center border-t border-black pt-3">
                <span className="text-xs font-bold uppercase tracking-wider">@{post.user}</span>
                <div className="flex items-center gap-1.5">
                   <Heart size={14} className="fill-black"/>
                   <span className="text-xs font-bold">{post.likes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
