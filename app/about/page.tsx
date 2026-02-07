'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />

      {/* 1. HERO: 브랜드 철학 (모든 사람 대상) */}
      <section className="pt-40 pb-24 px-6 md:px-12 max-w-[1600px] mx-auto">
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-8xl font-extrabold tracking-tighter mb-10 leading-[1.05]">
            여행은 살아보는 거야.<br/>
            <span className="text-rose-600">Locally</span>와 함께.
          </h1>
          <p className="text-xl md:text-3xl font-medium text-slate-500 leading-relaxed max-w-2xl">
            우리는 전 세계 수백만 명의 이웃과 여행자를 연결합니다. 
            단순한 방문이 아닌, 현지인의 삶 속으로 들어가는 경험을 시작하세요.
          </p>
        </div>
      </section>

      {/* 2. LARGE IMAGE: 감성적인 비주얼 */}
      <section className="px-6 md:px-12 max-w-[1600px] mx-auto mb-32">
        <div className="w-full aspect-video md:aspect-[21/9] bg-slate-100 rounded-3xl overflow-hidden relative shadow-sm">
          <img 
            src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=2070&auto=format&fit=crop" 
            alt="Locally Lifestyle" 
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* 3. FOR GUESTS: 여행자를 위한 섹션 (좌측 텍스트, 우측 이미지) */}
      <section className="py-24 px-6 md:px-12 max-w-[1600px] mx-auto border-t border-slate-100">
        <div className="flex flex-col md:flex-row items-center gap-16 md:gap-32">
          <div className="flex-1 space-y-8">
            <div className="uppercase tracking-widest text-xs font-bold text-slate-400">FOR TRAVELERS</div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              나만의 취향을<br/>발견하세요.
            </h2>
            <p className="text-xl text-slate-500 leading-relaxed">
              가이드북에는 없는 골목길 맛집, 현지인만 아는 산책로. 
              Locally 호스트가 당신의 친구가 되어 진짜 로컬 문화를 소개합니다.
              획일화된 패키지 여행에서 벗어나세요.
            </p>
            <div className="pt-4">
              <Link href="/">
                <button className="text-lg font-bold border-b-2 border-slate-900 pb-1 hover:text-rose-600 hover:border-rose-600 transition-colors inline-flex items-center gap-2">
                  여행지 둘러보기 <ArrowRight size={20}/>
                </button>
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-slate-100">
              <img 
                src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=1000&auto=format&fit=crop" 
                alt="Traveler Experience" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOR HOSTS: 호스트를 위한 섹션 (좌측 이미지, 우측 텍스트) */}
      <section className="py-24 px-6 md:px-12 max-w-[1600px] mx-auto border-t border-slate-100">
        <div className="flex flex-col md:flex-row-reverse items-center gap-16 md:gap-32">
          <div className="flex-1 space-y-8">
            <div className="uppercase tracking-widest text-xs font-bold text-slate-400">FOR HOSTS</div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              당신의 일상이<br/>여행이 됩니다.
            </h2>
            <p className="text-xl text-slate-500 leading-relaxed">
              남는 방, 취미, 재능을 공유하고 수입을 만드세요. 
              전 세계에서 온 여행자들을 만나고 새로운 문화를 경험할 수 있습니다.
              Locally가 안전한 호스팅을 지원합니다.
            </p>
            <div className="pt-4">
              <Link href="/become-a-host">
                <button className="text-lg font-bold border-b-2 border-slate-900 pb-1 hover:text-rose-600 hover:border-rose-600 transition-colors inline-flex items-center gap-2">
                  호스트 등록하기 <ArrowRight size={20}/>
                </button>
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-slate-100">
              <img 
                src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=1000&auto=format&fit=crop" 
                alt="Hosting Experience" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. STATS: 신뢰감 (간결하게) */}
      <section className="py-32 px-6 bg-slate-50 mt-20">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center md:text-left">
            <div>
              <div className="text-5xl font-black text-slate-900 mb-2">50+</div>
              <div className="text-sm font-bold text-slate-500">Countries</div>
            </div>
            <div>
              <div className="text-5xl font-black text-slate-900 mb-2">400만</div>
              <div className="text-sm font-bold text-slate-500">Active Hosts</div>
            </div>
            <div>
              <div className="text-5xl font-black text-slate-900 mb-2">10억+</div>
              <div className="text-sm font-bold text-slate-500">Guest Arrivals</div>
            </div>
            <div>
              <div className="text-5xl font-black text-slate-900 mb-2">24/7</div>
              <div className="text-sm font-bold text-slate-500">Global Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CTA: 단순하고 강렬한 마무리 */}
      <section className="py-40 px-6 text-center max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-bold mb-12 tracking-tight">
          떠날 준비, 되셨나요?
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <Link href="/">
            <button className="px-10 py-5 bg-rose-600 text-white rounded-xl font-bold text-lg hover:bg-rose-700 transition-all shadow-xl hover:shadow-2xl">
              여행 시작하기
            </button>
          </Link>
          <Link href="/become-a-host">
            <button className="px-10 py-5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl font-bold text-lg hover:border-slate-900 transition-all">
              호스트 되기
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}