'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe, Users, ShieldCheck, Star, MapPin, MessageCircle, Calendar, Heart, Search, ChevronDown } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader'; // 헤더는 기존 컴포넌트 사용

// --- [Utility Components] ---
// 1. 에어비앤비 스타일의 부드러운 카운터
function AirbnbCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  React.useEffect(() => {
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
    return () => clearInterval(timer);
  }, [end]);
  return <span className="tabular-nums">{count.toLocaleString()}{suffix}</span>;
}

// 2. 에어비앤비 스타일의 FAQ 아코디언
function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-6 cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-[#222222] group-hover:underline">{question}</h3>
        <ChevronDown className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && <p className="mt-4 text-lg text-[#717171] leading-relaxed">{answer}</p>}
    </div>
  );
}


export default function AboutPage() {
  const [days, setDays] = useState(7); // 수익 계산기용 상태

  return (
    <div className="min-h-screen bg-white font-sans text-[#222222]">
      <SiteHeader />

      {/* [1. HERO SECTION] - AirbnbExperience.tsx 구조 기반 */}
      <section className="pt-40 pb-20 px-6 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* Left: Typography (Locally 콘텐츠) */}
          <div className="flex-1 space-y-8 text-center lg:text-left animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
              해외여행에서 <br/>
              <span className="text-[#FF385C]">현지인과 교류하고 싶어요!</span>
            </h1>
            <p className="text-xl md:text-2xl text-[#717171] font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 font-serif italic">
              "Travel like a local with locals."
            </p>
            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/">
                <button className="bg-[#FF385C] hover:bg-[#E01E5A] text-white px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-xl active:scale-95">
                  앱 둘러보기
                </button>
              </Link>
              <Link href="/become-a-host">
                <button className="bg-white text-[#222222] border-2 border-gray-200 px-8 py-4 rounded-xl font-bold text-lg hover:border-black transition-all">
                  호스트 되기
                </button>
              </Link>
            </div>
          </div>

          {/* Right: iPhone Mockup (AirbnbExperience.tsx 스타일의 둥근 이미지 프레임) */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="relative w-[320px] h-[640px] bg-black rounded-[3rem] border-[8px] border-black shadow-2xl overflow-hidden ring-4 ring-gray-100">
              {/* Dynamic Island */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20"></div>
              {/* App Screen Content (Locally 앱 UI) */}
              <div className="bg-white w-full h-full pt-10 px-4 pb-4 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="font-serif font-bold text-xl italic text-[#FF385C]">Locally.</span>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><User size={16}/></div>
                </div>
                <div className="flex-1 space-y-4 overflow-hidden">
                  {/* Mockup Card 1 */}
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                    <div className="h-32 bg-gray-200 relative">
                      <img src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Seoul"/>
                      <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1"><Star size={12} fill="#FF385C" color="#FF385C"/>4.9</div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm mb-1 truncate">현지인과 함께하는 야경 투어</h3>
                      <p className="text-xs text-gray-500">서울 • 호스트 Jiwon</p>
                    </div>
                  </div>
                  {/* Mockup Card 2 */}
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                    <div className="h-32 bg-gray-200 relative">
                      <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Cafe"/>
                      <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1"><Star size={12} fill="#FF385C" color="#FF385C"/>5.0</div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm mb-1 truncate">성수동 카페거리 도슨트</h3>
                      <p className="text-xs text-gray-500">서울 • 호스트 Minji</p>
                    </div>
                  </div>
                </div>
                {/* Bottom Nav */}
                <div className="absolute bottom-4 left-4 right-4 bg-black text-white h-14 rounded-full flex justify-around items-center px-4 shadow-lg">
                  <Globe size={20} color="#FF385C" />
                  <Heart size={20} className="opacity-50" />
                  <MessageCircle size={20} className="opacity-50" />
                  <Users size={20} className="opacity-50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* [2. SOCIAL PROOF & STATS] - AirbnbExperience.tsx의 아바타 + LocallyLanding.tsx의 데이터 */}
      <section className="py-24 bg-[#F7F7F7] border-y border-gray-200 text-center">
        <div className="max-w-4xl mx-auto px-6">
          {/* Avatar Stack */}
          <div className="flex justify-center -space-x-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-gray-200 shadow-sm">
                <img src={`https://i.pravatar.cc/150?u=${i + 10}`} alt={`User ${i}`} className="w-full h-full object-cover"/>
              </div>
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">여행 업계에서 가장 사랑받는 로컬 커뮤니티.</h2>
          <p className="text-xl text-[#717171] mb-12">전 세계 수천 명의 호스트와 여행자가 함께합니다.</p>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AirbnbCounter end={800} suffix="+" />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Active Hosts</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AirbnbCounter end={5} />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Cities</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AirbnbCounter end={3} />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Countries</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]">
                <AirbnbCounter end={4.9} />
              </div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* [3. FEATURE GRID] - AirbnbExperience.tsx의 3단 그리드 구조 */}
      <section className="py-32 px-6 max-w-6xl mx-auto">
        <div className="mb-16 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            로컬리에서<br/>진짜 여행을 경험하세요.
          </h2>
          <p className="text-lg text-[#717171]">당신의 관심사에 딱 맞는 특별한 만남이 기다립니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "로컬 미식 탐방", img: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1000&auto=format&fit=crop" },
            { title: "숨겨진 야경 투어", img: "https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=1000&auto=format&fit=crop" },
            { title: "전통 문화 체험", img: "https://images.unsplash.com/photo-1583324113626-70df0f4deaab?q=80&w=1000&auto=format&fit=crop" }
          ].map((item, idx) => (
            <div key={idx} className="group relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer shadow-md">
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

      {/* [4. INTERACTIVE CALCULATOR & MAP] - AirbnbStays.tsx의 계산기+지도 */}
      <section className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row items-center gap-16 bg-gray-50 rounded-[3rem] my-20">
        <div className="flex-1">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">호스트가 되어보세요</h2>
          <p className="text-lg text-[#717171] mb-8">취미를 공유하고 새로운 수입을 만들어보세요.</p>
          <div className="text-[#FF385C] text-4xl md:text-5xl font-black mb-8">
            예상 수입 ₩{(1086189 * (days / 7)).toLocaleString()}
          </div>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="font-bold text-lg min-w-[100px]">{days}박 기준</span>
              <input 
                type="range" min="1" max="30" value={days} 
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="w-full accent-[#FF385C] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="relative">
              <input type="text" placeholder="지역 검색 (예: 서울)" className="w-full border-2 border-gray-200 rounded-full py-4 px-12 font-medium focus:outline-none focus:border-[#FF385C]" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF385C]" size={24} />
            </div>
          </div>
        </div>
        
        {/* Map View (AirbnbStays.tsx 스타일) */}
        <div className="flex-1 w-full bg-blue-50 rounded-3xl h-[450px] relative overflow-hidden shadow-inner border border-gray-100 bg-[url('https://images.unsplash.com/photo-1625132683978-40362198002d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-90">
           <div className="absolute top-1/2 left-1/3 bg-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce">₩128,400</div>
           <div className="absolute top-1/4 left-2/3 bg-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce delay-100">₩156,000</div>
           <div className="absolute bottom-1/3 left-1/2 bg-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce delay-200">₩98,000</div>
        </div>
      </section>

      {/* [5. TRUST & SAFETY (AirCover Style)] - AirbnbStays.tsx의 신뢰 섹션 */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6 items-center gap-2">
            <ShieldCheck size={40} className="text-[#FF385C]" />
            <span className="text-3xl font-black tracking-tighter text-[#FF385C]">Locally</span>
            <span className="text-3xl font-black tracking-tighter">Cover</span>
          </div>
          <h3 className="text-3xl font-bold mb-12">모든 유저에게 제공되는 보호 장치</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left bg-[#F7F7F7] p-8 rounded-3xl">
            {[
              "철저한 호스트 및 게스트 신원 인증",
              "안전한 결제 및 환불 보장 시스템",
              "24시간 글로벌 안전 지원 팀 운영"
            ].map((text, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="bg-white p-2 rounded-full shadow-sm">
                  <ShieldCheck className="text-green-500 shrink-0" size={20} />
                </div>
                <p className="font-bold text-lg text-[#222222]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* [6. FAQ Section] - 에어비앤비 스타일 아코디언 */}
      <section className="py-24 px-6 max-w-4xl mx-auto border-t border-gray-200">
        <h2 className="text-3xl font-bold mb-12 text-center">자주 묻는 질문</h2>
        <div className="space-y-2">
          <FAQItem 
            question="Locally는 어떤 서비스인가요?" 
            answer="Locally는 전 세계 현지인 호스트와 여행자를 연결하여, 가이드북에 없는 특별한 로컬 경험을 제공하는 플랫폼입니다." 
          />
          <FAQItem 
            question="호스트가 되려면 어떻게 해야 하나요?" 
            answer="상단 메뉴의 '호스트 되기' 버튼을 통해 누구나 신청할 수 있습니다. 간단한 프로필 작성과 체험 기획 후 승인을 받으면 활동이 가능합니다." 
          />
          <FAQItem 
            question="결제는 안전한가요?" 
            answer="네, 모든 결제는 Locally의 보안 시스템을 통해 안전하게 처리되며, 체험이 완료된 후 호스트에게 정산됩니다." 
          />
          <FAQItem 
            question="예약을 취소하고 싶어요." 
            answer="마이페이지 > 여행 탭에서 예약을 관리할 수 있습니다. 호스트가 설정한 환불 정책에 따라 환불이 진행됩니다." 
          />
        </div>
      </section>

      {/* [7. FOOTER CTA] */}
      <section className="py-40 px-6 text-center bg-black text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight leading-tight">
            지금 바로 Locally와<br/>함께하세요.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/">
              <button className="bg-[#FF385C] hover:bg-[#E01E5A] text-white px-10 py-5 rounded-xl font-bold text-xl transition-transform hover:scale-105 shadow-2xl">
                여행 시작하기
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="bg-white text-black hover:bg-gray-100 px-10 py-5 rounded-xl font-bold text-xl transition-transform hover:scale-105 shadow-2xl">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}