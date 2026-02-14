'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import Image from 'next/image';
import { Heart } from 'lucide-react';

const POSTS = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  location: ['Kyoto, Japan', 'Seoul, Korea', 'Paris, France', 'Jeju, Korea'][i % 4],
  user: `user_${i}`,
  likes: Math.floor(Math.random() * 500) + 100
}));

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1440px] mx-auto px-6 py-24">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 border-b border-black pb-8">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter">
            Community
          </h1>
          <div className="flex gap-4 mt-6 md:mt-0">
            {['All', 'Korea', 'Japan', 'Global'].map((filter, idx) => (
              <button key={idx} className={`text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-black transition-all ${idx === 0 ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* 그리드 (4:5 비율 적용) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-16 gap-x-8">
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