'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Globe, ShieldCheck, Heart, Users } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#222222]">
      <SiteHeader />

      {/* 1. Hero Section: 서비스 정체성 (여행자 & 호스트 모두 포함) */}
      <section className="pt-40 pb-20 px-6 max-w-[1440px] mx-auto text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24">
          <div className="flex-1 space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              여행은 살아보는 거야. <br/>
              <span className="text-rose-600">Locally</span>와 함께.
            </h1>
            <p className="text-xl md:text-2xl text-gray-500 font-medium leading-relaxed max-w-xl">
              유명한 관광지보다, 현지인의 일상을 경험하세요. <br/>
              우리는 전 세계의 이웃과 여행자를 연결합니다.
            </p>
          </div>
          <div className="flex-1 w-full">
            {/* 에어비앤비 스타일: 둥근 모서리의 감성적인 이미지 */}
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop" 
              alt="Locally Community" 
              className="rounded-2xl shadow-xl w-full h-[500px] object-cover"
            />
          </div>
        </div>
      </section>

      {/* 2. Brand Value: 우리가 지향하는 것 (3단 그리드) */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-[1440px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center md:text-left">
            Locally가 만드는 여행
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-rose-600 mb-4">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-bold">현지인처럼</h3>
              <p className="text-gray-500 text-lg leading-relaxed">
                가이드북에는 없는 골목길 맛집, 숨겨진 산책로를 발견하세요. 
                현지 호스트가 당신의 친구가 되어줍니다.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-rose-600 mb-4">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold">진정한 연결</h3>
              <p className="text-gray-500 text-lg leading-relaxed">
                단순한 숙박이나 투어가 아닙니다. 
                서로의 문화를 나누고 이해하는 사람 냄새 나는 만남을 지향합니다.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-rose-600 mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold">신뢰와 안전</h3>
              <p className="text-gray-500 text-lg leading-relaxed">
                모든 호스트와 게스트는 검증을 거칩니다. 
                안전 결제 시스템과 24시간 지원으로 안심하고 여행하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. For Travelers (여행자를 위한 섹션) */}
      <section className="py-32 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-16 md:gap-24">
          <div className="flex-1 w-full">
            <img 
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop" 
              alt="Travelers" 
              className="rounded-2xl shadow-xl w-full h-[600px] object-cover"
            />
          </div>
          <div className="flex-1 space-y-6">
            <div className="uppercase tracking-widest text-xs font-bold text-gray-400 mb-2">FOR TRAVELERS</div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              나만의 취향을<br/>발견하세요.
            </h2>
            <p className="text-xl text-gray-500 leading-relaxed">
              획일화된 패키지 여행은 그만. 요리, 예술, 아웃도어 등 
              당신의 관심사에 딱 맞는 로컬 경험을 찾아보세요.
            </p>
            <div className="pt-4">
              <Link href="/">
                <button className="border-2 border-black text-black px-8 py-3 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all">
                  여행 둘러보기
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. For Hosts (호스트를 위한 섹션) */}
      <section className="py-32 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row-reverse items-center gap-16 md:gap-24">
          <div className="flex-1 w-full">
            <img 
              src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=2070&auto=format&fit=crop" 
              alt="Hosting" 
              className="rounded-2xl shadow-xl w-full h-[600px] object-cover"
            />
          </div>
          <div className="flex-1 space-y-6">
            <div className="uppercase tracking-widest text-xs font-bold text-gray-400 mb-2">FOR HOSTS</div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              당신의 일상이<br/>여행이 됩니다.
            </h2>
            <p className="text-xl text-gray-500 leading-relaxed">
              취미를 공유하고, 전 세계 친구들을 만나세요. 
              Locally 호스트가 되어 새로운 즐거움과 수익을 창출할 수 있습니다.
            </p>
            <div className="pt-4">
              <Link href="/become-a-host">
                <button className="border-2 border-black text-black px-8 py-3 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all">
                  호스트 등록하기
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer CTA (에어비앤비 스타일 마무리) */}
      <section className="py-40 bg-black text-white text-center px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            지금 바로 Locally와<br/>함께하세요.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
            <Link href="/">
              <button className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-lg w-full sm:w-auto">
                여행 떠나기
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="bg-white text-black hover:bg-gray-100 px-10 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-lg w-full sm:w-auto">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}