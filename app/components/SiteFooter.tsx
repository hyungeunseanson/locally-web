'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Instagram, ChevronDown, ChevronUp, X } from 'lucide-react';
// ❗ 아래 경로는 아까 만드신 파일 위치와 정확히 일치해야 합니다.
import { TERMS_OF_USE, PRIVACY_POLICY, TRAVEL_TERMS, REFUND_POLICY } from '@/app/constants/legalText';
import { useLanguage } from '@/app/context/LanguageContext';

export default function SiteFooter() {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const [instaOpen, setInstaOpen] = useState(false);


  // 모달 상태 관리 ('terms', 'privacy', 'travel', 'refund', null)
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // 모달 열렸을 때 배경 스크롤 막기 (UX 필수)
  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [activeModal]);

  // 선택된 모달에 따른 제목과 내용 가져오기
  const getModalContent = () => {
    switch (activeModal) {
      case 'terms': return { title: '이용약관', content: TERMS_OF_USE };
      case 'privacy': return { title: '개인정보 처리방침', content: PRIVACY_POLICY };
      case 'travel': return { title: '여행약관 (국내/국외)', content: TRAVEL_TERMS };
      case 'refund': return { title: '취소 및 환불 정책', content: REFUND_POLICY };
      default: return null;
    }
  };

  const modalData = getModalContent();
  // 🟢 [추가] 현재 언어 코드(lang)를 화면에 표시할 텍스트로 변환
  const getLanguageLabel = () => {
    switch (lang) {
      case 'en': return 'English (US)';
      case 'ja': return '日本語 (JP)';
      case 'zh': return '中文 (CN)';
      case 'ko':
      default: return '한국어 (KR)';
    }
  };

  return (
    <>
      <footer className="hidden md:block bg-white border-t border-[#DDDDDD] pt-12 pb-6 text-sm text-[#222222] font-sans">
        <div className="max-w-[1760px] mx-auto px-12">

          {/* 상단 링크 모음 (4단 그리드, 좌측 정렬) */}
          <div className="grid grid-cols-4 gap-8 mb-10">

            {/* 1. 로컬리 지원 */}
            <div className="space-y-4">
              <h5 className="font-bold">{t('footer_support')}</h5>
              <ul className="space-y-3 text-[#717171] font-light">
                <li><Link href="/about" className="hover:underline">{t('footer_intro')}</Link></li>
                <li><Link href="/company/notices" className="hover:underline">{t('footer_notice')}</Link></li>
                <li><Link href="/help" className="hover:underline">{t('footer_help')}</Link></li>
              </ul>
            </div>

            {/* 2. 호스팅 */}
            <div className="space-y-4">
              <h5 className="font-bold">{t('footer_hosting')}</h5>
              <ul className="space-y-3 text-[#717171] font-light">
                <li><Link href="/become-a-host" className="hover:underline">{t('footer_become_host')}</Link></li>
                <li><Link href="/community" className="hover:underline">{t('footer_community')}</Link></li>
              </ul>
            </div>

            {/* 3. 로컬리 */}
            <div className="space-y-4">
              <h5 className="font-bold">{t('footer_locally')}</h5>
              <ul className="space-y-3 text-[#717171] font-light">
                <li><Link href="/company/news" className="hover:underline">{t('footer_news')}</Link></li>
                <li><Link href="/company/careers" className="hover:underline">{t('footer_careers')}</Link></li>
                <li><Link href="/company/investors" className="hover:underline">{t('footer_investors')}</Link></li>
                <li><Link href="/company/partnership" className="hover:underline">{t('footer_partnership')}</Link></li>
              </ul>
            </div>

            {/* 4. 소셜 미디어 */}
            <div className="space-y-4">
              <h5 className="font-bold">{t('footer_social')}</h5>
              <ul className="space-y-3 text-[#717171] font-light relative">

                {/* 인스타그램 (다중 계정 팝업) */}
                <li className="relative">
                  <button
                    onClick={() => setInstaOpen(!instaOpen)}
                    className="hover:text-black flex items-center gap-1 focus:outline-none transition-colors"
                  >
                    <Instagram size={16} /> Instagram
                    {instaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {instaOpen && (
                    <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="py-1">
                        <a href="https://www.instagram.com/locally.official/" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs text-gray-600 hover:text-black">
                          Locally Official (KR)
                        </a>
                        <a href="https://www.instagram.com/locally.experience/" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs text-gray-600 hover:text-black">
                          Locally Experience (KR)
                        </a>
                        <a href="https://www.instagram.com/locally.japan/" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs text-gray-600 hover:text-black">
                          Locally Japan (JP)
                        </a>
                        <a href="https://www.instagram.com/locally.partners/" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs text-gray-600 hover:text-black">
                          Locally Partners (EN)
                        </a>
                      </div>
                    </div>
                  )}
                </li>

                {/* 네이버 블로그 */}
                <li>
                  <Link
                    href="https://blog.naver.com/locally-travel"
                    rel="noopener noreferrer"
                    className="hover:text-black flex items-center gap-2 group text-[#717171] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-black transition-colors">
                      <path d="M3 3h4l10 18h4" /> <path d="M3 3v18" /> <path d="M21 3v18" />
                    </svg>
                    <span>Naver Blog</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-[#DDDDDD]"></div>

          {/* 중단: 저작권 및 약관 링크 (좌측 정렬) */}
          <div className="py-5 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs text-[#717171]">
            <span>{t('copyright')}</span>

            <span className="mx-1">·</span>
            <button onClick={() => setActiveModal('privacy')} className="hover:underline hover:text-black transition-colors font-bold">
              {t('footer_privacy')}
            </button>

            <span className="mx-1">·</span>
            <button onClick={() => setActiveModal('terms')} className="hover:underline hover:text-black transition-colors">
              {t('footer_terms')}
            </button>

            <span className="mx-1">·</span>
            <button onClick={() => setActiveModal('travel')} className="hover:underline hover:text-black transition-colors">
              {t('footer_travel_terms')}
            </button>

            <span className="mx-1">·</span>
            <button onClick={() => setActiveModal('refund')} className="hover:underline hover:text-black transition-colors">
              {t('footer_refund')}
            </button>

            <span className="mx-1">·</span>
            <Link href="/site-map" className="hover:underline hover:text-black transition-colors">
              {t('footer_sitemap')}
            </Link>

            <span className="mx-1">·</span>
            {/* 언어 선택 (우측 끝이 아닌 인라인 배치) */}
            <button className="flex items-center gap-1 hover:underline font-bold text-[#222222]">
              <Globe size={12} />
              {getLanguageLabel()}
            </button>
          </div>

          {/* 구분선 */}
          <div className="border-t border-[#DDDDDD]"></div>

          {/* 최하단: 사업자 정보 (아주 작게, 좌측 정렬) */}
          <div className="pt-3 text-[#aaaaaa] leading-normal" style={{ fontSize: '9px' }}>
            로컬리 (Locally) | 대표자 : 손현근 | 개인정보보호책임자 : Nishimura Mayu | 사업자등록번호 : 367-53-00874 | 통신판매업 : 2024-제주일도일-0021 | 주소 : 제주특별자치도 제주시 동문로 16, 2층 31호(일도일동, 동문시장(주)) | 이메일 : locally.partners@gmail.com
          </div>
        </div>
      </footer>

      {/* 🟢 약관 모달 (전역 오버레이) */}
      {activeModal && modalData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* 배경 (클릭 시 닫힘) */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveModal(null)}
          ></div>

          {/* 모달 컨텐츠 */}
          <div className="relative bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0 bg-white z-10">
              <h2 className="text-xl font-bold text-black tracking-tight">{modalData.title}</h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-black"
              >
                <X size={24} />
              </button>
            </div>

            {/* 내용 (스크롤 영역) */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              <div className="prose prose-sm max-w-none text-[#484848] whitespace-pre-wrap leading-relaxed font-light">
                {modalData.content}
              </div>
            </div>

            {/* 하단 (선택 사항: 닫기 버튼) */}
            <div className="p-4 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-black text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors shadow-lg"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
