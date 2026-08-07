'use client';

import React, { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import {
  Search, ChevronDown, ChevronUp, MessageCircle, Mail,
  User, Briefcase, CreditCard, ShieldCheck, MapPin, Calendar, ArrowLeft, PhoneCall
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { useViewMode } from '@/app/context/ViewModeContext';
import { useAuth } from '@/app/context/AuthContext';
import { useLocallyMembership } from '@/app/hooks/useLocallyMembership';
import { OFFICIAL_SUPPORT_EMAIL } from '@/app/utils/officialSender';
import {
  HELP_FAQ_CONTENT,
  type HelpFaqIconKey,
  type HelpTab,
} from '@/app/help/faqContent';
import { DesktopRightRailAdLayout } from '@/app/components/DesktopRightRailAdSlot';
import SupportInquiryFlow from '@/app/components/support/SupportInquiryFlow';
import { getSupportInquiryCopy } from '@/app/components/support/supportInquiryCopy';

const getCategoryIcon = (iconKey: HelpFaqIconKey) => {
  const size = 24;
  const strokeWidth = 1.5;

  switch (iconKey) {
    case 'prebooking':
      return <MapPin size={size} strokeWidth={strokeWidth} />;
    case 'payment':
    case 'payout':
      return <CreditCard size={size} strokeWidth={strokeWidth} />;
    case 'message':
      return <MessageCircle size={size} strokeWidth={strokeWidth} />;
    case 'cancellation':
    case 'policy':
      return <ShieldCheck size={size} strokeWidth={strokeWidth} />;
    case 'service':
    case 'review':
    case 'jobs':
      return <Briefcase size={size} strokeWidth={strokeWidth} />;
    case 'matching':
    case 'operation':
      return <Calendar size={size} strokeWidth={strokeWidth} />;
    case 'proxy':
      return <PhoneCall size={size} strokeWidth={strokeWidth} />;
    case 'care':
    case 'account':
    case 'profile':
    default:
      return <User size={size} strokeWidth={strokeWidth} />;
  }
};

export default function HelpCenterPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { hasLocallyCare } = useLocallyMembership(user?.id);
  const supportCopy = getSupportInquiryCopy(lang);
  const { isHostView } = useViewMode();
  const [activeTab, setActiveTab] = useState<HelpTab>(
    isHostView ? 'host' : 'guest'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- view-mode changes intentionally reset the FAQ audience.
    setActiveTab(isHostView ? 'host' : 'guest');
  }, [isHostView]);

  const faqContent = HELP_FAQ_CONTENT[lang];
  const activeCategories = faqContent[activeTab];
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const toggleItem = (categoryId: string, itemId: string) => {
    const key = `${categoryId}-${itemId}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter changes intentionally collapse stale FAQ disclosures.
    setOpenItems({});
  }, [activeTab, normalizedSearchTerm]);

  const filteredData = useMemo(() => {
    return activeCategories
      .map((category) => ({
        ...category,
        items: normalizedSearchTerm
          ? category.items.filter((item) =>
              [item.q, item.a, ...item.searchTerms].some((value) =>
                value.toLowerCase().includes(normalizedSearchTerm)
              )
            )
          : category.items,
      }))
      .filter((category) => category.items.length > 0);
  }, [activeCategories, normalizedSearchTerm]);

  const handleFeaturedTopicClick = (topic: { query: string; tab: HelpTab }) => {
    setActiveTab(topic.tab);
    setSearchTerm(topic.query);
  };

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(isHostView ? '/host/menu' : '/account');
  };

  return (
    <SupportInquiryFlow>
      {({ openInquiry }) => (
      <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />

      <DesktopRightRailAdLayout>
        <main
          data-testid="help-main-content"
          className="max-w-[1040px] mx-auto w-full px-4 md:px-6 py-9 md:py-24"
        >
        <div className="md:hidden mb-4">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label={t('button_back')}
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* 헤더 섹션 (뉴스룸 스타일) */}
        <div className="text-center mb-10 md:mb-24">
          <h1 className="text-[32px] md:text-6xl lg:text-8xl font-black tracking-tighter leading-tight mb-3 md:mb-8">
            {t('help_title')}
          </h1>
          <div className="relative max-w-2xl mx-auto group">
            <input
              type="text"
              placeholder={t('help_search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 md:h-16 pl-3.5 md:pl-6 pr-11 md:pr-14 bg-white border-b-2 border-gray-300 rounded-none text-[15px] md:text-2xl font-bold placeholder:text-gray-300 focus:outline-none focus:border-black transition-colors"
            />
            <button className="absolute right-0 top-1/2 -translate-y-1/2 p-2">
              <Search className="w-6 h-6 md:w-7 md:h-7 text-gray-400 group-focus-within:text-black transition-colors" />
            </button>
          </div>
        </div>

        {/* 탭 전환 버튼 */}
        <div className="flex justify-center mb-8 md:mb-20">
          <div className="flex gap-4 md:gap-8 border-b border-gray-200 pb-1">
            <button
              onClick={() => setActiveTab('guest')}
              className={`text-sm md:text-lg font-bold pb-3 md:pb-4 transition-all relative ${activeTab === 'guest' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t('tab_guest')}
              {activeTab === 'guest' && <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-black"></span>}
            </button>
            <button
              onClick={() => setActiveTab('host')}
              className={`text-sm md:text-lg font-bold pb-3 md:pb-4 transition-all relative ${activeTab === 'host' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t('tab_host')}
              {activeTab === 'host' && <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-black"></span>}
            </button>
          </div>
        </div>

        <div
          data-testid="help-featured-topics"
          className="mx-auto mb-8 max-w-4xl rounded-3xl border border-slate-200 bg-white px-4 py-4 md:mb-12 md:px-6 md:py-5"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 md:text-[12px]">
              {faqContent.featuredTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {faqContent.featuredTopics.map((topic) => {
                const isActive = activeTab === topic.tab && normalizedSearchTerm === topic.query.toLowerCase();

                return (
                  <button
                    key={topic.id}
                    type="button"
                    data-testid={`help-featured-topic-${topic.id}`}
                    onClick={() => handleFeaturedTopicClick(topic)}
                    className={`rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors md:text-[13px] ${
                      isActive
                        ? 'border-black bg-black text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {topic.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          data-testid="help-inbox-reply-strip"
          className="mx-auto mb-8 md:mb-12 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center"
        >
          <p className="text-[12px] font-medium text-slate-700 md:text-[14px]">
            {t('help_inbox_reply_notice')}
          </p>
        </div>

        {/* FAQ 리스트 */}
        {filteredData.length === 0 ? (
          <div
            data-testid="help-search-empty-state"
            className="mx-auto max-w-3xl rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"
          >
            <h2 className="text-[18px] font-black tracking-tight text-slate-900 md:text-2xl">
              {t('help_search_empty_title')}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-slate-500 md:text-[15px]">
              {t('help_search_empty_desc')}
            </p>
            <button
              type="button"
              onClick={openInquiry}
              data-testid="help-search-empty-cta"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-800"
            >
              {t('help_search_empty_cta')}
            </button>
          </div>
        ) : (
          <div className="space-y-9 md:space-y-20">
            {filteredData.map((category) => (
              <div key={category.id} data-testid={`help-category-${category.id}`}>
                {/* 카테고리 제목 */}
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-8 border-b border-black pb-2.5 md:pb-4">
                  <span className="p-1.5 md:p-2 border border-black rounded-full">{getCategoryIcon(category.icon)}</span>
                  <h2 className="text-[16px] md:text-2xl font-bold tracking-tight">{category.label}</h2>
                </div>

                {/* 질문 목록 */}
                <div className="space-y-0">
                  {category.items.map((item) => {
                    const itemKey = `${category.id}-${item.id}`;
                    const isOpen = openItems[itemKey];
                    return (
                      <div key={item.id} className="border-b border-gray-200">
                        <button
                          onClick={() => toggleItem(category.id, item.id)}
                          className="w-full py-4 md:py-6 flex justify-between items-start text-left group hover:bg-gray-50 transition-colors px-4 -mx-4 rounded-lg"
                        >
                          <span className="text-[13px] md:text-lg font-medium text-[#222222] pr-6 md:pr-8 group-hover:underline decoration-2 underline-offset-4">{item.q}</span>
                          <div className="pt-1 text-gray-400 group-hover:text-black transition-colors">
                            {isOpen ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                          </div>
                        </button>

                        {/* 답변 내용 */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[48rem] opacity-100 pb-6 md:pb-8' : 'max-h-0 opacity-0'}`}>
                          <div className="max-w-3xl whitespace-pre-line px-4 text-[14px] font-light leading-relaxed text-[#484848] md:text-base">
                            {item.a}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 하단 지원 섹션 */}
        <div className="mt-20 md:mt-32 bg-[#F7F7F7] p-7 md:p-16 text-center rounded-2xl">
          <h3 className="text-[18px] md:text-3xl font-black mb-2.5 md:mb-4 tracking-tight">{t('help_bottom_title')}</h3>
          <p className="text-[#717171] text-[13px] md:text-base mb-7 md:mb-10 max-w-md mx-auto font-medium">
            {t('help_bottom_desc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-6">
            <button
              type="button"
              onClick={openInquiry}
              data-testid="help-contact-modal-trigger"
              className="rounded-full bg-slate-900 px-6 md:px-8 py-3 md:py-3.5 text-[12px] md:text-[13px] font-semibold text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2.5 md:gap-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
            >
              <MessageCircle size={18} /> {hasLocallyCare ? t('locally_care_cta') : t('btn_chat_support')}
            </button>
            <a
              data-testid="help-public-support-email"
              href={`mailto:${OFFICIAL_SUPPORT_EMAIL}?subject=${encodeURIComponent('Locally Support')}`}
              className="rounded-full bg-white border border-slate-200 text-slate-700 px-6 md:px-8 py-3 md:py-3.5 text-[12px] md:text-[13px] font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2.5 md:gap-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
            >
              <Mail size={18} /> {t('btn_email_us')}
            </a>
          </div>
          <p
            data-testid="help-public-support-email-note"
            className="mt-4 text-[12px] font-medium text-slate-500"
          >
            {supportCopy.supportEmailNote}: {OFFICIAL_SUPPORT_EMAIL}
          </p>
          <p className="mt-2 text-[12px] font-medium text-slate-500">
            {t('help_inbox_reply_notice')}
          </p>
        </div>
        </main>
      </DesktopRightRailAdLayout>

      </div>
      )}
    </SupportInquiryFlow>
  );
}
