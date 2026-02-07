'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe, MapPin, Shield, Smile } from 'lucide-react';

export default function AboutPage() {
  // 스크롤 관측을 위한 Refs
  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);

  // 마우스 3D 효과를 위한 상태
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // 마우스 움직임 감지
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 화면 중앙을 0,0으로 기준 잡기
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePosition({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 스크롤 애니메이션 (Intersection Observer)
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, { threshold: 0.2 });

    const targets = document.querySelectorAll('.scroll-animate');
    targets.forEach((t) => observer.observe(t));

    return () => targets.forEach((t) => observer.unobserve(t));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      {/* 1. Ultra-Hip Hero Section (3D Motion) */}
      <section 
        ref={section1Ref}
        className="relative h-screen flex flex-col items-center justify-center overflow-hidden perspective-1000"
        style={{ perspective: '1000px' }}
      >
        {/* 움직이는 배경 그라디언트 */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-900 via-black to-purple-900 opacity-50"
          style={{
            transform: `translate(${mousePosition.x * -20}px, ${mousePosition.y * -20}px) scale(1.1)`
          }}
        />
        
        {/* 3D 텍스트 레이어 */}
        <div 
          className="relative z-10 text-center transition-transform duration-100 ease-out"
          style={{
            transform: `rotateY(${mousePosition.x * 10}deg) rotateX(${mousePosition.y * -10}deg)`
          }}
        >
          <h1 className="text-6xl md:text-9xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400 drop-shadow-2xl">
            Locally
          </h1>
          <p className="text-xl md:text-3xl font-medium text-slate-300 max-w-2xl mx-auto leading-relaxed">
            여행의 판도를 바꾸다.<br/>
            <span className="text-white font-bold">오직 현지인처럼.</span>
          </p>
        </div>

        {/* 바닥 장식 (애플 스타일 빛 반사) */}
        <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent z-20"></div>
        
        {/* 스크롤 유도 아이콘 */}
        <div className="absolute bottom-10 animate-bounce text-slate-500">
          <ArrowRight className="rotate-90" size={32}/>
        </div>
      </section>

      {/* 2. Sticky Scroll Section (토스 스타일) */}
      <section className="py-40 px-6 bg-black relative z-10">
        <div className="max-w-5xl mx-auto space-y-40">
          
          {/* 메시지 1 */}
          <div className="scroll-animate opacity-0 translate-y-10 transition-all duration-1000 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                가이드북은<br/> <span className="text-blue-500">버리세요.</span>
              </h2>
              <p className="text-xl text-slate-400 leading-relaxed">
                진짜 맛집은 검색해도 안 나옵니다.<br/>
                동네 주민만이 아는 그곳, Locally가 연결해 드립니다.
              </p>
            </div>
            <div className="flex-1 h-96 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-[3rem] flex items-center justify-center border border-slate-800 shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
               <MapPin size={80} className="text-white relative z-10 drop-shadow-lg" />
            </div>
          </div>

          {/* 메시지 2 */}
          <div className="scroll-animate opacity-0 translate-y-10 transition-all duration-1000 delay-200 flex flex-col md:flex-row-reverse items-center gap-10">
            <div className="flex-1 text-right md:text-left"> {/* 모바일 우측 정렬 X */}
              <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                친구네 집처럼<br/> <span className="text-purple-500">편안하게.</span>
              </h2>
              <p className="text-xl text-slate-400 leading-relaxed">
                엄격하게 검증된 호스트가 당신을 기다립니다.<br/>
                단순한 숙박이 아닌, 따뜻한 환대를 경험하세요.
              </p>
            </div>
            <div className="flex-1 h-96 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-[3rem] flex items-center justify-center border border-slate-800 shadow-2xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
               <Smile size={80} className="text-white relative z-10 drop-shadow-lg" />
            </div>
          </div>

        </div>
      </section>

      {/* 3. Numbers Section (Glassmorphism) */}
      <section className="py-32 px-6 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-fixed relative">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Cities', value: '50+' },
            { label: 'Hosts', value: '2,400' },
            { label: 'Trips', value: '18k' },
            { label: 'Rating', value: '4.9' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white/10 border border-white/20 p-8 rounded-3xl backdrop-blur-md text-center hover:bg-white/20 transition-colors">
              <div className="text-4xl md:text-5xl font-black text-white mb-2">{stat.value}</div>
              <div className="text-sm font-bold text-blue-300 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. CTA Section (깔끔한 마무리) */}
      <section className="h-[80vh] flex flex-col items-center justify-center bg-white text-black px-6 text-center">
        <div className="scroll-animate opacity-0 translate-y-10 transition-all duration-1000">
          <Globe className="w-24 h-24 text-blue-600 mx-auto mb-8 animate-spin-slow" style={{ animationDuration: '10s' }} />
          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
            떠날 준비, <br/>되셨나요?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <button className="px-10 py-5 bg-black text-white rounded-full font-bold text-xl hover:scale-105 hover:shadow-2xl transition-all duration-300 flex items-center gap-2">
                지금 시작하기 <ArrowRight />
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="px-10 py-5 bg-white text-black border-2 border-black rounded-full font-bold text-xl hover:bg-slate-100 transition-all duration-300">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}