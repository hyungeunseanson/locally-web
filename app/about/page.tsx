'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Users, Heart, ShieldCheck, Globe, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      
      {/* 1. 히어로 섹션: 차분하고 감성적인 시작 */}
      <section className="relative py-24 px-6 md:py-32 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-slate-900 mb-6 leading-tight">
            여행, 그 이상의 연결. <br/>
            <span className="text-slate-600">Locally</span>와 함께하세요.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            우리는 단순히 여행지를 방문하는 것을 넘어, 그곳의 사람들과 삶에 깊이 스며드는 경험을 지향합니다.
            Locally는 전 세계의 여행자와 현지인을 이어주는 다리입니다.
          </p>
        </div>
      </section>

      {/* 2. 브랜드 스토리 (텍스트 중심) */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="uppercase tracking-widest text-xs font-bold text-slate-400 border-b border-slate-200 pb-2 inline-block">
              OUR STORY
            </div>
            <h2 className="text-3xl font-bold text-slate-800">
              관광객이 아닌, <br/>이웃이 되어보세요.
            </h2>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                여행 가이드북에는 나오지 않는 골목길의 작은 카페, 동네 주민들만 아는 산책로, 
                그리고 그곳에서 만나는 따뜻한 사람들. Locally는 이런 '진짜' 경험을 원했던 
                여행자들의 마음에서 시작되었습니다.
              </p>
              <p>
                우리는 누구나 자신이 사는 곳의 가이드가 될 수 있다고 믿습니다. 
                당신의 일상이 누군가에게는 평생 잊지 못할 특별한 여행이 될 수 있습니다.
              </p>
            </div>
          </div>
          <div className="relative h-96 bg-slate-200 rounded-2xl overflow-hidden">
            {/* 차분한 톤의 이미지 (흑백 또는 채도 낮은 이미지 추천) */}
            <div 
              className="absolute inset-0 bg-cover bg-center grayscale hover:grayscale-0 transition-all duration-700"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1493558103817-58b2924bce98?q=80&w=1000&auto=format&fit=crop')" }}
            ></div>
          </div>
        </div>
      </section>

      {/* 3. 미션 & 가치 (3단 컬럼) */}
      <section className="py-20 px-6 bg-slate-900 text-slate-300">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">우리가 지키는 가치</h2>
            <p className="opacity-80">Locally는 단순한 중개를 넘어, 신뢰와 연결을 만듭니다.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-white mb-2">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">진정한 연결</h3>
              <p className="leading-relaxed text-sm">
                화려한 관광지보다 사람 냄새 나는 만남을 소중히 여깁니다. 
                현지 호스트와 직접 소통하며 여행의 깊이를 더하세요.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-white mb-2">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">안전과 신뢰</h3>
              <p className="leading-relaxed text-sm">
                모든 호스트와 게스트는 검증 과정을 거칩니다. 
                안전한 결제 시스템과 리뷰 제도로 믿을 수 있는 커뮤니티를 만듭니다.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-white mb-2">
                <Heart size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">취향의 발견</h3>
              <p className="leading-relaxed text-sm">
                획일화된 패키지 여행이 아닙니다. 요리, 예술, 아웃도어 등 
                당신의 취향에 딱 맞는 다채로운 로컬 경험을 발견하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 여행자 & 호스트 섹션 (교차 배치) */}
      <section className="py-24 px-6 max-w-6xl mx-auto space-y-24">
        
        {/* For Travelers */}
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 order-2 md:order-1">
            <h3 className="text-2xl font-bold mb-4 text-slate-800">여행자라면</h3>
            <p className="text-slate-600 mb-6 leading-relaxed">
              낯선 도시에서 길을 잃는 것도 좋지만, 현지 친구가 있다면 더 좋겠죠?
              Locally에서 당신의 취향을 가장 잘 아는 현지 호스트를 찾아보세요.
              단순한 가이드가 아닌, 여행의 동반자가 되어줄 것입니다.
            </p>
            <Link href="/" className="inline-flex items-center gap-2 text-slate-900 font-bold hover:underline">
              여행지 둘러보기 <ArrowRight size={18}/>
            </Link>
          </div>
          <div className="flex-1 order-1 md:order-2">
             <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden shadow-sm">
               <img src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Traveler" />
             </div>
          </div>
        </div>

        {/* For Hosts */}
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
             <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden shadow-sm">
               <img src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Host" />
             </div>
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-4 text-slate-800">현지인이라면</h3>
            <p className="text-slate-600 mb-6 leading-relaxed">
              당신의 일상, 취미, 재능을 전 세계 여행자들과 나누세요.
              Locally 호스트가 되어 새로운 문화를 만나고, 부수입도 창출할 수 있습니다.
              특별한 자격증은 필요 없습니다. 열린 마음만 있다면 충분합니다.
            </p>
            <Link href="/become-a-host" className="inline-flex items-center gap-2 text-slate-900 font-bold hover:underline">
              호스트 등록하기 <ArrowRight size={18}/>
            </Link>
          </div>
        </div>

      </section>

      {/* 5. 마지막 CTA (심플하게) */}
      <section className="py-20 bg-slate-50 text-center px-6">
        <h2 className="text-3xl font-bold mb-8 text-slate-900">
          당신의 여정을 시작하세요.
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <button className="px-8 py-4 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors">
              여행 떠나기
            </button>
          </Link>
          <Link href="/become-a-host">
            <button className="px-8 py-4 bg-white text-slate-900 border border-slate-300 rounded-lg font-bold hover:bg-slate-100 transition-colors">
              호스트 되기
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}