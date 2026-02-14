'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';

const NEWS_ITEMS = [
  {
    id: 1,
    tag: 'PRESS',
    title: '로컬리, 시리즈 A 투자 유치 성공... 글로벌 확장 가속화',
    desc: '현지 체험 플랫폼 로컬리가 2026년 상반기 대규모 투자를 유치하며 일본 및 동남아 시장 진출에 박차를 가한다. 이번 투자는 글로벌 벤처 캐피탈이 주도했다.',
    date: '2026.02.14',
    imageIndex: 1
  },
  {
    id: 2,
    tag: 'INTERVIEW',
    title: '"여행은 살아보는 것" 로컬리 CEO가 말하는 여행의 미래',
    desc: '단순한 관광을 넘어 현지인과 소통하고 그들의 삶을 체험하는 것. 로컬리가 그리는 여행의 새로운 패러다임을 들어봤다.',
    date: '2026.01.28',
    imageIndex: 2
  },
  {
    id: 3,
    tag: 'UPDATE',
    title: '로컬리 앱 3.0 업데이트: AI 기반 맞춤형 여행 추천 기능 도입',
    desc: '사용자의 취향을 분석하여 최적의 현지 체험을 추천해주는 AI 큐레이션 기능이 추가되었다. 더욱 스마트해진 로컬리를 만나보자.',
    date: '2026.01.10',
    imageIndex: 3
  },
  {
    id: 4,
    tag: 'EVENT',
    title: '로컬리 X 서울관광재단, "서울의 숨은 매력 찾기" 캠페인 진행',
    desc: '서울의 골목골목 숨겨진 명소를 소개하고 체험하는 캠페인이 시작된다. 참여자에게는 다양한 경품이 제공된다.',
    date: '2025.12.20',
    imageIndex: 4
  }
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      
      {/* 헤더 섹션 */}
      <div className="bg-slate-50 border-b border-slate-100 py-20 px-6 text-center">
        <span className="text-blue-600 font-bold text-sm tracking-widest uppercase mb-3 block">Newsroom</span>
        <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-slate-900">Locally News</h1>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">
          로컬리의 성장 스토리와 미디어 보도 자료를 모았습니다.
        </p>
      </div>

      {/* 뉴스 그리드 섹션 */}
      <div className="flex-1 max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-12">
          {NEWS_ITEMS.map((item) => (
            <article key={item.id} className="group cursor-pointer flex flex-col h-full">
              {/* 이미지 영역 */}
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 mb-6 shadow-sm group-hover:shadow-md transition-all duration-300">
                <Image 
                  src={`https://images.unsplash.com/photo-${item.imageIndex === 1 ? '1504609773096-104ff10587a4' : item.imageIndex === 2 ? '1526772662003-6eb4a4c394ae' : item.imageIndex === 3 ? '1469854523086-cc02fe5d8800' : '1476514525535-07fb3b4ae5f1'}?auto=format&fit=crop&w=800&q=80`} 
                  alt={item.title}
                  fill 
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-white/90 backdrop-blur-sm text-xs font-bold px-3 py-1.5 rounded-full shadow-sm text-slate-800">
                    {item.tag}
                  </span>
                </div>
              </div>

              {/* 텍스트 영역 */}
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">{item.date}</span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:text-white transition-colors duration-300">
                    <ArrowUpRight size={16} />
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 leading-snug group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4">
                  {item.desc}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}