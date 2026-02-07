'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Star, Globe, Users, ShieldCheck, Heart, Search, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// --- [Utility] 에어비앤비 스타일 컴포넌트 ---
function AirbnbCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  React.useEffect(() => {
    let start = 0;
    const duration = 2000;
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
    return () => clearInterval(timer);
  }, [end]);
  return <span className="tabular-nums">{count.toLocaleString()}{suffix}</span>;
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 py-8 cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium text-[#222222] group-hover:text-rose-600 transition-colors">{question}</h3>
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${isOpen ? 'bg-[#222222] border-[#222222] text-white' : 'border-gray-300 text-[#222222]'}`}>
           <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="text-lg text-[#717171] leading-relaxed font-light">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-white font-sans text-[#222222] selection:bg-rose-100">
      <SiteHeader />

      {/* 1. HERO SECTION: 따뜻하고 감성적인 시작 */}
      <section className="relative pt-32 pb-20 px-6 max-w-[1440px] mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
          
          {/* Left: 텍스트 (여백과 타이포그래피 강조) */}
          <div className="flex-1 text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Globe size={12} />
              Global Local Community
            </div>
            <h1 className="text-5xl md:text-7xl font-[800] tracking-tight leading-[1.05] mb-8 text-[#222222]">
              여행은 <br/>
              <span className="text-rose-600">살아보는 거야.</span>
            </h1>
            <p className="text-xl text-[#717171] font-light leading-relaxed max-w-lg mx-auto lg:mx-0 mb-10">
              유명한 관광지가 아닌, 현지인의 일상 속으로.<br/>
              <span className="font-serif italic text-[#222222]">"Travel like a local with locals"</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-rose-200 hover:-translate-y-1">
                  여행 둘러보기
                </button>
              </Link>
              <Link href="/become-a-host">
                <button className="bg-white text-[#222222] border border-gray-200 hover:border-black px-8 py-4 rounded-full font-bold text-lg transition-all hover:-translate-y-1">
                  호스트 되기
                </button>
              </Link>
            </div>
          </div>

          {/* Right: 목업 (기존의 투박한 테두리 제거 -> 깔끔한 플로팅 카드 스타일) */}
          <div className="flex-1 w-full max-w-[400px] relative">
            {/* 배경 장식 (따뜻한 원형 블러) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-rose-100/50 rounded-full blur-3xl -z-10"></div>
            
            {/* 폰 프레임 (세련된 그림자 + 얇은 테두리) */}
            <div className="relative bg-white rounded-[3rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden aspect-[9/19]">
              {/* 상단 앱바 */}
              <div className="pt-12 pb-4 px-6 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <span className="font-serif font-black text-xl italic text-rose-600">Locally.</span>
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Users size={16} className="text-gray-600"/>
                </div>
              </div>

              {/* 스크롤 콘텐츠 */}
              <div className="px-4 space-y-5 pb-20">
                {/* 검색바 */}
                <div className="bg-gray-50 rounded-full py-3 px-4 flex items-center gap-3 shadow-sm border border-gray-100">
                  <Search size={18} className="text-rose-500" />
                  <span className="text-sm font-medium text-gray-400">어디로 떠나세요?</span>
                </div>

                {/* 카드 1 */}
                <div className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" alt="Seoul"/>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1">
                      <Star size={10} className="fill-rose-500 text-rose-500"/> 4.9
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-bold text-sm text-[#222222]">서울 야경 투어</div>
                    <div className="text-xs text-gray-500 mt-1">Host Jiwon</div>
                  </div>
                </div>

                {/* 카드 2 */}
                <div className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" alt="Cafe"/>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1">
                      <Star size={10} className="fill-rose-500 text-rose-500"/> 5.0
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-bold text-sm text-[#222222]">성수동 카페거리</div>
                    <div className="text-xs text-gray-500 mt-1">Host Minji</div>
                  </div>
                </div>
              </div>

              {/* 하단 네비게이션 */}
              <div className="absolute bottom-0 w-full bg-white border-t border-gray-50 py-4 px-6 flex justify-between text-gray-300">
                <Globe size={24} className="text-rose-600" />
                <Heart size={24} />
                <MessageCircle size={24} />
                <User size={24} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATS: 신뢰감 (흑백 + 깔끔함) */}
      <section className="py-24 bg-[#F7F7F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">가장 사랑받는 로컬 커뮤니티</h2>
            <p className="text-[#717171] max-w-2xl mx-auto">전 세계 여행자와 호스트가 만들어가는 따뜻한 연결.<br/>수치로 증명된 신뢰를 확인하세요.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Hosts', value: 800, suffix: '+' },
              { label: 'Cities', value: 5, suffix: '' },
              { label: 'Countries', value: 3, suffix: '' },
              { label: 'Avg Rating', value: 4.9, suffix: '' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow">
                <div className="text-4xl md:text-5xl font-black text-[#222222] mb-2">
                  <AirbnbCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CATEGORIES: 촌스러운 아이콘 -> 감성적인 '사진' 카드 (가장 큰 변화) */}
      <section className="py-32 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-[800] text-[#222222] mb-4 tracking-tight">
              당신의 취향을 발견하세요
            </h2>
            <p className="text-lg text-[#717171] font-light">
              가이드북에는 없는, 오직 로컬리에서만 가능한 경험들.
            </p>
          </div>
          <Link href="/" className="text-sm font-bold border-b border-black pb-1 hover:text-rose-600 hover:border-rose-600 transition-colors">
            모든 체험 보기
          </Link>
        </div>

        {/* Masonry Grid Layout (비대칭 그리드로 세련됨 강조) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-auto md:h-[600px]">
          {/* Card 1: Large */}
          <div className="md:col-span-2 md:row-span-2 group relative rounded-3xl overflow-hidden cursor-pointer">
            <img src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Gourmet"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-8 left-8 text-white">
              <div className="text-sm font-bold uppercase tracking-wider mb-2 opacity-90">Gastronomy</div>
              <h3 className="text-3xl font-bold">로컬 미식 탐방</h3>
            </div>
          </div>
          
          {/* Card 2 */}
          <div className="group relative rounded-3xl overflow-hidden cursor-pointer">
            <img src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Culture"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="text-xl font-bold">전통 문화 체험</h3>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative rounded-3xl overflow-hidden cursor-pointer">
            <img src="https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Night"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-6 left-6 text-white">
              <h3 className="text-xl font-bold">시크릿 야경 투어</h3>
            </div>
          </div>

          {/* Card 4 (Wide) */}
          <div className="md:col-span-2 group relative rounded-3xl overflow-hidden cursor-pointer">
            <img src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Adventure"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-8 left-8 text-white">
              <div className="text-sm font-bold uppercase tracking-wider mb-2 opacity-90">Adventure</div>
              <h3 className="text-2xl font-bold">아웃도어 액티비티</h3>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CONTENT & VALUES: 텍스트 위주로 깔끔하게 */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
             <div>
                <h2 className="text-3xl font-extrabold mb-6 leading-tight">
                  소통의 가치와<br/>문화 기여가<br/><span className="text-rose-600">시장 가치</span>가 됩니다.
                </h2>
                <p className="text-[#717171] text-lg mb-8 leading-relaxed">
                  자신의 재능과 취향을 공유하는 것만으로도 수입을 만들 수 있습니다.
                  Locally는 단순한 중개를 넘어, 사람과 사람을 잇는 가치를 만듭니다.
                </p>
                <Link href="/become-a-host" className="text-rose-600 font-bold hover:underline flex items-center gap-2">
                   전문가 호스트 알아보기 <ArrowRight size={18}/>
                </Link>
             </div>
             
             <div className="space-y-4">
                {[
                  { name: "Lee Sang-hoon", role: "한일 창업가 매칭 전문가", img: "https://i.pravatar.cc/150?u=30" },
                  { name: "Kim Ji-won", role: "로컬 미식 큐레이터", img: "https://i.pravatar.cc/150?u=31" },
                  { name: "Tanaka Ken", role: "전통 건축 해설사", img: "https://i.pravatar.cc/150?u=32" }
                ].map((profile, i) => (
                  <div key={i} className="flex items-center gap-5 p-4 rounded-2xl border border-gray-100 hover:border-rose-100 hover:shadow-lg hover:shadow-rose-50/50 transition-all bg-white group cursor-pointer">
                     <img src={profile.img} alt={profile.name} className="w-14 h-14 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all"/>
                     <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-rose-500">{profile.role}</div>
                        <div className="text-lg font-bold text-[#222222]">{profile.name}</div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </section>

      {/* 5. TRUST: 에어커버 스타일 (배경색 + 깔끔한 리스트) */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-6">
                <ShieldCheck size={32} className="text-rose-600" />
                <span className="text-2xl font-black italic tracking-tighter">Locally Cover</span>
             </div>
             <h2 className="text-3xl font-extrabold mb-6">모든 여정을<br/>안전하게 보호합니다.</h2>
             <p className="text-[#717171] text-lg mb-8">
                예약부터 체험 종료까지, Locally가 당신을 든든하게 지켜드립니다.
                호스트와 게스트 모두를 위한 포괄적인 보호 장치를 경험하세요.
             </p>
             <button className="border-2 border-black px-6 py-3 rounded-xl font-bold hover:bg-black hover:text-white transition-colors">
                보호 프로그램 자세히 보기
             </button>
          </div>
          <div className="flex-1 w-full bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
             {[
               "엄격한 호스트 및 게스트 신원 인증",
               "24시간 글로벌 안전 지원 팀 운영",
               "안전 결제 및 환불 보장 시스템",
               "책임 배상 보험 프로그램"
             ].map((item, i) => (
               <div key={i} className="flex items-start gap-4">
                  <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={20} />
                  <span className="font-medium text-[#222222]">{item}</span>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ (Minimalist) */}
      <section className="py-24 px-6 max-w-3xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center mb-16">자주 묻는 질문</h2>
        <div className="space-y-2">
          <FAQItem 
            question="Locally는 어떤 서비스인가요?" 
            answer="Locally는 전 세계 현지인 호스트와 여행자를 연결하여, 가이드북에 없는 특별한 로컬 경험을 제공하는 플랫폼입니다. 단순한 투어가 아닌, 사람과 사람의 연결을 지향합니다." 
          />
          <FAQItem 
            question="호스트가 되려면 어떻게 해야 하나요?" 
            answer="상단 메뉴의 '호스트 되기' 버튼을 통해 누구나 신청할 수 있습니다. 당신만의 취미나 재능을 체험으로 만들어보세요. 기획부터 운영까지 Locally 팀이 도와드립니다." 
          />
          <FAQItem 
            question="결제는 안전한가요?" 
            answer="네, 모든 결제는 Locally의 암호화된 보안 시스템을 통해 안전하게 처리됩니다. 체험이 완료된 후에 호스트에게 정산되므로 안심하셔도 좋습니다." 
          />
        </div>
      </section>

      {/* 7. FOOTER CTA: 마지막 임팩트 */}
      <section className="py-32 px-6 bg-[#222222] text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-[800] mb-10 tracking-tight leading-tight">
            지금 바로 Locally와<br/>함께하세요.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
             <Link href="/">
               <button className="bg-rose-600 hover:bg-rose-700 text-white px-12 py-5 rounded-full font-bold text-xl transition-all shadow-xl hover:shadow-rose-900/50 hover:scale-105">
                 여행 시작하기
               </button>
             </Link>
             <Link href="/become-a-host">
               <button className="bg-transparent border-2 border-white/20 text-white hover:bg-white hover:text-black px-12 py-5 rounded-full font-bold text-xl transition-all hover:scale-105">
                 호스트 되기
               </button>
             </Link>
          </div>
        </div>
      </section>
    </div>
  );
}