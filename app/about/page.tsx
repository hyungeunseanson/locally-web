'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Star, ShieldCheck, Globe, Heart } from 'lucide-react';
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
        const duration = 1200; // 에어비앤비는 애니메이션이 짧고 간결함
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
      {/* 네비게이션 */}
      <SiteHeader />

      {/* 1. Hero Section: 에어비앤비 호스팅 스타일 (좌측 텍스트, 우측 이미지) */}
      <section className="pt-32 pb-20 px-6 md:px-12 max-w-[1440px] mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-24">
        <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            당신의 열정을 <br />
            <span className="text-rose-600">공유하세요.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 font-medium leading-relaxed max-w-lg">
            Locally와 함께라면, 당신의 일상과 취미가 전 세계 사람들에게 특별한 여행이 됩니다.
          </p>
          <div className="pt-4">
            <Link href="/become-a-host">
              <button className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-lg active:scale-95">
                시작하기
              </button>
            </Link>
          </div>
        </div>
        
        {/* 에어비앤비 특유의 둥근 모서리 이미지 그리드 */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="space-y-4 mt-12">
            <img src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-md w-full h-64 object-cover hover:shadow-xl transition-shadow" alt="Cooking" />
            <img src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-md w-full h-48 object-cover hover:shadow-xl transition-shadow" alt="Walking" />
          </div>
          <div className="space-y-4">
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-md w-full h-48 object-cover hover:shadow-xl transition-shadow" alt="Meeting" />
            <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1000&auto=format&fit=crop" className="rounded-2xl shadow-md w-full h-64 object-cover hover:shadow-xl transition-shadow" alt="Smiling" />
          </div>
        </div>
      </section>

      {/* 2. Stats Section: 깔끔한 숫자 강조 (검은 배경 x, 에어비앤비는 흰 배경 선호) */}
      <section className="py-24 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {[
            { label: '활성 호스트', value: 2400, suffix: '+' },
            { label: '여행 가능한 도시', value: 50, suffix: '+' },
            { label: '누적 예약', value: 18000, suffix: '+' },
            { label: '평균 평점', value: 4.9, suffix: '' },
          ].map((stat, i) => (
            <div key={i} className="space-y-2">
              <div className="text-4xl md:text-6xl font-bold text-rose-600 tracking-tight">
                <AirbnbCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Value Props: 아이콘 + 텍스트 (좌우 배치) */}
      <section className="py-32 px-6 max-w-[1280px] mx-auto space-y-32">
        
        {/* Block 1 */}
        <div className="flex flex-col md:flex-row items-center gap-16 md:gap-24">
          <div className="flex-1">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              당신의 취향대로 <br/>호스팅하세요.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              요리, 공예, 투어, 무엇이든 좋습니다. Locally에서는 호스트님이 직접 일정을 정하고,
              요금을 설정하며, 원하는 방식으로 게스트를 맞이할 수 있습니다.
            </p>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-gray-100 rounded-full"><Star size={24} className="text-rose-600"/></div>
              <div>
                <h4 className="font-bold text-lg">자유로운 일정</h4>
                <p className="text-gray-500 text-sm">원하는 날짜와 시간에만 활동하세요.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 rounded-full"><Globe size={24} className="text-rose-600"/></div>
              <div>
                <h4 className="font-bold text-lg">글로벌 커뮤니티</h4>
                <p className="text-gray-500 text-sm">전 세계 여행자들과 교류하세요.</p>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <img 
              src="https://images.unsplash.com/photo-1551918120-9739cb430c6d?q=80&w=1000&auto=format&fit=crop" 
              alt="Hosting" 
              className="rounded-3xl w-full h-[500px] object-cover shadow-2xl"
            />
          </div>
        </div>

        {/* Block 2 */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-16 md:gap-24">
          <div className="flex-1">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              우리가 든든하게 <br/>지원합니다.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              처음이라도 걱정하지 마세요. 호스트 보호 프로그램, 24시간 지원 팀,
              그리고 경험 많은 슈퍼호스트 커뮤니티가 여러분을 돕습니다.
            </p>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-gray-100 rounded-full"><ShieldCheck size={24} className="text-rose-600"/></div>
              <div>
                <h4 className="font-bold text-lg">호스트 보호 보험</h4>
                <p className="text-gray-500 text-sm">만일의 사고에 대비해 최대 10억원까지 보장합니다.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 rounded-full"><Heart size={24} className="text-rose-600"/></div>
              <div>
                <h4 className="font-bold text-lg">1:1 전담 지원</h4>
                <p className="text-gray-500 text-sm">문제가 생기면 언제든 연락하세요.</p>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <img 
              src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1000&auto=format&fit=crop" 
              alt="Support" 
              className="rounded-3xl w-full h-[500px] object-cover shadow-2xl"
            />
          </div>
        </div>

      </section>

      {/* 4. Large CTA: 에어비앤비 하단 스타일 (초대형 텍스트 + 버튼) */}
      <section className="py-40 bg-black text-white text-center px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            지금 바로 호스팅을<br/>시작해보세요.
          </h2>
          <p className="text-xl text-gray-400">
            특별한 자격은 필요 없습니다. 열정만 있다면 충분합니다.
          </p>
          <Link href="/become-a-host">
            <button className="bg-rose-600 hover:bg-rose-700 text-white px-12 py-5 rounded-xl font-bold text-xl transition-all hover:scale-105 shadow-2xl inline-flex items-center gap-3">
              호스트 등록하기 <ArrowRight size={24} />
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}