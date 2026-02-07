'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe, Users, Star, ShieldCheck } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// --- [Utility] 숫자 카운트업 애니메이션 ---
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

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>;
}

// --- [Utility] 스크롤 페이드인 ---
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={ref} 
      className={`transition-all duration-1000 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} 
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-200">
      <SiteHeader />

      {/* 1. Hero Section (텍스트 중심의 임팩트) */}
      <section className="pt-40 pb-20 px-6 max-w-[1760px] mx-auto">
        <FadeIn>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-10 leading-[0.9]">
            We connect <br/>
            <span className="text-slate-400">Locals</span> & Travelers.
          </h1>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 border-t border-slate-200 pt-8">
            <p className="text-xl md:text-2xl font-medium max-w-2xl leading-relaxed">
              Locally는 여행의 방식을 재정의합니다.<br/>
              관광객이 아닌, 그곳에 사는 이웃처럼 도시를 경험하세요.
            </p>
            <div className="flex gap-4">
              <Link href="/">
                <button className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all flex items-center gap-2">
                  여행 시작하기 <ArrowRight size={18}/>
                </button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* 2. Full Width Image (감성적인 분위기) */}
      <FadeIn delay={300}>
        <div className="w-full h-[60vh] md:h-[80vh] bg-slate-100 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop" 
            alt="Locally Mood" 
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000 ease-out"
          />
        </div>
      </FadeIn>

      {/* 3. Stats Section (움직이는 숫자 - 요청하신 부분) */}
      <section className="py-32 px-6 border-b border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="space-y-2">
              <div className="text-5xl md:text-7xl font-black tracking-tighter">
                <AnimatedCounter end={50} suffix="+" />
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cities</div>
            </div>
            <div className="space-y-2">
              <div className="text-5xl md:text-7xl font-black tracking-tighter">
                <AnimatedCounter end={2400} />
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hosts</div>
            </div>
            <div className="space-y-2">
              <div className="text-5xl md:text-7xl font-black tracking-tighter">
                <AnimatedCounter end={18} suffix="k" />
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Trips</div>
            </div>
            <div className="space-y-2">
              <div className="text-5xl md:text-7xl font-black tracking-tighter">
                <AnimatedCounter end={4.9} />
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Feature Section (2분할 레이아웃 - 깔끔함) */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        {/* Row 1 */}
        <div className="flex flex-col md:flex-row gap-16 items-center mb-32">
          <div className="w-full md:w-1/2">
            <FadeIn>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                현지인의 일상으로<br/>초대합니다.
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-8">
                유명한 관광지도 좋지만, 진짜 여행은 골목길에서 시작됩니다.
                현지 호스트가 추천하는 숨겨진 맛집, 산책로, 그리고 그들의 이야기를 들어보세요.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-medium">
                  <div className="w-2 h-2 bg-slate-900 rounded-full"></div> 검증된 로컬 호스트
                </li>
                <li className="flex items-center gap-3 font-medium">
                  <div className="w-2 h-2 bg-slate-900 rounded-full"></div> 취향 기반의 맞춤형 투어
                </li>
                <li className="flex items-center gap-3 font-medium">
                  <div className="w-2 h-2 bg-slate-900 rounded-full"></div> 소규모 프라이빗 경험
                </li>
              </ul>
            </FadeIn>
          </div>
          <div className="w-full md:w-1/2">
            <FadeIn delay={200}>
              <div className="aspect-[4/3] bg-slate-200 rounded-2xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  alt="Feature 1"
                />
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col md:flex-row-reverse gap-16 items-center">
          <div className="w-full md:w-1/2">
            <FadeIn>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                당신의 재능이<br/>여행이 됩니다.
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-8">
                당신에게는 평범한 일상이 누군가에게는 특별한 추억이 될 수 있습니다.
                호스트가 되어 전 세계 친구들을 만나고, 새로운 수익을 창출해보세요.
              </p>
              <Link href="/become-a-host">
                <button className="px-6 py-3 border-2 border-slate-900 rounded-full font-bold hover:bg-slate-900 hover:text-white transition-colors">
                  호스트 등록하기
                </button>
              </Link>
            </FadeIn>
          </div>
          <div className="w-full md:w-1/2">
            <FadeIn delay={200}>
              <div className="aspect-[4/3] bg-slate-200 rounded-2xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=2070&auto=format&fit=crop" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  alt="Feature 2"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 5. Values Grid (심플한 아이콘) */}
      <section className="bg-slate-50 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl font-bold text-center mb-16">Locally Values</h2>
          </FadeIn>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: Globe, title: "Global", desc: "전 세계 50개 이상의 도시" },
              { icon: Users, title: "Community", desc: "서로를 존중하는 문화" },
              { icon: ShieldCheck, title: "Trust", desc: "안전한 결제와 신원 확인" },
              { icon: Star, title: "Quality", desc: "평점 4.8 이상의 경험" },
            ].map((item, idx) => (
              <FadeIn key={idx} delay={idx * 100}>
                <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-center">
                  <item.icon size={32} className="mx-auto mb-4 text-slate-900"/>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-sm">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Footer Call to Action */}
      <section className="py-40 px-6 text-center">
        <FadeIn>
          <h2 className="text-5xl md:text-7xl font-black mb-10 tracking-tighter">
            Ready to Explore?
          </h2>
          <Link href="/">
            <button className="px-12 py-6 bg-slate-900 text-white rounded-full text-xl font-bold hover:bg-slate-800 transition-all hover:scale-105 shadow-xl">
              Start Your Journey
            </button>
          </Link>
        </FadeIn>
      </section>
    </div>
  );
}