'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';

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
  const router = useRouter();
  const { t } = useLanguage();

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
      
      <main className="max-w-[1040px] mx-auto px-4 md:px-6 py-12 md:py-24">
        <div className="md:hidden mb-6">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label={t('button_back')}
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-24 border-b border-black pb-6 md:pb-8">
          <div>
            <h1 className="text-3xl md:text-8xl font-black tracking-tighter mb-2">
              Newsroom
            </h1>
          </div>
          <p className="text-left md:text-right text-[#717171] font-medium mt-3 md:mt-0 text-sm md:text-base">
            Press & Media Coverage
          </p>
        </div>

        {/* 뉴스 리스트 */}
        <div className="flex flex-col">
          {NEWS_ITEMS.map((item) => (
            <article
              key={item.id}
              data-testid="company-news-item"
              className="py-12 border-b border-[#EBEBEB] block"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6">
                
                {/* 내용 영역 */}
                <div className="flex-1 max-w-3xl">
                  <div className="flex items-center gap-3 mb-2 md:mb-3 text-[11px] md:text-sm font-bold tracking-widest uppercase">
                    <span className="text-black">{item.source}</span>
                    <span className="w-1 h-1 bg-[#DDDDDD] rounded-full"></span>
                    <span className="text-[#999999] font-medium">{item.date}</span>
                  </div>
                  
                  <h2 className="text-xl md:text-4xl font-bold leading-tight tracking-tight">
                    {item.title}
                  </h2>
                </div>

                {/* 운영 문서상 링크 owner가 아직 없으므로 읽기 preview로만 노출 */}
                <div className="mt-2 md:mt-0">
                  <span
                    data-testid="company-news-preview-badge"
                    className="inline-flex items-center rounded-full border border-[#DDDDDD] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#717171]"
                  >
                    Archive preview
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p
          data-testid="company-news-availability-note"
          className="mt-16 text-center text-sm font-medium text-[#717171]"
        >
          External article links are being organized and will be added here after verification.
        </p>
      </main>
    </div>
  );
}
