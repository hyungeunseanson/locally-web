'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Globe, Instagram, ChevronDown, ChevronUp } from 'lucide-react';

export default function SiteFooter() {
  const [instaOpen, setInstaOpen] = useState(false);

  return (
    <footer className="bg-white border-t border-gray-200 pt-12 pb-8 text-sm text-[#222222]">
      <div className="max-w-[1440px] mx-auto px-6">
        
        {/* 상단 링크 모음 (4단 그리드) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          
{/* 1. 로컬리 지원 */}
<div className="space-y-4">
            <h5 className="font-bold">로컬리 지원</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              <li><Link href="/about" className="hover:underline">로컬리 소개</Link></li>
              {/* 경로 수정됨 */}
              <li><Link href="/company/notices" className="hover:underline">공지사항</Link></li> 
              <li><Link href="/help" className="hover:underline">도움말 센터</Link></li>
              <li><Link href="/admin/dashboard" className="hover:underline">Admin</Link></li>
            </ul>
          </div>

          {/* 2. 호스팅 */}
          <div className="space-y-4">
            <h5 className="font-bold">호스팅</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              <li><Link href="/become-a-host" className="hover:underline">호스트 되기</Link></li>
              {/* 경로 수정됨 */}
              <li><Link href="/company/community" className="hover:underline">커뮤니티 포럼</Link></li>
            </ul>
          </div>

          {/* 3. 로컬리 */}
          <div className="space-y-4">
            <h5 className="font-bold">로컬리</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              {/* 경로 수정됨 */}
              <li><Link href="/company/news" className="hover:underline">뉴스</Link></li>
              <li><Link href="/company/careers" className="hover:underline">채용 정보</Link></li>
              <li><Link href="/company/investors" className="hover:underline">투자자 정보</Link></li>
              <li><Link href="/company/partnership" className="hover:underline">제휴 문의</Link></li>
            </ul>
          </div>

          {/* 4. 소셜 미디어 */}
          <div className="space-y-4">
            <h5 className="font-bold">소셜</h5>
            <ul className="space-y-3 text-[#717171] font-light relative">
              
              {/* 인스타그램 (다중 계정 팝업) */}
              <li className="relative">
                <button 
                  onClick={() => setInstaOpen(!instaOpen)}
                  className="hover:underline flex items-center gap-1 focus:outline-none"
                >
                  <Instagram size={16}/> Instagram 
                  {instaOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                
                {/* 팝업 메뉴 */}
                {instaOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="py-1">
                      <a href="https://www.instagram.com/locally.official/" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs">
                        Locally Official (KR)
                      </a>
                      <a href="https://www.instagram.com/locally.experience/" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs">
                        Locally Experience (KR)
                      </a>
                      <a href="https://www.instagram.com/locally.japan/" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs">
                        Locally Japan (JP)
                      </a>
                      <a href="https://www.instagram.com/locally.partners/" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 hover:bg-gray-50 text-xs">
                        Locally Partners (EN)
                      </a>
                    </div>
                  </div>
                )}
              </li>

{/* 네이버 블로그 아이콘 (커스텀 SVG) */}
<li>
                <Link 
                  href="https://blog.naver.com/locally-travel" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-black flex items-center gap-2 group text-[#717171]"
                  title="Naver Blog"
                >
                  {/* 직접 만든 네이버 아이콘 (N자) */}
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="group-hover:stroke-black transition-colors"
                  >
                    <path d="M3 3h4l10 18h4" /> {/* N자 모양 */}
                    <path d="M3 3v18" />
                    <path d="M21 3v18" />
                  </svg>
                  <span className="group-hover:underline">Naver Blog</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-200 my-8"></div>

        {/* 하단: 저작권 및 설정 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[#717171]">
          <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm">
            <span>© 2026 Locally, Inc.</span>
            <span className="hidden md:inline">·</span>
            <Link href="#" className="hover:underline">개인정보 처리방침</Link>
            <span className="hidden md:inline">·</span>
            <Link href="#" className="hover:underline">이용약관</Link>
            <span className="hidden md:inline">·</span>
            <Link href="#" className="hover:underline">사이트맵</Link>
          </div>
          
          <div className="flex items-center gap-6 font-bold text-[#222222]">
            <button className="flex items-center gap-2 hover:underline">
              <Globe size={16} />
              한국어 (KR)
            </button>
            <button className="hover:underline">
              ₩ KRW
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}