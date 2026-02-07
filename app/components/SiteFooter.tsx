'use client';

import React from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 pt-12 pb-8 text-sm text-[#222222]">
      <div className="max-w-[1440px] mx-auto px-6">
        
        {/* 상단: 링크 모음 (PC에서는 4열, 모바일에서는 2열) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <h5 className="font-bold">에어비앤비 지원</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              <li><Link href="#" className="hover:underline">도움말 센터</Link></li>
              <li><Link href="#" className="hover:underline">에어커버</Link></li>
              <li><Link href="#" className="hover:underline">차별 금지</Link></li>
              <li><Link href="#" className="hover:underline">장애인 지원</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-bold">호스팅</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              <li><Link href="#" className="hover:underline">호스팅 시작하기</Link></li>
              <li><Link href="#" className="hover:underline">호스트를 위한 에어커버</Link></li>
              <li><Link href="#" className="hover:underline">커뮤니티 포럼</Link></li>
              <li><Link href="#" className="hover:underline">책임감 있는 호스팅</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-bold">로컬리</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              <li><Link href="#" className="hover:underline">뉴스룸</Link></li>
              <li><Link href="#" className="hover:underline">새로운 기능</Link></li>
              <li><Link href="#" className="hover:underline">채용 정보</Link></li>
              <li><Link href="#" className="hover:underline">투자자 정보</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="font-bold">소셜</h5>
            <ul className="space-y-3 text-[#717171] font-light">
              <li><Link href="#" className="hover:underline">Instagram</Link></li>
              <li><Link href="#" className="hover:underline">Twitter</Link></li>
              <li><Link href="#" className="hover:underline">Facebook</Link></li>
              <li><Link href="#" className="hover:underline">Naver Blog</Link></li>
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
            <span className="hidden md:inline">·</span>
            <Link href="#" className="hover:underline">한국 변경 내용</Link>
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