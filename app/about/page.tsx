'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Star, ShieldCheck, Globe, MessageCircle, Calendar, Settings } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// --- [FAQ Component] ---
function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-6 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">{question}</h3>
        {isOpen ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
      </div>
      {isOpen && <p className="mt-3 text-slate-600 leading-relaxed">{answer}</p>}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      {/* 1. 상단: 도입부 및 가치 제안 (스마트폰 앱 UI 배치) */}
      <section className="pt-40 pb-20 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
              좋아하는 것을<br/>
              <span className="text-rose-600">경험하세요.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
              당신의 취향, 당신의 속도대로. <br/>
              Locally 앱 하나로 전 세계의 특별한 호스트와 연결됩니다.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl transition-transform hover:scale-105">
                  앱 둘러보기
                </button>
              </Link>
            </div>
          </div>
          
          {/* 비주얼: 스마트폰 목업 (CSS로 구현) */}
          <div className="flex-1 flex justify-center lg:justify-end relative">
            <div className="relative w-[320px] h-[640px] bg-slate-900 rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden">
              {/* 앱 헤더 */}
              <div className="bg-white p-6 pb-2 border-b">
                <div className="font-black text-xl text-rose-600">Locally</div>
              </div>
              {/* 앱 콘텐츠 (체험 리스트) */}
              <div className="bg-slate-50 h-full p-4 space-y-4 overflow-hidden">
                <div className="bg-white p-3 rounded-2xl shadow-sm">
                  <div className="h-32 bg-slate-200 rounded-xl mb-3 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center"></div>
                  <div className="font-bold text-sm">성수동 카페 투어</div>
                  <div className="text-xs text-slate-500">호스트 Minji</div>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm">
                  <div className="h-32 bg-slate-200 rounded-xl mb-3 bg-[url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center"></div>
                  <div className="font-bold text-sm">북촌 한옥 스테이</div>
                  <div className="text-xs text-slate-500">호스트 Chulsoo</div>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm">
                  <div className="h-32 bg-slate-200 rounded-xl mb-3 bg-[url('https://images.unsplash.com/photo-1551918120-9739cb430c6d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center"></div>
                  <div className="font-bold text-sm">한강 선셋 요트</div>
                  <div className="text-xs text-slate-500">호스트 Captain Kim</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 중간: 체험의 다양성 및 강점 (이미지 그리드 & 텍스트) */}
      <section className="py-24 bg-slate-50 px-6">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">지역의 매력을 생생하게</h2>
            <p className="text-xl text-slate-500">Locally에서만 만날 수 있는 독창적인 경험들을 소개합니다.</p>
          </div>

          {/* 이미지 그리드 (다양한 활동) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <div className="relative h-96 rounded-3xl overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Activity" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
              <div className="absolute bottom-6 left-6 text-white font-bold text-2xl">하이킹 & 네이처</div>
            </div>
            <div className="relative h-96 rounded-3xl overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Activity" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
              <div className="absolute bottom-6 left-6 text-white font-bold text-2xl">요리 & 다이닝</div>
            </div>
            <div className="relative h-96 rounded-3xl overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Activity" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
              <div className="absolute bottom-6 left-6 text-white font-bold text-2xl">아트 & 컬처</div>
            </div>
          </div>

          {/* 신뢰도 강조 (아이콘) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center">
              <Globe className="w-12 h-12 text-rose-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">수천만 명의 게스트</h3>
              <p className="text-slate-500">전 세계 어디서나 Locally와 함께하는 여행자들이 있습니다.</p>
            </div>
            <div className="flex flex-col items-center">
              <Star className="w-12 h-12 text-rose-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">검증된 퀄리티</h3>
              <p className="text-slate-500">평점 4.8 이상의 엄선된 호스트들이 최고의 경험을 제공합니다.</p>
            </div>
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-12 h-12 text-rose-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">안전한 결제 시스템</h3>
              <p className="text-slate-500">예약부터 체험 종료까지 모든 결제 과정이 안전하게 보호됩니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 하단: 기술적 지원 및 도구 (관리 기능 UI 시각화) */}
      <section className="py-32 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              편리한 여행을 위한<br/>최고의 기능
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              복잡한 절차는 잊으세요. Locally 앱 하나로 예약 관리, 호스트와의 대화, 
              일정 확인까지 한 번에 해결할 수 있습니다.
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-full"><Calendar size={24} className="text-rose-600"/></div>
                <span className="font-bold text-lg">실시간 예약 및 일정 관리</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-full"><MessageCircle size={24} className="text-rose-600"/></div>
                <span className="font-bold text-lg">호스트와 다이렉트 메시지</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-full"><Settings size={24} className="text-rose-600"/></div>
                <span className="font-bold text-lg">간편한 결제 및 환불 설정</span>
              </li>
            </ul>
          </div>
          
          {/* UI Mockup (기능 보여주기) */}
          <div className="flex-1 bg-slate-100 rounded-[3rem] p-8 md:p-12">
            <div className="bg-white rounded-3xl shadow-lg p-6 space-y-6">
              {/* 메시지 UI 예시 */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 font-bold">M</div>
                <div>
                  <div className="font-bold">Minji Host</div>
                  <div className="text-xs text-slate-400">오후 2:30</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-100 p-3 rounded-tr-2xl rounded-bl-2xl rounded-br-2xl text-sm w-fit">
                  안녕하세요! 예약해주셔서 감사합니다. :)
                </div>
                <div className="bg-rose-50 text-rose-800 p-3 rounded-tl-2xl rounded-bl-2xl rounded-br-2xl text-sm w-fit ml-auto">
                  네, 당일 만남 장소가 어디인가요?
                </div>
              </div>
              {/* 캘린더 UI 예시 */}
              <div className="pt-4">
                <div className="font-bold mb-3 flex items-center gap-2 text-sm"><Calendar size={16}/> 다가오는 일정</div>
                <div className="bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
                  <div>
                    <div className="font-bold text-sm">성수동 카페 투어</div>
                    <div className="text-xs text-slate-500">10월 24일 (토) • 14:00</div>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">확정됨</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FAQ (자주 묻는 질문) */}
      <section className="py-24 px-6 max-w-4xl mx-auto border-t border-slate-100">
        <h2 className="text-3xl font-bold mb-12 text-center">자주 묻는 질문</h2>
        <div className="space-y-2">
          <FAQItem 
            question="Locally는 어떤 서비스인가요?" 
            answer="Locally는 전 세계 현지인 호스트와 여행자를 연결하여, 가이드북에 없는 특별한 로컬 경험을 제공하는 플랫폼입니다." 
          />
          <FAQItem 
            question="호스트가 되려면 어떻게 해야 하나요?" 
            answer="상단 메뉴의 '호스트 되기' 버튼을 통해 누구나 신청할 수 있습니다. 간단한 프로필 작성과 체험 기획 후 승인을 받으면 활동이 가능합니다." 
          />
          <FAQItem 
            question="결제는 안전한가요?" 
            answer="네, 모든 결제는 Locally의 보안 시스템을 통해 안전하게 처리되며, 체험이 완료된 후 호스트에게 정산됩니다." 
          />
          <FAQItem 
            question="예약을 취소하고 싶어요." 
            answer="마이페이지 > 여행 탭에서 예약을 관리할 수 있습니다. 호스트가 설정한 환불 정책에 따라 환불이 진행됩니다." 
          />
        </div>
      </section>

      {/* 5. 마지막 CTA */}
      <section className="py-32 px-6 bg-slate-900 text-white text-center">
        <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
          지금 시작해보세요.
        </h2>
        <p className="text-slate-400 mb-10 max-w-lg mx-auto text-lg">
          여행자가 되어 세상을 발견하거나,<br/>호스트가 되어 세상을 초대하세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <button className="bg-white text-slate-900 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all">
              여행 떠나기
            </button>
          </Link>
          <Link href="/become-a-host">
            <button className="border-2 border-white text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all">
              호스트 되기
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}