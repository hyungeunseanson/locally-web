'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ArrowUpRight } from 'lucide-react';

const NEWS_ITEMS = [
  {
    id: 1,
    source: 'TechCrunch',
    title: 'Locally secures Series A funding to expand hyper-local experiences globally.',
    date: '2026.02.14'
  },
  {
    id: 2,
    source: 'The Korea Economic Daily',
    title: '로컬리, "여행은 살아보는 것"... 현지 체험 시장의 새로운 유니콘',
    date: '2026.01.28'
  },
  {
    id: 3,
    source: 'Fast Company',
    title: 'How Locally is using AI to curate perfect travel itineraries.',
    date: '2026.01.10'
  },
  {
    id: 4,
    source: 'Maeil Business',
    title: '서울관광재단 X 로컬리, 골목상권 활성화 캠페인 성료',
    date: '2025.12.20'
  }
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-6 py-24">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 border-b border-black pb-8">
          <div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-2">
              Newsroom
            </h1>
          </div>
          <p className="text-right text-[#717171] font-medium mt-4 md:mt-0">
            Press & Media Coverage
          </p>
        </div>

        {/* 뉴스 리스트 */}
        <div className="flex flex-col">
          {NEWS_ITEMS.map((item) => (
            <a 
              key={item.id} 
              href="#" 
              className="group py-12 border-b border-[#EBEBEB] hover:border-black transition-colors duration-300 block"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                
                {/* 내용 영역 */}
                <div className="flex-1 max-w-3xl">
                  <div className="flex items-center gap-3 mb-3 text-sm font-bold tracking-widest uppercase">
                    <span className="text-black">{item.source}</span>
                    <span className="w-1 h-1 bg-[#DDDDDD] rounded-full"></span>
                    <span className="text-[#999999] font-medium">{item.date}</span>
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight group-hover:text-[#484848] transition-colors">
                    {item.title}
                  </h2>
                </div>

                {/* 화살표 아이콘 (호버 시 움직임) */}
                <div className="mt-2 md:mt-0">
                  <div className="w-12 h-12 rounded-full border border-[#DDDDDD] flex items-center justify-center group-hover:bg-black group-hover:border-black transition-all duration-300">
                    <ArrowUpRight 
                      size={24} 
                      className="text-black group-hover:text-white group-hover:rotate-45 transition-transform duration-300" 
                    />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* 하단 더보기 버튼 */}
        <div className="mt-20 text-center">
          <button className="text-sm font-bold underline underline-offset-4 decoration-2 hover:text-[#717171] transition-colors uppercase tracking-widest">
            Load More News
          </button>
        </div>
      </main>
    </div>
  );
}