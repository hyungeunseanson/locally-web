'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { Plus, Minus, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { COMPANY_NOTICES, getCompanyNoticeCopy } from '@/app/config/companyNotices';

export default function NoticesPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const router = useRouter();
  const { t, lang } = useLanguage();

  const handleMobileBack = () => {
    if (typeof window !== 'undefined') {
      const hasInternalReferrer = document.referrer.startsWith(window.location.origin);

      if (hasInternalReferrer && window.history.length > 1) {
        router.back();
        return;
      }
    }

    router.push('/about');
  };

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-4 md:px-6 py-12 md:py-24">
        <div className="md:hidden mb-6">
          <button
            data-testid="company-notices-back-button"
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label={t('button_back')}
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        {/* 헤더: 아주 크고 심플하게 */}
        <div className="mb-12 md:mb-20">
          <h1 className="text-3xl md:text-6xl font-black tracking-tighter mb-3 md:mb-4">
            {t('company_notices_heading')}
          </h1>
          <p className="text-sm md:text-lg text-[#717171] font-medium max-w-xl">
            {t('company_notices_description')}
          </p>
        </div>
        
        {/* 리스트: 선 위주의 디자인 */}
        <div className="border-t border-black">
          {COMPANY_NOTICES.map((notice) => {
            const noticeCopy = getCompanyNoticeCopy(notice, lang);

            return (
              <div
                key={notice.id}
                data-testid="company-notice-item"
                className="border-b border-[#EBEBEB] group"
              >
                <button
                  data-testid={`company-notice-toggle-${notice.id}`}
                  onClick={() => setOpenId(openId === notice.id ? null : notice.id)}
                  className="w-full py-6 md:py-10 flex flex-col md:flex-row md:items-baseline text-left hover:bg-[#F7F7F7] transition-colors -mx-4 md:-mx-6 px-4 md:px-6 rounded-xl"
                >
                  {/* 왼쪽: 날짜 (고정폭) */}
                  <div className="md:w-48 mb-2 md:mb-0 shrink-0">
                    <span
                      data-testid={`company-notice-date-${notice.id}`}
                      className="text-[11px] md:text-sm font-semibold text-[#717171] tracking-wide uppercase"
                    >
                      {notice.dateLabel}
                    </span>
                  </div>

                  {/* 가운데: 제목 & 태그 */}
                  <div className="flex-1 pr-4 md:pr-8">
                    <div className="mb-2">
                      <span
                        data-testid={`company-notice-type-${notice.id}`}
                        className="text-[10px] md:text-xs font-bold border border-black px-2 py-1 rounded-full uppercase tracking-wider"
                      >
                        {noticeCopy.typeLabel}
                      </span>
                    </div>
                    <h3
                      data-testid={`company-notice-title-${notice.id}`}
                      className="text-xl md:text-3xl font-bold tracking-tight group-hover:underline underline-offset-4 decoration-2"
                    >
                      {noticeCopy.title}
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
                    <p
                      data-testid={`company-notice-content-${notice.id}`}
                      className="text-base md:text-lg leading-relaxed text-[#484848] whitespace-pre-wrap font-normal"
                    >
                      {noticeCopy.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
