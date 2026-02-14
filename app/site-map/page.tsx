'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter'; // 푸터 import 추가
import Link from 'next/link';

const SITEMAP_LINKS = [
  {
    category: 'Locally',
    links: [
      { name: '홈 (Home)', url: '/' },
      { name: '로컬리 소개 (About)', url: '/about' },
      { name: '공지사항 (Notices)', url: '/company/notices' },
      { name: '뉴스룸 (News)', url: '/company/news' },
      { name: '채용 정보 (Careers)', url: '/company/careers' },
      { name: '투자자 정보 (Investors)', url: '/company/investors' },
      { name: '제휴 문의 (Partnership)', url: '/company/partnership' },
    ]
  },
  {
    category: 'Hosting',
    links: [
      { name: '호스트 되기', url: '/become-a-host' },
      { name: '커뮤니티 포럼', url: '/company/community' },
      { name: '호스트 대시보드', url: '/host/dashboard' },
    ]
  },
  {
    category: 'Support',
    links: [
      { name: '도움말 센터', url: '/help' },
      { name: '1:1 문의하기', url: '/help' }, // 도움말 센터 내 기능으로 연결
    ]
  },
  {
    category: 'Legal',
    links: [
      { name: '이용약관', url: '#' }, // 푸터 모달과 동일하게 처리하거나 별도 페이지 연결
      { name: '개인정보 처리방침', url: '#' },
      { name: '여행약관', url: '#' },
      { name: '취소 및 환불 정책', url: '#' },
    ]
  }
];

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white flex flex-col">
      <SiteHeader />
      
      <main className="flex-1 max-w-[1040px] mx-auto px-6 py-24 w-full">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-20">
          Sitemap
        </h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {SITEMAP_LINKS.map((section, idx) => (
            <div key={idx}>
              <h2 className="text-xl font-bold mb-6 border-b border-black pb-2">
                {section.category}
              </h2>
              <ul className="space-y-4">
                {section.links.map((link, i) => (
                  <li key={i}>
                    <Link 
                      href={link.url} 
                      className="text-[#717171] hover:text-black hover:underline decoration-1 underline-offset-4 transition-colors font-medium block"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      {/* 푸터 import는 빼라고 하셨었지만, 이 페이지는 전체 구조를 보여주는 페이지라 
          푸터가 있어도 어색하지 않습니다. 만약 빼고 싶으시면 아래 줄 삭제하세요. */}
      {/* <SiteFooter /> */}
    </div>
  );
}