'use client';

import React, { useEffect, useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import Link from 'next/link';
import { X } from 'lucide-react';
import { getLegalDocument, type LegalDocType } from '@/app/constants/legalDocuments';
import { useLanguage } from '@/app/context/LanguageContext';

type SitemapLink =
  | { name: string; href: string }
  | { name: string; legalDoc: LegalDocType };

type SitemapSection = {
  category: string;
  links: SitemapLink[];
};

const SITEMAP_LINKS: SitemapSection[] = [
  {
    category: 'Locally',
    links: [
      { name: '홈 (Home)', href: '/' },
      { name: '로컬리 소개 (About)', href: '/about' },
      { name: '공지사항 (Notices)', href: '/company/notices' },
      { name: '뉴스룸 (News)', href: '/company/news' },
      { name: '채용 정보 (Careers)', href: '/company/careers' },
      { name: '투자자 정보 (Investors)', href: '/company/investors' },
      { name: '제휴 문의 (Partnership)', href: '/company/partnership' },
    ],
  },
  {
    category: 'Hosting',
    links: [
      { name: '호스트 되기', href: '/become-a-host' },
    ],
  },
  {
    category: 'Explore',
    links: [
      { name: '체험 검색', href: '/search' },
      { name: '현지 동행 서비스 소개', href: '/services/intro' },
      { name: '로컬리 콘텐츠', href: '/community' },
    ],
  },
  {
    category: 'Support',
    links: [
      { name: '도움말 센터', href: '/help' },
      { name: '1:1 문의하기', href: '/help' },
    ],
  },
  {
    category: 'Legal',
    links: [
      { name: '이용약관', legalDoc: 'terms' },
      { name: '개인정보 처리방침', legalDoc: 'privacy' },
      { name: '여행약관', legalDoc: 'travel' },
      { name: '취소 및 환불 정책', legalDoc: 'refund' },
    ],
  },
];

export default function SitemapPage() {
  const { lang } = useLanguage();
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);
  const modalData = activeLegalDoc ? getLegalDocument(lang, activeLegalDoc) : null;

  useEffect(() => {
    document.body.style.overflow = activeLegalDoc ? 'hidden' : 'unset';

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [activeLegalDoc]);

  return (
    <>
      <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white flex flex-col">
        <SiteHeader />

        <main className="flex-1 max-w-[1040px] mx-auto px-6 py-24 w-full">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-20">
            Sitemap
          </h1>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {SITEMAP_LINKS.map((section) => (
              <div key={section.category}>
                <h2 className="text-xl font-bold mb-6 border-b border-black pb-2">
                  {section.category}
                </h2>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {'href' in link ? (
                        <Link
                          href={link.href}
                          className="text-[#717171] hover:text-black hover:underline decoration-1 underline-offset-4 transition-colors font-medium block"
                        >
                          {link.name}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          data-testid={`site-map-legal-trigger-${link.legalDoc}`}
                          onClick={() => setActiveLegalDoc(link.legalDoc)}
                          className="text-[#717171] hover:text-black hover:underline decoration-1 underline-offset-4 transition-colors font-medium block text-left"
                        >
                          {link.name}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </main>
      </div>

      {activeLegalDoc && modalData && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          data-testid="site-map-legal-modal"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveLegalDoc(null)}
          />

          <div className="relative bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0 bg-white z-10">
              <h2 className="text-xl font-bold text-black tracking-tight">{modalData.title}</h2>
              <button
                type="button"
                onClick={() => setActiveLegalDoc(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-black"
                aria-label="Close legal document"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              {modalData.fallbackNotice && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-relaxed text-amber-900">
                  {modalData.fallbackNotice}
                </div>
              )}
              <div className="prose prose-sm max-w-none text-[#484848] whitespace-pre-wrap leading-relaxed font-light">
                {modalData.body}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
