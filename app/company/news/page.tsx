'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import Image from 'next/image';

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      <div className="flex-1 max-w-5xl mx-auto px-6 py-20 w-full">
        <h1 className="text-3xl font-black mb-12 text-center">Locally Newsroom</h1>
        
        <div className="grid md:grid-cols-2 gap-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 mb-4">
                {/* 실제 이미지가 없으므로 더미 이미지 사용 */}
                <Image 
                  src={`https://images.unsplash.com/photo-${i === 1 ? '1504609773096-104ff10587a4' : i === 2 ? '1526772662003-6eb4a4c394ae' : i === 3 ? '1469854523086-cc02fe5d8800' : '1476514525535-07fb3b4ae5f1'}?auto=format&fit=crop&w=800&q=80`} 
                  alt="News" 
                  fill 
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <span className="text-xs font-bold text-blue-600 mb-2 block">PRESS RELEASE</span>
              <h3 className="text-xl font-bold mb-2 group-hover:underline leading-snug">
                로컬리, 시리즈 A 투자 유치 성공... 글로벌 확장 가속화 ({i})
              </h3>
              <p className="text-slate-500 text-sm line-clamp-2">
                현지 체험 플랫폼 로컬리가 2026년 상반기 대규모 투자를 유치하며 일본 및 동남아 시장 진출에 박차를 가한다. 이번 투자는...
              </p>
              <span className="text-xs text-slate-400 mt-3 block">2026.02.14</span>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}