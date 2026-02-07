'use client';

import React, { useEffect, useState, useRef, ReactNode } from 'react';
import Link from 'next/link';
import { Globe, Users, Star, ShieldCheck, ArrowRight } from 'lucide-react';

// ----------------------------------------------------------------------
// 1. [유틸리티 컴포넌트] 스크롤 시 부드럽게 나타나는 효과 (FadeIn)
// ----------------------------------------------------------------------
function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 } // 20% 보일 때 트리거
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. [유틸리티 컴포넌트] 숫자가 카운트업되는 애니메이션 (Counter)
// ----------------------------------------------------------------------
function AnimatedCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000; // 2초 동안
          const increment = end / (duration / 16); // 60fps 기준

          const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ----------------------------------------------------------------------
// 3. [메인 페이지] About Us
// ----------------------------------------------------------------------
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-600">
      
      {/* --- Hero Section --- */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <FadeIn>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
            어디서나,<br />
            <span className="text-rose-500">우리 집처럼.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            Locally는 전 세계 수백만 명의 사람들이<br className="hidden md:block"/> 
            낯선 곳에서도 소속감을 느낄 수 있도록 연결합니다.
          </p>
        </FadeIn>
      </section>

      {/* --- Hero Image (Wide) --- */}
      <FadeIn delay={400}>
        <div className="w-full h-[50vh] md:h-[70vh] bg-slate-100 overflow-hidden relative">
          {/* 이미지: 에어비앤비 느낌의 따뜻하고 감성적인 사진 */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070&auto=format&fit=crop')" }}
          />
        </div>
      </FadeIn>

      {/* --- Stats Section (Moving Numbers) --- */}
      <section className="py-32 px-6 border-b border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            <FadeIn delay={0}>
              <div className="flex flex-col items-center">
                <Globe className="w-8 h-8 text-rose-500 mb-4" />
                <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                  <AnimatedCounter end={190} suffix="+" />
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Countries</div>
              </div>
            </FadeIn>
            <FadeIn delay={100}>
              <div className="flex flex-col items-center">
                <Users className="w-8 h-8 text-rose-500 mb-4" />
                <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                  <AnimatedCounter end={400} suffix="만+" />
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hosts</div>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="flex flex-col items-center">
                <Star className="w-8 h-8 text-rose-500 mb-4" />
                <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                  <AnimatedCounter end={10} suffix="억+" />
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Reviews</div>
              </div>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="flex flex-col items-center">
                <ShieldCheck className="w-8 h-8 text-rose-500 mb-4" />
                <div className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                  <AnimatedCounter end={24} suffix="/7" />
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Support</div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* --- Value Proposition (Grid) --- */}
      <section className="py-32 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
              Locally가 만드는<br/>새로운 여행의 기준
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-10">
            {/* Card 1 */}
            <FadeIn delay={0}>
              <div className="bg-white p-10 rounded-3xl shadow-sm h-full hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-2xl font-bold mb-4">현지인처럼 살아보기</h3>
                <p className="text-slate-500 leading-relaxed">
                  관광객으로 붐비는 호텔이 아닌, 현지인의 집에서 머무르며 그들의 일상을 경험해보세요.
                  진짜 로컬 문화를 느낄 수 있습니다.
                </p>
              </div>
            </FadeIn>
            {/* Card 2 */}
            <FadeIn delay={100}>
              <div className="bg-white p-10 rounded-3xl shadow-sm h-full hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-2xl font-bold mb-4">특별한 호스트</h3>
                <p className="text-slate-500 leading-relaxed">
                  단순히 열쇠만 건네주는 것이 아닙니다. 
                  동네 맛집을 추천해주고, 따뜻한 이야기를 나누는 친구 같은 호스트를 만나세요.
                </p>
              </div>
            </FadeIn>
            {/* Card 3 */}
            <FadeIn delay={200}>
              <div className="bg-white p-10 rounded-3xl shadow-sm h-full hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-2xl font-bold mb-4">안전은 최우선</h3>
                <p className="text-slate-500 leading-relaxed">
                  모든 호스트와 게스트는 검증 절차를 거칩니다.
                  안전 결제 시스템과 24시간 지원 팀이 당신의 여정을 든든하게 지킵니다.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* --- CTA Section --- */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-24 text-center text-white relative overflow-hidden">
          {/* 배경 데코레이션 */}
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          
          <FadeIn>
            <h2 className="text-4xl md:text-6xl font-black mb-8 relative z-10">
              당신의 다음 여행,<br/>
              여기서 시작하세요.
            </h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
              <Link href="/">
                <button className="px-8 py-4 bg-rose-500 text-white rounded-full font-bold text-lg hover:bg-rose-600 transition-all hover:scale-105 shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto">
                  여행 둘러보기 <ArrowRight size={20}/>
                </button>
              </Link>
              <Link href="/become-a-host">
                <button className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:bg-slate-100 transition-all hover:scale-105 w-full sm:w-auto">
                  호스트 등록하기
                </button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

    </div>
  );
}