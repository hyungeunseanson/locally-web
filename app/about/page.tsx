'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Users, Heart, ShieldCheck, Globe, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-600">
      
      {/* 1. 히어로 섹션: 브랜드 철학 */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-900">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=2021&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-white"></div>
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            여행, 그 이상의 연결.<br/>
            <span className="text-rose-500">Locally</span>와 함께하세요.
          </h1>
          <p className="text-lg md:text-2xl text-slate-200 font-medium leading-relaxed">
            우리는 단순한 여행이 아닌, <br className="md:hidden"/>현지인의 삶 속으로 들어가는 경험을 만듭니다.
          </p>
        </div>
      </section>

      {/* 2. 미션 스테이트먼트 */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 bg-rose-50 text-rose-600 font-bold rounded-full text-sm mb-6">
            OUR MISSION
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-snug">
            "관광객이 아닌,<br/> 이방인이 아닌, <span className="text-rose-500 underline decoration-4 decoration-rose-200 underline-offset-4">현지인</span>처럼."
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Locally는 전 세계 어디서든 당신이 그곳의 일부가 될 수 있도록 돕습니다.
            가이드북에는 없는 골목길 맛집, 동네 사람들만 아는 산책로,
            그리고 따뜻한 사람들과의 만남. 이 모든 것이 당신을 기다리고 있습니다.
          </p>
        </div>
      </section>

      {/* 3. 핵심 가치 (카드 그리드) */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {/* 카드 1 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-14 h-14 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold mb-3">검증된 현지 호스트</h3>
              <p className="text-slate-500 leading-relaxed">
                엄격한 인터뷰와 검증 과정을 거친 호스트만이 여러분을 맞이합니다. 
                진짜 친구 같은 호스트를 만나보세요.
              </p>
            </div>

            {/* 카드 2 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-14 h-14 bg-blue-100 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MapPin size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold mb-3">유니크한 경험</h3>
              <p className="text-slate-500 leading-relaxed">
                뻔한 관광지는 이제 그만. 
                요리 클래스, 전통 공예, 숨겨진 야경 투어 등 특별한 경험을 예약하세요.
              </p>
            </div>

            {/* 카드 3 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-14 h-14 bg-green-100 text-green-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold mb-3">안전한 여행</h3>
              <p className="text-slate-500 leading-relaxed">
                모든 결제는 안전하게 보호되며, 
                24시간 고객 지원 팀이 여러분의 여정을 든든하게 지원합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 통계 섹션 (신뢰도) */}
      <section className="py-24 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">50+</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Cities</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">2k+</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Hosts</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">10k+</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Reviews</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">4.9</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Avg Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA (행동 유도) */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <Globe className="w-16 h-16 text-rose-500 mx-auto mb-6 animate-pulse" />
          <h2 className="text-3xl md:text-4xl font-bold mb-6">지금 바로 떠날 준비 되셨나요?</h2>
          <p className="text-slate-500 mb-10 text-lg">
            세상은 넓고, 만날 친구는 많습니다. <br/>
            Locally에서 당신의 다음 인생 여행지를 찾아보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <button className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-lg hover:bg-slate-800 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto">
                여행 시작하기 <ArrowRight size={20}/>
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-full font-bold text-lg hover:border-slate-900 transition-all hover:scale-105 w-full sm:w-auto">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 스타일의 하단 마무리는 RootLayout에서 처리되므로 생략 */}
    </div>
  );
}