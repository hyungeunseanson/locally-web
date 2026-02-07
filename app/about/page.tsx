'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
// 🚨 수정된 부분: Heart 아이콘 추가됨
import { ArrowRight, Globe, Users, ShieldCheck, Star, MapPin, MessageCircle, Calendar, Heart } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// --- [Utility] 카운터 애니메이션 ---
function AnimatedCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
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
    <div className="min-h-screen bg-white font-sans text-[#222222]">
      <SiteHeader />

      {/* [1. Hero Section] */}
      <section className="pt-40 pb-20 px-6 md:px-12 max-w-[1280px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* Left: Typography */}
          <div className="flex-1 space-y-8 text-center lg:text-left animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.15]">
              해외여행에서 <br/>
              현지인과 <span className="text-rose-600">교류하고 싶어요!</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-500 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 font-serif italic">
              "Travel like a local with locals."
            </p>
            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-xl active:scale-95">
                  여행 둘러보기
                </button>
              </Link>
              <Link href="/become-a-host">
                <button className="bg-white text-[#222222] border-2 border-gray-200 px-8 py-4 rounded-xl font-bold text-lg hover:border-black transition-all">
                  호스트 되기
                </button>
              </Link>
            </div>
          </div>

          {/* Right: iPhone Mockup */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-black shadow-2xl overflow-hidden ring-4 ring-gray-100">
              {/* Dynamic Island */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20"></div>
              
              {/* App Screen */}
              <div className="bg-white w-full h-full pt-10 px-4 pb-4 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="font-serif font-bold text-xl">Locally.</span>
                  <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 space-y-4 overflow-hidden">
                  {/* Card 1 */}
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                    <div className="h-32 bg-gray-200 relative">
                      <img src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Seoul"/>
                      <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-bold shadow-sm">★ 4.9</div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm mb-1">현지인과 함께하는 야경 투어</h3>
                      <p className="text-xs text-gray-500">서울 • 호스트 Jiwon</p>
                    </div>
                  </div>
                  {/* Card 2 */}
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                    <div className="h-32 bg-gray-200 relative">
                      <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Cafe"/>
                      <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-bold shadow-sm">★ 5.0</div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm mb-1">성수동 카페거리 도슨트</h3>
                      <p className="text-xs text-gray-500">서울 • 호스트 Minji</p>
                    </div>
                  </div>
                </div>
                
                {/* Floating Bottom Nav */}
                <div className="absolute bottom-4 left-4 right-4 bg-black text-white h-14 rounded-full flex justify-around items-center px-4 shadow-lg">
                  <Globe size={20} />
                  <Heart size={20} className="opacity-50" />
                  <MessageCircle size={20} className="opacity-50" />
                  <Users size={20} className="opacity-50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* [2. Stats & Social Proof] */}
      <section className="py-20 bg-[#F7F7F7] border-y border-gray-200">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AnimatedCounter end={800} suffix="+" />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Active Hosts</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AnimatedCounter end={5} />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Cities</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AnimatedCounter end={3} />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Countries</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AnimatedCounter end={4.9} />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* [3. Feature Grid] */}
      <section className="py-32 px-6 max-w-[1280px] mx-auto">
        <div className="mb-16 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            우리 지역의 매력을<br/>생생하게 소개하세요.
          </h2>
          <p className="text-lg text-gray-500">당신의 일상이 누군가에게는 특별한 여행이 됩니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "로컬 미식 탐방", img: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1000&auto=format&fit=crop" },
            { title: "숨겨진 야경 투어", img: "https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=1000&auto=format&fit=crop" },
            { title: "전통 문화 체험", img: "https://images.unsplash.com/photo-1583324113626-70df0f4deaab?q=80&w=1000&auto=format&fit=crop" }
          ].map((item, idx) => (
            <div key={idx} className="group relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer">
              <img 
                src={item.img} 
                alt={item.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-6 left-6">
                <h3 className="text-white text-2xl font-bold">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* [4. Process & Trust] */}
      <section className="py-24 px-6 bg-[#F7F7F7]">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row gap-16 md:gap-32">
            
            {/* Process */}
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-10">Locally 호스트 등록,<br/>이렇게나 간단합니다.</h2>
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-rose-600 shadow-sm shrink-0 font-bold text-xl">1</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">체험 등록하기</h3>
                    <p className="text-gray-500">당신의 취미나 재능을 매력적인 체험으로 만들어보세요.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-rose-600 shadow-sm shrink-0 font-bold text-xl">2</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">게스트와 소통하기</h3>
                    <p className="text-gray-500">예약이 들어오면 게스트와 메시지를 나누고 일정을 조율하세요.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-rose-600 shadow-sm shrink-0 font-bold text-xl">3</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">수입 올리기</h3>
                    <p className="text-gray-500">체험이 완료되면 안전하게 정산받으세요.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Protection */}
            <div className="flex-1 bg-white p-10 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck size={32} className="text-rose-600" />
                <h3 className="text-2xl font-extrabold text-rose-600">Locally Cover</h3>
              </div>
              <p className="text-lg font-bold mb-8 text-[#222222]">모든 호스트에게 제공되는<br/>포괄적인 보호 장치.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <div className="text-green-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                  <span className="text-gray-600 font-medium">게스트 신원 인증 완료</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="text-green-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                  <span className="text-gray-600 font-medium">최대 10억원 책임 보험</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="text-green-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                  <span className="text-gray-600 font-medium">24시간 안전 지원 팀</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* [5. Final CTA] */}
      <section className="py-40 px-6 text-center max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight">
          좋아하는 일을 하며 <br/>수입을 올리세요.
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/become-a-host">
            <button className="bg-rose-600 hover:bg-rose-700 text-white px-12 py-5 rounded-xl font-bold text-xl shadow-2xl transition-transform hover:scale-105">
              호스팅 시작하기
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}