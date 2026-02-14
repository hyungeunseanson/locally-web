'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ArrowRight } from 'lucide-react';

const NEWS_ITEMS = [
  {
    id: 1,
    category: 'PRESS RELEASE',
    title: '로컬리, 시리즈 A 투자 유치 성공... 글로벌 확장 가속화',
    source: '한국경제',
    date: '2026.02.14',
    link: '#'
  },
  {
    id: 2,
    category: 'INTERVIEW',
    title: '"여행은 살아보는 것" 로컬리 CEO가 말하는 여행의 미래',
    source: '매일경제',
    date: '2026.01.28',
    link: '#'
  },
  {
    id: 3,
    category: 'UPDATE',
    title: '로컬리 앱 3.0 업데이트: AI 기반 맞춤형 여행 추천 기능 도입',
    source: 'Locally Blog',
    date: '2026.01.10',
    link: '#'
  },
  {
    id: 4,
    category: 'CAMPAIGN',
    title: '로컬리 X 서울관광재단, "서울의 숨은 매력 찾기" 캠페인 성료',
    source: '여행신문',
    date: '2025.12.20',
    link: '#'
  },
  {
    id: 5,
    category: 'REPORT',
    title: '2025년 여행 트렌드 리포트: "현지 밀착형 여행"의 급부상',
    source: 'Locally Insights',
    date: '2025.12.05',
    link: '#'
  }
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#222222]">
      <SiteHeader />

      <main className="max-w-[1000px] mx-auto px-6 py-20">
        {/* 헤더 */}
        <div className="mb-20">
            <div className="text-sm font-bold text-[#717171] mb-2 uppercase tracking-wider">Newsroom</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">뉴스</h1>
            <p className="text-lg text-[#717171] font-light max-w-2xl">
                Locally의 언론 보도와 공식 소식을 전해드립니다.
            </p>
        </div>

        {/* 뉴스 리스트 (텍스트 중심) */}
        <div className="space-y-0">
          {NEWS_ITEMS.map((item) => (
            <a 
              key={item.id} 
              href={item.link} 
              className="group block border-t border-[#DDDDDD] py-10 hover:bg-gray-50 transition-colors -mx-4 px-4 rounded-xl"
            >
              <div className="flex flex-col md:flex-row md:items-baseline gap-4 md:gap-8">
                {/* 왼쪽: 날짜 & 카테고리 */}
                <div className="md:w-48 flex-shrink-0">
                  <span className="block text-xs font-bold tracking-widest mb-1 text-[#222222]">{item.category}</span>
                  <span className="text-sm text-[#717171] font-light">{item.date}</span>
                </div>

                {/* 오른쪽: 제목 & 출처 */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-3 leading-snug group-hover:underline decoration-2 underline-offset-4 decoration-black">
                    {item.title}
                  </h2>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#717171] font-medium">{item.source}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-[-10px] group-hover:translate-x-0">
                        <ArrowRight size={20} strokeWidth={2} />
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))}
          {/* 하단 마감 선 */}
          <div className="border-t border-[#DDDDDD]"></div>
        </div>
      </main>
    </div>
  );
}