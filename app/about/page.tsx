'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
// 필요한 아이콘 모두 import
import { ArrowRight, Globe, Users, User, ShieldCheck, Star, MapPin, MessageCircle, Calendar, Heart, Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader'; 

// --- [Utility Components] ---
// 1. 에어비앤비 스타일의 부드러운 카운터
function AirbnbCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
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

// 2. FAQ 아코디언
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

      {/* [1. HERO SECTION] */}
      <section className="pt-40 pb-20 px-6 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* Left: Typography */}
          <div className="flex-1 space-y-8 text-center lg:text-left animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
              해외여행에서 <br/>
              <span className="text-[#FF385C]">현지인과 교류하고 싶어요!</span>
            </h1>
            <p className="text-xl md:text-2xl text-[#717171] font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 font-serif italic">
              "Travel like a local with locals."
            </p>
            
            {/* Interaction Tabs (로컬리 내용 반영) */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              {["현지인과 대화", "로컬 경험", "문화 교류", "비즈니스 기회"].map((tab, i) => (
                <span key={i} className={`px-4 py-2 rounded-full text-sm font-bold border ${i === 0 ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
                  {tab}
                </span>
              ))}
            </div>

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

          {/* Right: iPhone Mockup (Recommended List 반영) */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="relative w-[320px] h-[640px] bg-black rounded-[3rem] border-[8px] border-black shadow-2xl overflow-hidden ring-4 ring-gray-100">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20"></div>
              <div className="bg-white w-full h-full pt-10 px-4 pb-4 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="font-serif font-bold text-xl italic text-[#FF385C]">Locally.</span>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><User size={16}/></div>
                </div>
                
                {/* Recommended List */}
                <div className="flex-1 space-y-4 overflow-y-auto pb-16 no-scrollbar">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recommended</h4>
                  {[
                    { title: "서울 밤 산책", host: "Hyungeun", img: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=400&auto=format&fit=crop" },
                    { title: "도쿄 카페 투어", host: "Yuki", img: "https://images.unsplash.com/photo-1554797589-7241bb691973?q=80&w=400&auto=format&fit=crop" },
                    { title: "교토 명소 탐방", host: "Sato", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=400&auto=format&fit=crop" },
                    { title: "부산 맛집 탐방", host: "Sean", img: "https://images.unsplash.com/photo-1635206680720-63953e54b67d?q=80&w=400&auto=format&fit=crop" }
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="h-32 bg-gray-200 relative">
                        <img src={item.img} className="w-full h-full object-cover" alt={item.title}/>
                        <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1"><Star size={10} fill="#FF385C" color="#FF385C"/>4.9</div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-sm mb-1 truncate">{item.title}</h3>
                        <p className="text-xs text-gray-500">Host {item.host}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="absolute bottom-4 left-4 right-4 bg-black text-white h-14 rounded-full flex justify-around items-center px-4 shadow-lg z-10">
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

      {/* [2. SOCIAL PROOF & STATS] */}
      <section className="py-24 bg-[#F7F7F7] border-y border-gray-200 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex justify-center -space-x-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-gray-200 shadow-sm">
                <img src={`https://i.pravatar.cc/150?u=${i + 20}`} alt={`User ${i}`} className="w-full h-full object-cover"/>
              </div>
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">여행 업계에서 가장 사랑받는 로컬 커뮤니티.</h2>
          <p className="text-xl text-[#717171] mb-12">전 세계 수천 명의 호스트와 여행자가 함께합니다.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]"><AirbnbCounter end={800} suffix="+" /></div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Active Hosts</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]"><AirbnbCounter end={5} /></div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Cities</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]"><AirbnbCounter end={3} /></div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Countries</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-black text-[#222222]"><AirbnbCounter end={4.9} /></div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* [3. PROFESSIONAL EXPERTISE - 로컬리 내용 반영] */}
      <section className="py-32 px-6 max-w-6xl mx-auto">
        <div className="mb-16 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            소통의 가치와 문화 기여가<br/>시장 가치가 됩니다.
          </h2>
          <p className="text-lg text-[#717171]">각 분야의 전문가 호스트를 만나보세요.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { role: "한일 창업가 매칭 전문가", name: "Lee Sang-hoon", img: "https://i.pravatar.cc/150?u=30" },
            { role: "로컬 미식 큐레이터", name: "Kim Ji-won", img: "https://i.pravatar.cc/150?u=31" },
            { role: "전통 건축 해설사", name: "Tanaka Ken", img: "https://i.pravatar.cc/150?u=32" }
          ].map((host, i) => (
            <div key={i} className="flex items-center gap-4 p-6 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white">
              <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                <img src={host.img} alt={host.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#FF385C] uppercase tracking-wide mb-1">{host.role}</div>
                <div className="text-lg font-black text-[#222222]">{host.name}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* [4. DIVERSITY - A society of diverse people] */}
      <section className="bg-gray-50 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black mb-10 tracking-tight italic uppercase">A society of diverse people</h2>
          <div className="flex justify-center flex-wrap gap-4 mb-12">
             {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center p-2 shadow-sm">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="icon" />
                </div>
             ))}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-2xl mx-auto">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
               <div className="text-xs text-gray-500 font-bold mb-1">Art & Design</div>
               <div className="text-xl font-black">120+</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
               <div className="text-xs text-gray-500 font-bold mb-1">Tech & Startup</div>
               <div className="text-xl font-black">85+</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
               <div className="text-xs text-gray-500 font-bold mb-1">Food & Beverage</div>
               <div className="text-xl font-black">210+</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
               <div className="text-xs text-gray-500 font-bold mb-1">Local Heritage</div>
               <div className="text-xl font-black">140+</div>
             </div>
          </div>
        </div>
      </section>

      {/* [5. PROCESS STEPS - 로컬리 내용 + 에어비앤비 레이아웃] */}
      <section className="py-32 px-6 max-w-6xl mx-auto">
         <div className="flex flex-col md:flex-row items-center gap-16 md:gap-24">
            <div className="flex-1 space-y-8">
               <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                  예약 완료 후<br/>컨펌 메일을 보내드릴게요!
               </h2>
               <p className="text-lg text-[#717171]">
                  원하는 프로그램을 선택하고 예약하면, 호스트가 확인 후 확정 메일을 보내드립니다.
                  모든 과정은 Locally 앱에서 간편하게 확인할 수 있습니다.
               </p>
            </div>
            <div className="flex-1 flex justify-center">
               {/* Email Notification Mockup */}
               <div className="w-72 bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-serif italic text-lg">L.</div>
                     <div>
                        <div className="text-sm font-bold">Locally Team</div>
                        <div className="text-xs text-gray-400">Just now</div>
                     </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
                     <div className="font-bold text-lg mb-2">Reservation Confirmed!</div>
                     <p className="text-xs text-gray-500 leading-relaxed mb-4">
                        Your local experience with Host Sean is all set. See you soon in Seoul!
                     </p>
                     <div className="h-32 bg-gray-200 rounded-lg bg-[url('https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=400&auto=format&fit=crop')] bg-cover bg-center"></div>
                  </div>
                  <div className="flex justify-end">
                     <CheckCircle2 className="text-green-500 w-8 h-8" />
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* [6. INTERACTIVE CALCULATOR & MAP] */}
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
        
        {/* Map View */}
        <div className="flex-1 w-full bg-blue-50 rounded-3xl h-[450px] relative overflow-hidden shadow-inner border border-gray-100 bg-[url('https://images.unsplash.com/photo-1625132683978-40362198002d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-90">
           <div className="absolute top-1/2 left-1/3 bg-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce">₩128,400</div>
           <div className="absolute top-1/4 left-2/3 bg-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce delay-100">₩156,000</div>
           <div className="absolute bottom-1/3 left-1/2 bg-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce delay-200">₩98,000</div>
        </div>
      </section>

      {/* [7. TRUST & SAFETY] */}
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

      {/* [8. FAQ Section] */}
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
        </div>
      </section>

      {/* [9. FOOTER CTA] */}
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