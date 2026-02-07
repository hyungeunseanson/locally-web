'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe, ShieldCheck, Heart, Users, Star } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// --- [Utility] 에어비앤비 스타일 카운터 (부드러운 가속) ---
function AirbnbCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated) {
        setHasAnimated(true);
        let start = 0;
        const duration = 1500;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
          start += increment;
          if (start >= end) {
            setCount(end);
            clearInterval(timer);
          } else {
            setCount(Math.ceil(start));
          }
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-rose-100">
      <SiteHeader />

      {/* 1. Hero Section: 압도적인 비주얼과 철학 */}
      <section className="pt-32 pb-20 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* 텍스트: 에어비앤비 특유의 대담한 타이포그래피 */}
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.05]">
              여행은 <br/>
              <span className="text-rose-600">살아보는 거야.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-500 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
              스쳐 지나가는 관광객이 아닌, <br/>
              그곳에 사는 이웃처럼 도시를 경험하세요.
            </p>
            <div className="pt-6 flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
              <Link href="/">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-xl">
                  여행 둘러보기
                </button>
              </Link>
            </div>
          </div>

          {/* 이미지: 둥근 모서리와 감성적인 컷 배치 */}
          <div className="flex-1 w-full grid grid-cols-2 gap-4">
             <div className="space-y-4 mt-12">
               <img src="https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-lg w-full h-64 object-cover hover:shadow-xl transition-all duration-500" alt="Local Life 1" />
               <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-lg w-full h-48 object-cover hover:shadow-xl transition-all duration-500" alt="Local Life 2" />
             </div>
             <div className="space-y-4">
               <img src="https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-lg w-full h-48 object-cover hover:shadow-xl transition-all duration-500" alt="Local Life 3" />
               <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-lg w-full h-64 object-cover hover:shadow-xl transition-all duration-500" alt="Local Life 4" />
             </div>
          </div>
        </div>
      </section>

      {/* 2. Stats Section: 깔끔하고 신뢰감을 주는 숫자 */}
      <section className="py-24 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {[
            { label: '도시', value: 50, suffix: '+' },
            { label: '활성 호스트', value: 2400, suffix: '+' },
            { label: '누적 여행', value: 18, suffix: 'k+' },
            { label: '평균 평점', value: 4.9, suffix: '' },
          ].map((stat, i) => (
            <div key={i} className="space-y-2">
              <div className="text-4xl md:text-6xl font-black text-rose-600 tracking-tight">
                <AirbnbCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Values Section: 로컬리의 가치 (아이콘 + 텍스트) */}
      <section className="py-32 px-6 max-w-[1440px] mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Locally가 만드는 새로운 여행
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            우리는 단순한 방문이 아닌, 깊이 있는 연결을 지향합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center px-4">
          <div className="flex flex-col items-center group">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mb-8 group-hover:scale-110 transition-transform">
              <Globe size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-4">현지인처럼</h3>
            <p className="text-gray-500 leading-relaxed text-lg">
              가이드북에는 없는 골목길 맛집, 숨겨진 산책로. 
              현지 호스트가 당신의 친구가 되어 진짜 로컬 문화를 소개합니다.
            </p>
          </div>
          <div className="flex flex-col items-center group">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mb-8 group-hover:scale-110 transition-transform">
              <Users size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-4">진정한 연결</h3>
            <p className="text-gray-500 leading-relaxed text-lg">
              단순한 숙박이나 투어가 아닙니다. 
              언어와 문화의 장벽을 넘어 서로의 삶을 이해하는 만남입니다.
            </p>
          </div>
          <div className="flex flex-col items-center group">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mb-8 group-hover:scale-110 transition-transform">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-2xl font-bold mb-4">신뢰와 안전</h3>
            <p className="text-gray-500 leading-relaxed text-lg">
              모든 호스트와 게스트는 검증을 거칩니다. 
              안전 결제 시스템과 24시간 지원으로 안심하고 여행하세요.
            </p>
          </div>
        </div>
      </section>

      {/* 4. For Travelers & Hosts: 교차 배치 레이아웃 (몰입감) */}
      <section className="py-20 px-6 max-w-[1440px] mx-auto space-y-40">
        
        {/* 여행자 섹션 */}
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
          <div className="flex-1 w-full order-2 lg:order-1">
            <img 
              src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=1000&auto=format&fit=crop" 
              alt="Travelers" 
              className="rounded-3xl shadow-2xl w-full h-[500px] object-cover hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
          <div className="flex-1 space-y-8 order-1 lg:order-2">
            <div className="inline-block bg-black text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">For Travelers</div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              나만의 취향을<br/>발견하세요.
            </h2>
            <p className="text-xl text-gray-500 leading-relaxed">
              획일화된 패키지 여행은 그만. 요리, 예술, 아웃도어 등 
              당신의 관심사에 딱 맞는 로컬 경험을 찾아보세요.
              새로운 세상을 만나는 가장 쉬운 방법입니다.
            </p>
            <div className="pt-4">
              <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-rose-600 hover:text-rose-700 hover:underline decoration-2 underline-offset-4 transition-all">
                여행지 둘러보기 <ArrowRight size={20}/>
              </Link>
            </div>
          </div>
        </div>

        {/* 호스트 섹션 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16 lg:gap-32">
          <div className="flex-1 w-full order-2 lg:order-1">
            <img 
              src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=1000&auto=format&fit=crop" 
              alt="Hosts" 
              className="rounded-3xl shadow-2xl w-full h-[500px] object-cover hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
          <div className="flex-1 space-y-8 order-1 lg:order-2">
            <div className="inline-block bg-black text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">For Hosts</div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              당신의 일상이<br/>여행이 됩니다.
            </h2>
            <p className="text-xl text-gray-500 leading-relaxed">
              남는 방, 취미, 재능을 공유하고 수입을 만드세요. 
              전 세계에서 온 여행자들을 만나고 새로운 문화를 경험할 수 있습니다.
              Locally가 안전한 호스팅을 지원합니다.
            </p>
            <div className="pt-4">
              <Link href="/become-a-host" className="inline-flex items-center gap-2 text-lg font-bold text-rose-600 hover:text-rose-700 hover:underline decoration-2 underline-offset-4 transition-all">
                호스트 등록하기 <ArrowRight size={20}/>
              </Link>
            </div>
          </div>
        </div>

      </section>

      {/* 5. Footer CTA: 강렬한 마무리 */}
      <section className="py-40 bg-[#F7F7F7] text-center px-6 mt-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-[#222222]">
            떠날 준비, 되셨나요?
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/">
              <button className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-5 rounded-xl font-bold text-xl transition-transform hover:scale-105 shadow-xl">
                여행 시작하기
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="bg-white text-[#222222] border-2 border-[#222222] hover:bg-gray-100 px-10 py-5 rounded-xl font-bold text-xl transition-transform hover:scale-105">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}