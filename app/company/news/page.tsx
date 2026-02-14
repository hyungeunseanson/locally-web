'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ArrowUpRight } from 'lucide-react';

const NEWS_ITEMS = [
  {
    id: 1,
    tag: 'PRESS',
    title: '로컬리, 시리즈 A 투자 유치 성공... 글로벌 확장 가속화',
    source: '한국경제',
    date: '2026.02.14'
  },
  {
    id: 2,
    tag: 'INTERVIEW',
    title: '"여행은 살아보는 것" 로컬리 CEO가 말하는 여행의 미래',
    source: '매일경제',
    date: '2026.01.28'
  },
  {
    id: 3,
    tag: 'UPDATE',
    title: '로컬리 앱 3.0 업데이트: AI 기반 맞춤형 여행 추천 기능 도입',
    source: 'Locally Blog',
    date: '2026.01.10'
  },
  {
    id: 4,
    tag: 'CAMPAIGN',
    title: '로컬리 X 서울관광재단, "서울의 숨은 매력 찾기" 캠페인 성료',
    source: '여행신문',
    date: '2025.12.20'
  }
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />
      
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-2">뉴스룸</h1>
        <p className="text-slate-500 text-sm mb-10">Locally의 언론 보도와 소식을 전해드립니다.</p>
        
        <div className="border-t border-slate-200">
          {NEWS_ITEMS.map((item) => (
            <a 
              key={item.id} 
              href="#" 
              className="group block border-b border-slate-100 py-6 hover:bg-slate-50 transition-colors px-3 -mx-3 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded tracking-wide">
                      {item.tag}
                    </span>
                    <span className="text-xs text-slate-400">{item.date}</span>
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 group-hover:text-black group-hover:underline decoration-1 underline-offset-4 mb-1">
                    {item.title}
                  </h3>
                  <span className="text-xs text-slate-400">{item.source}</span>
                </div>
                
                <div className="text-slate-300 group-hover:text-black transition-colors mt-1">
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}