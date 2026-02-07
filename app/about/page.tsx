'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Star, Globe, Users, ShieldCheck, Heart, Search, CheckCircle2, MapPin, ArrowRight, MessageCircle, Calendar } from 'lucide-react';
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
  return (
    <div className="min-h-screen bg-white font-sans text-[#222222] selection:bg-rose-100">
      <SiteHeader />

      {/* 1. HERO SECTION: 요청하신 아이폰 목업 적용 */}
      <section className="relative pt-32 pb-24 px-6 max-w-[1440px] mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
          
          {/* Left: 텍스트 */}
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

          {/* Right: 요청하신 iPhone Mockup Code */}
          <div className="flex-1 flex justify-center md:justify-end relative">
             <div className="relative w-[340px] h-[680px] bg-black rounded-[60px] border-[12px] border-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-900/5 transform hover:scale-[1.02] transition-transform duration-500">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-3xl z-20"></div>
                <div className="w-full h-full bg-white pt-14 pb-8 px-6 flex flex-col justify-between">
                   <div>
                      <div className="w-full h-12 rounded-full bg-slate-100 mb-8 flex items-center px-4 gap-2 text-slate-400 text-sm shadow-inner">
                        <Search size={16} />
                        검색을 시작해 보세요
                      </div>
                      <h3 className="font-black text-2xl mb-6 leading-tight">내일 서울에서<br/>진행되는 체험</h3>
                      <div className="space-y-6">
                         <div className="group cursor-pointer">
                            <div className="aspect-[4/3] rounded-2xl bg-slate-200 overflow-hidden relative shadow-md mb-3">
                                <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Activity"/>
                                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold shadow-sm">오전 10시</div>
                                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur p-1.5 rounded-full shadow-sm">
                                   <Heart size={14} className="text-rose-500 fill-rose-500"/>
                                </div>
                            </div>
                            <div className="flex justify-between items-start">
                                <div>
                                   <div className="font-bold text-base text-slate-900">건축가와 함께하는 북촌 산책</div>
                                   <div className="text-slate-500 text-sm mt-1">₩45,000 / 인</div>
                                </div>
                                <div className="flex text-xs items-center font-bold gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                   <Star size={10} className="fill-black"/> 4.98
                                </div>
                            </div>
                         </div>
                      </div>
                   </div>
                   {/* Bottom Nav Simulation */}
                   <div className="border-t border-slate-100 pt-4 flex justify-around items-center text-slate-300">
                      <div className="flex flex-col items-center gap-1">
                         <Globe size={24} className="text-rose-500" />
                      </div>
                      <Heart size={24} />
                      <MessageCircle size={24} />
                      <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                         <img src="https://i.pravatar.cc/150?u=host" className="w-full h-full object-cover opacity-50"/>
                      </div>
                   </div>
                </div>
             </div>
             {/* Background Decoration */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-100 rounded-full blur-3xl -z-10 opacity-50"></div>
          </div>
        </div>
      </section>

      {/* 2. STATS: 깔끔한 숫자 */}
      <section className="py-20 bg-[#F7F7F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Hosts', value: 800, suffix: '+' },
              { label: 'Cities', value: 5, suffix: '' },
              { label: 'Countries', value: 3, suffix: '' },
              { label: 'Avg Rating', value: 4.9, suffix: '' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-[32px] shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow">
                <div className="text-4xl md:text-5xl font-black text-[#222222] mb-2">
                  <AirbnbCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 취향 발견 섹션 (요청하신 카드 스타일 적용) */}
      <section className="py-32 px-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
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

        {/* 요청하신 스타일: 3개의 깔끔한 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { 
               title: "로컬 미식 탐방", 
               desc: "숨겨진 맛집과 전통 요리", 
               img: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=800&auto=format&fit=crop" 
            },
            { 
               title: "전통 문화 체험", 
               desc: "장인과 함께하는 공예", 
               img: "https://images.unsplash.com/photo-1583324113626-70df0f4deaab?q=80&w=800&auto=format&fit=crop" 
            },
            { 
               title: "시크릿 야경 투어", 
               desc: "현지인만 아는 뷰포인트", 
               img: "https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=800&auto=format&fit=crop" 
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white rounded-[40px] p-4 shadow-xl shadow-slate-200/50 border border-slate-100 hover:-translate-y-2 transition-transform duration-300 cursor-pointer group">
               <div className="aspect-[4/5] rounded-[32px] overflow-hidden mb-6 relative">
                  <img src={item.img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.title}/>
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-full shadow-sm">
                     <ArrowRight size={20} className="text-slate-900 group-hover:text-rose-500 transition-colors"/>
                  </div>
               </div>
               <div className="px-2 pb-2">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-500 font-medium">{item.desc}</p>
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 모바일 목업 섹션 (요청하신 채팅 & 정산 UI 코드 적용) */}
      <section className="bg-slate-50 py-32 rounded-[3rem] my-10 mx-4">
          <div className="max-w-[1280px] mx-auto px-6">
            
            {/* Block 1: 게스트 소통 */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-20 mb-32">
               <div className="flex-1 order-2 md:order-1 flex justify-center">
                  <div className="relative w-[320px] bg-white rounded-[40px] shadow-2xl p-6 border border-slate-100 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                           <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" className="w-full h-full object-cover" alt="User"/>
                        </div>
                        <div><div className="font-bold text-sm">Alexi 님</div><div className="text-xs text-slate-500">예약 완료 · 5월 22일</div></div>
                     </div>
                     <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-sm text-slate-600 mb-4 font-medium leading-relaxed">
                        안녕하세요! 이번 주말 투어 정말 기대돼요. 혹시 채식 메뉴 추천도 가능할까요? 🥗
                     </div>
                     <div className="bg-rose-500 text-white p-4 rounded-2xl rounded-tr-none text-sm self-end ml-auto w-fit shadow-lg shadow-rose-200 font-medium leading-relaxed">
                        물론이죠! 비건 옵션이 훌륭한 식당 리스트를 이미 준비해뒀습니다 :)
                     </div>
                  </div>
               </div>
               <div className="flex-1 order-1 md:order-2">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-rose-500">
                     <MessageCircle size={24} />
                  </div>
                  <h3 className="text-4xl font-black mb-6 leading-tight">게스트와 <br/>간편한 소통</h3>
                  <p className="text-xl text-slate-500 leading-relaxed font-medium">
                     앱 내 채팅 기능을 통해 전 세계 게스트와 실시간으로 대화하세요.<br/>
                     개인 연락처 노출 걱정 없이 안전하게 소통할 수 있습니다.
                  </p>
               </div>
            </div>

            {/* Block 2: 정산 */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-20">
               <div className="flex-1">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-rose-500">
                     <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-4xl font-black mb-6 leading-tight">투명하고 <br/>신속한 정산</h3>
                  <p className="text-xl text-slate-500 leading-relaxed font-medium">
                     체험이 완료되면 다음 달 바로 입금됩니다.<br/>
                     복잡한 절차 없이 수익을 확인하고 관리하세요.
                  </p>
               </div>
               <div className="flex-1 flex justify-center">
                  <div className="relative w-[320px] bg-white rounded-[40px] shadow-2xl p-8 border border-slate-100 transform rotate-[2deg] hover:rotate-0 transition-transform duration-500 text-center">
                     <div className="text-slate-400 font-bold mb-2 text-sm uppercase tracking-wider">5월 정산 예정 금액</div>
                     <div className="text-5xl font-black mb-8 tracking-tight text-slate-900">₩499,784</div>
                     <div className="space-y-4 bg-slate-50 p-4 rounded-2xl">
                        <div className="flex justify-between text-sm border-b border-slate-200 pb-3">
                           <span className="text-slate-500 font-medium">지급 계좌</span>
                           <span className="font-bold">카카오뱅크 **** 1234</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1">
                           <span className="text-slate-500 font-medium">다음 지급일</span>
                           <span className="font-bold text-green-600 flex items-center gap-1"><Calendar size={14}/> 내일</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

      {/* 5. TRUST: 에어커버 스타일 */}
      <section className="py-24 px-6 bg-white">
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
             <button className="border-2 border-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-900 hover:text-white transition-colors">
                보호 프로그램 자세히 보기
             </button>
          </div>
          <div className="flex-1 w-full bg-slate-50 p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
             {[
               "엄격한 호스트 및 게스트 신원 인증",
               "24시간 글로벌 안전 지원 팀 운영",
               "안전 결제 및 환불 보장 시스템",
               "책임 배상 보험 프로그램"
             ].map((item, i) => (
               <div key={i} className="flex items-start gap-4">
                  <div className="bg-white p-1 rounded-full shadow-sm text-green-500 mt-0.5">
                     <CheckCircle2 size={18} />
                  </div>
                  <span className="font-bold text-[#222222] text-lg">{item}</span>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
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

      {/* 7. FOOTER CTA */}
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