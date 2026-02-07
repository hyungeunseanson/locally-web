'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Star, ShieldCheck, Globe, Users } from 'lucide-react';

// --- [내부 컴포넌트] 스크롤 시 페이드인 효과 ---
function FadeInSection({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => setIsVisible(entry.isIntersecting));
    });
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function AboutPage() {
  // 스크롤에 따라 상단 네비게이션 스타일 변경
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="font-sans text-slate-900 bg-white">
      
      {/* 1. 고정 헤더 (스크롤 시 배경 생김) */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white py-4 shadow-sm' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className={`text-2xl font-black tracking-tighter ${scrolled ? 'text-slate-900' : 'text-white'}`}>
            Locally
          </Link>
          <Link href="/become-a-host">
            <button className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${
              scrolled 
                ? 'bg-rose-500 text-white hover:bg-rose-600' 
                : 'bg-white text-slate-900 hover:bg-slate-100'
            }`}>
              호스트 되기
            </button>
          </Link>
        </div>
      </header>

      {/* 2. 초대형 히어로 섹션 (영상/이미지 배경) */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* 배경 이미지 (에어비앤비 느낌의 따뜻하고 활기찬 사진) */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1551918120-9739cb430c6d?q=80&w=2572&auto=format&fit=crop')",
          }}
        >
          <div className="absolute inset-0 bg-black/30"></div> {/* 텍스트 가독성을 위한 어두운 필터 */}
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight tracking-tight">
            당신의 일상을 <br />
            특별한 여행으로.
          </h1>
          <p className="text-xl md:text-2xl font-medium mb-10 max-w-2xl mx-auto opacity-90">
            현지인만이 줄 수 있는 경험, Locally에서 시작하세요.
          </p>
          <Link href="/become-a-host">
            <button className="bg-rose-500 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-rose-600 transition-all hover:scale-105 flex items-center gap-2 mx-auto shadow-xl">
              <span className="pb-1">시작하기</span> <ArrowRight size={20} />
            </button>
          </Link>
        </div>
      </section>

      {/* 3. 섹션: 호스팅의 가치 (이미지 + 텍스트 교차 배치) */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <FadeInSection>
          <div className="flex flex-col md:flex-row items-center gap-16 mb-32">
            <div className="w-full md:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=2070&auto=format&fit=crop" 
                alt="Hosting" 
                className="rounded-3xl shadow-2xl w-full h-[500px] object-cover"
              />
            </div>
            <div className="w-full md:w-1/2 space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                취미를 공유하고,<br/>수입을 만드세요.
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                요리, 공예, 투어, 무엇이든 좋습니다. 당신이 사랑하는 일을 전 세계 여행자들과 나누세요. 
                Locally가 당신의 재능이 빛날 수 있도록 돕겠습니다.
              </p>
            </div>
          </div>
        </FadeInSection>

        <FadeInSection>
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="w-full md:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=2064&auto=format&fit=crop" 
                alt="Community" 
                className="rounded-3xl shadow-2xl w-full h-[500px] object-cover"
              />
            </div>
            <div className="w-full md:w-1/2 space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                전 세계 친구들을<br/>만나세요.
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                단순한 거래가 아닙니다. 문화를 교류하고, 새로운 친구를 사귀는 경험입니다. 
                Locally 호스트가 되어 글로벌 커뮤니티의 일원이 되어보세요.
              </p>
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* 4. 통계 섹션 (에어비앤비 스타일의 굵은 숫자) */}
      <section className="bg-slate-50 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-20">Locally와 함께하는 이유</h2>
          </FadeInSection>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <FadeInSection delay={100}>
              <div className="space-y-4">
                <div className="text-5xl md:text-6xl font-black text-rose-500">100%</div>
                <h3 className="text-xl font-bold">안전한 결제 보호</h3>
                <p className="text-slate-500">게스트가 체크인할 때까지<br/>결제 대금을 안전하게 보호합니다.</p>
              </div>
            </FadeInSection>
            <FadeInSection delay={200}>
              <div className="space-y-4">
                <div className="text-5xl md:text-6xl font-black text-rose-500">$0</div>
                <h3 className="text-xl font-bold">가입비 없음</h3>
                <p className="text-slate-500">체험 등록부터 예약 관리까지<br/>초기 비용 없이 시작하세요.</p>
              </div>
            </FadeInSection>
            <FadeInSection delay={300}>
              <div className="space-y-4">
                <div className="text-5xl md:text-6xl font-black text-rose-500">24/7</div>
                <h3 className="text-xl font-bold">글로벌 지원</h3>
                <p className="text-slate-500">언제 어디서나<br/>Locally 팀이 도와드립니다.</p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* 5. 에어비앤비 스타일 안전 보장 (아이콘 그리드) */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <FadeInSection>
          <div className="flex flex-col md:flex-row gap-16">
            <div className="w-full md:w-1/3">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                호스팅을<br/>안전하게 지원합니다.
              </h2>
              <p className="text-lg text-slate-600">
                게스트 검증부터 보험까지, 호스트님이 안심하고 활동할 수 있도록 모든 준비를 마쳤습니다.
              </p>
            </div>
            <div className="w-full md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <ShieldCheck className="w-8 h-8 text-rose-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2">게스트 신원 인증</h3>
                  <p className="text-slate-500">모든 게스트는 예약 전 엄격한 신원 확인 절차를 거칩니다.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Star className="w-8 h-8 text-rose-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2">공정한 리뷰 시스템</h3>
                  <p className="text-slate-500">체험이 완료된 후에만 리뷰를 작성할 수 있어 신뢰할 수 있습니다.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Globe className="w-8 h-8 text-rose-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2">호스트 보호 프로그램</h3>
                  <p className="text-slate-500">만일의 사고에 대비해 최대 100만 달러까지 보장합니다.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Users className="w-8 h-8 text-rose-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2">커뮤니티 가이드라인</h3>
                  <p className="text-slate-500">서로 존중하는 커뮤니티를 위해 엄격한 기준을 적용합니다.</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      </section>

      {/* 6. 하단 CTA (검은 배경의 강렬한 마무리) */}
      <section className="bg-black py-32 px-6 text-center text-white">
        <FadeInSection>
          <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
            지금 바로 호스트가<br/>되어보세요.
          </h2>
          <Link href="/become-a-host">
            <button className="bg-rose-500 text-white px-12 py-5 rounded-full font-bold text-xl hover:bg-rose-600 transition-all hover:scale-105 shadow-2xl">
              시작하기
            </button>
          </Link>
        </FadeInSection>
      </section>

    </div>
  );
}