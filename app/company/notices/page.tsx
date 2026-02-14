'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { Plus, Minus } from 'lucide-react'; // 세련된 토글 아이콘

const NOTICES = [
  { 
    id: 1, 
    type: 'Update',
    title: '서비스 이용약관 개정 안내', 
    date: 'Feb 10, 2026', 
    content: '안녕하세요. Locally 팀입니다.\n\n투명한 서비스 운영을 위해 이용약관이 개정됩니다.\n주요 변경 사항은 위치기반 서비스 사업자 정보 현행화입니다.\n\n시행일: 2026년 2월 20일'
  },
  { 
    id: 2, 
    type: 'Event',
    title: '신규 지역 "부산" 오픈 및 런칭 프로모션', 
    date: 'Jan 20, 2026', 
    content: '부산 지역 서비스가 공식 오픈되었습니다.\n지금 부산의 로컬 호스트들을 만나보세요.\n\n오픈 기념으로 2월 한 달간 수수료 면제 혜택을 드립니다.'
  },
  { 
    id: 3, 
    type: 'Notice',
    title: '시스템 정기 점검 안내', 
    date: 'Jan 05, 2026', 
    content: '더 안정적인 서비스를 위해 서버 점검이 진행됩니다.\n새벽 시간대(02:00~04:00) 일시적인 접속 불안정이 발생할 수 있습니다.'
  },
];

export default function NoticesPage() {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-6 py-24">
        {/* 헤더: 아주 크고 심플하게 */}
        <div className="mb-20">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
            Notices
          </h1>
          <p className="text-lg text-[#717171] font-medium max-w-xl">
            Locally의 중요한 소식들을 전해드립니다.
          </p>
        </div>
        
        {/* 리스트: 선 위주의 디자인 */}
        <div className="border-t border-black">
          {NOTICES.map((notice) => (
            <div key={notice.id} className="border-b border-[#EBEBEB] group">
              <button 
                onClick={() => setOpenId(openId === notice.id ? null : notice.id)}
                className="w-full py-10 flex flex-col md:flex-row md:items-baseline text-left hover:bg-[#F7F7F7] transition-colors -mx-6 px-6 rounded-xl"
              >
                {/* 왼쪽: 날짜 (고정폭) */}
                <div className="md:w-48 mb-2 md:mb-0 shrink-0">
                  <span className="text-sm font-semibold text-[#717171] tracking-wide uppercase">
                    {notice.date}
                  </span>
                </div>

                {/* 가운데: 제목 & 태그 */}
                <div className="flex-1 pr-8">
                  <div className="mb-2">
                    <span className="text-xs font-bold border border-black px-2 py-1 rounded-full uppercase tracking-wider">
                      {notice.type}
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight group-hover:underline underline-offset-4 decoration-2">
                    {notice.title}
                  </h3>
                </div>

                {/* 오른쪽: 아이콘 */}
                <div className="hidden md:block pt-2">
                  {openId === notice.id ? <Minus size={24} /> : <Plus size={24} />}
                </div>
              </button>
              
              {/* 내용 펼침: 여백을 충분히 줌 */}
              <div className={`overflow-hidden transition-all duration-500 ease-out ${openId === notice.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pl-6 md:pl-52 pr-6 pb-12 pt-2">
                  <p className="text-base md:text-lg leading-relaxed text-[#484848] whitespace-pre-wrap font-normal">
                    {notice.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}