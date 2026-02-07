'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Star, Search, CheckCircle2, MessageCircle, Calendar, ShieldCheck, Heart, Globe, Users, MapPin, ArrowRight } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// --- [Components] ---

function AirbnbCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  React.useEffect(() => {
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 20);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.ceil(start));
      }
    }, 20);
    return () => clearInterval(timer);
  }, [end]);
  return <span className="tabular-nums">{count.toLocaleString()}{suffix}</span>;
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 py-6 cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-[#222222] group-hover:text-rose-600 transition-colors pr-8">{question}</h3>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${isOpen ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
           <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="text-[#717171] leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#222222] selection:bg-rose-100">
      <SiteHeader />

      {/* 1. HERO SECTION: 여백 조정 & 타이포그래피 강조 */}
      <section className="relative pt-24 pb-16 px-6 max-w-[1440px] mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Left: 텍스트 */}
          <div className="flex-1 text-center lg:text-left z-10 lg:pl-10">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[900] tracking-tighter leading-[1.0] mb-6 text-[#222222]">
              여행은 <br/>
              <span className="text-rose-600">살아보는 거야.</span>
            </h1>
            <p className="text-xl md:text-2xl text-[#222222] font-serif italic mb-8">
              "Travel like a local with locals"
            </p>
            <p className="text-lg text-[#717171] font-medium leading-relaxed max-w-lg mx-auto lg:mx-0 mb-10">
              유명한 관광지가 아닌, 현지인의 일상 속으로.<br/>
              전 세계의 이웃들이 당신을 기다립니다.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-4 rounded-full font-bold text-lg transition-all shadow-xl hover:shadow-rose-200 hover:-translate-y-1">
                  여행 둘러보기
                </button>
              </Link>
              <Link href="/become-a-host">
                <button className="bg-white text-[#222222] border border-gray-200 hover:border-black px-10 py-4 rounded-full font-bold text-lg transition-all hover:-translate-y-1">
                  호스트 되기
                </button>
              </Link>
            </div>
          </div>

          {/* Right: iPhone Mockup (요청하신 스타일) */}
          <div className="flex-1 flex justify-center lg:justify-end relative">
             <div className="relative w-[340px] h-[680px] bg-black rounded-[60px] border-[12px] border-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-900/5 transform hover:scale-[1.01] transition-transform duration-500">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-3xl z-20"></div>
                <div className="w-full h-full bg-white pt-14 pb-8 px-6 flex flex-col justify-between">
                   <div>
                      {/* Fake Search Bar */}
                      <div className="w-full h-12 rounded-full bg-slate-100 mb-8 flex items-center px-4 gap-3 shadow-inner">
                        <Search size={18} className="text-rose-500"/>
                        <div className="flex flex-col items-start">
                           <span className="text-xs font-bold text-black">어디로 떠나세요?</span>
                           <span className="text-[10px] text-slate-400">현지인 체험 검색</span>
                        </div>
                      </div>
                      
                      <h3 className="font-black text-2xl mb-6 leading-tight">내일 도쿄에서<br/>진행되는 체험</h3>
                      
                      <div className="space-y-5">
                         {/* Card Item */}
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
                                   <div className="font-bold text-sm text-slate-900 leading-tight">마린과 함께하는<br/>도쿄 빵집 투어</div>
                                   <div className="text-slate-500 text-xs mt-1">₩35,000 / 인</div>
                                </div>
                                <div className="flex text-xs items-center font-bold gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md">
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
                      <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
                         <img src="https://i.pravatar.cc/150?u=user" className="w-full h-full object-cover opacity-80"/>
                      </div>
                   </div>
                </div>
             </div>
             {/* Decor */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-100/60 rounded-full blur-3xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* 2. STATS: 깔끔한 신뢰도 */}
      <section className="py-20 bg-[#F7F7F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-bold mb-2 tracking-tight">가장 사랑받는 로컬 커뮤니티</h2>
            <p className="text-[#717171] text-sm">전 세계 여행자와 호스트가 만들어가는 따뜻한 연결</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Hosts', value: 800, suffix: '+' },
              { label: 'Cities', value: 5, suffix: '' },
              { label: 'Countries', value: 3, suffix: '' },
              { label: 'Avg Rating', value: 4.9, suffix: '' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-[24px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-4xl font-black text-[#222222] mb-1">
                  <AirbnbCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. LISTING: 진짜 로컬리 체험 (리얼 데이터 반영) */}
      <section className="py-32 px-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-[900] text-[#222222] mb-3 tracking-tight">
              당신의 취향을 발견하세요
            </h2>
            <p className="text-lg text-[#717171]">가이드북에는 없는, 오직 로컬리에서만 가능한 경험들.</p>
          </div>
          <Link href="/" className="text-sm font-bold border-b-2 border-black pb-1 hover:text-rose-600 hover:border-rose-600 transition-colors">
            모든 체험 보기
          </Link>
        </div>

        {/* Real Listing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
          {[
            { 
               title: "미쿠의 도쿄 기치조지 투어", 
               host: "Miku", 
               price: "₩40,000", 
               rating: "4.9", 
               review: "(18)",
               img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=600&auto=format&fit=crop" 
            },
            { 
               title: "유스케의 도쿄 빈티지 투어", 
               host: "Yusuke", 
               price: "₩38,000", 
               rating: "5.0", 
               review: "(21)",
               img: "https://images.unsplash.com/photo-1554797589-7241bb691973?q=80&w=600&auto=format&fit=crop" 
            },
            { 
               title: "사치의 교토 데마치야나기 워킹", 
               host: "Sachi", 
               price: "₩33,000", 
               rating: "4.8", 
               review: "(5)",
               img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=600&auto=format&fit=crop" 
            },
            { 
               title: "마유의 8시간 도쿄 정복 투어", 
               host: "Mayu", 
               price: "₩95,000", 
               rating: "5.0", 
               review: "(3)",
               badge: "BEST",
               img: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=600&auto=format&fit=crop" 
            },
            { 
               title: "카나의 오사카 텐마 이자카야", 
               host: "Kana", 
               price: "₩45,000", 
               rating: "4.9", 
               review: "(8)",
               img: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=600&auto=format&fit=crop" 
            },
            { 
               title: "유우카의 홋카이도 비에이 워킹", 
               host: "Yuuka", 
               price: "₩38,000", 
               rating: "4.7", 
               review: "(4)",
               img: "https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=600&auto=format&fit=crop" 
            }
          ].map((item, idx) => (
            <div key={idx} className="group cursor-pointer">
               <div className="aspect-[4/5] rounded-2xl bg-gray-200 overflow-hidden relative mb-3">
                  <img src={item.img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={item.title}/>
                  <div className="absolute top-3 right-3 p-1.5 bg-transparent group-hover:scale-110 transition">
                     <Heart size={24} className="text-white/80 fill-black/20 hover:fill-rose-500 hover:text-rose-500 transition"/>
                  </div>
                  {item.badge && (
                     <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide shadow-sm">
                        {item.badge}
                     </div>
                  )}
               </div>
               <h3 className="font-bold text-[#222222] text-[15px] mb-1 leading-snug group-hover:underline">{item.title}</h3>
               <div className="text-sm text-[#717171] mb-1">Host {item.host}</div>
               <div className="flex items-center gap-1 mt-1">
                  <span className="font-bold text-sm text-[#222222]">{item.price}</span>
                  <span className="text-xs text-[#717171]">/ 인</span>
               </div>
               <div className="flex items-center gap-1 mt-1 text-xs">
                  <Star size={12} className="fill-black text-black"/> 
                  <span className="font-bold">{item.rating}</span>
                  <span className="text-gray-400">{item.review}</span>
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURES: 게스트 소통 & 맞춤 예약 (고객용 내용으로 수정) */}
      <section className="bg-slate-50 py-24 my-10">
          <div className="max-w-[1280px] mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-16 mb-24">
               {/* UI Mockup 1: 채팅 */}
               <div className="flex-1 order-2 md:order-1 flex justify-center">
                  <div className="relative w-[320px] bg-white rounded-[40px] shadow-xl p-6 border border-slate-100 transform rotate-[-1deg] hover:rotate-0 transition-transform duration-500">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border border-slate-100"><img src="https://i.pravatar.cc/150?u=host33" className="w-full h-full object-cover"/></div>
                        <div><div className="font-bold text-sm">Kana 호스트</div><div className="text-xs text-green-600 font-bold">● 온라인</div></div>
                     </div>
                     <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-sm text-slate-600 mb-3 font-medium">
                        안녕하세요! 예약해주셔서 감사합니다. 혹시 못 드시는 음식이 있으신가요? 🍜
                     </div>
                     <div className="bg-rose-500 text-white p-4 rounded-2xl rounded-tr-none text-sm self-end ml-auto w-fit shadow-lg shadow-rose-200 font-medium">
                        네! 해산물은 조금 어려워요. 고기 위주로 부탁드려도 될까요?
                     </div>
                  </div>
               </div>
               {/* Text 1 */}
               <div className="flex-1 order-1 md:order-2">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-rose-500">
                     <MessageCircle size={28} />
                  </div>
                  <h3 className="text-4xl font-[900] mb-4 leading-tight">여행 전부터 시작되는<br/>현지인과의 소통</h3>
                  <p className="text-lg text-slate-500 leading-relaxed">
                     예약 전에도, 후에도 궁금한 점은 언제든 물어보세요.<br/>
                     맛집 추천부터 복장 팁까지, 호스트가 친절하게 알려드립니다.
                  </p>
               </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-16">
               {/* Text 2 */}
               <div className="flex-1">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-rose-500">
                     <CheckCircle2 size={28} />
                  </div>
                  <h3 className="text-4xl font-[900] mb-4 leading-tight">복잡한 계획 없이<br/>떠나는 자유로움</h3>
                  <p className="text-lg text-slate-500 leading-relaxed">
                     일일이 검색하고 예약할 필요 없습니다.<br/>
                     현지 호스트가 검증한 최적의 코스로 편안하게 즐기세요.
                  </p>
               </div>
               {/* UI Mockup 2: 예약 확정 */}
               <div className="flex-1 flex justify-center">
                  <div className="relative w-[320px] bg-white rounded-[40px] shadow-xl p-8 border border-slate-100 transform rotate-[1deg] hover:rotate-0 transition-transform duration-500">
                     <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                           <CheckCircle2 size={32} />
                        </div>
                        <h4 className="font-black text-xl mb-1">예약 확정됨</h4>
                        <p className="text-xs text-slate-400">예약번호 #LC-882910</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">체험</span><span className="font-bold">오사카 텐마 투어</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">일시</span><span className="font-bold">5월 24일, 18:00</span></div>
                        <div className="flex justify-between text-sm pt-2 border-t border-slate-200"><span className="text-slate-500">인원</span><span className="font-bold">2명</span></div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
      </section>

      {/* 5. TRUST: 미니멀 & 클린 (촌스러움 제거) */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
           <div className="flex justify-center items-center gap-2 mb-4">
              <ShieldCheck size={32} className="text-rose-600"/>
              <span className="text-2xl font-black italic tracking-tighter">Locally Cover</span>
           </div>
           <h2 className="text-3xl font-[900] mb-12">안전한 여행을 위한 약속</h2>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
                 <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-900"><Users size={20}/></div>
                 <h4 className="font-bold text-lg mb-2">신원 인증</h4>
                 <p className="text-sm text-slate-500">모든 호스트와 게스트는 엄격한 신원 확인 절차를 거칩니다.</p>
              </div>
              <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
                 <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-900"><ShieldCheck size={20}/></div>
                 <h4 className="font-bold text-lg mb-2">안전 결제</h4>
                 <p className="text-sm text-slate-500">체험이 완료될 때까지 결제 대금은 안전하게 보호됩니다.</p>
              </div>
              <div className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
                 <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-900"><Heart size={20}/></div>
                 <h4 className="font-bold text-lg mb-2">24시간 지원</h4>
                 <p className="text-sm text-slate-500">여행 중 문제가 생기면 언제든 글로벌 지원팀이 도와드립니다.</p>
              </div>
           </div>
        </div>
      </section>

      {/* 6. FAQ: 내용 보강 */}
      <section className="py-24 px-6 max-w-3xl mx-auto border-t border-gray-100">
        <h2 className="text-3xl font-[900] mb-12">자주 묻는 질문</h2>
        <div className="space-y-2">
          <FAQItem 
            question="Locally는 어떤 서비스인가요?" 
            answer="Locally는 전 세계 현지인(로컬)과 여행자를 연결하는 플랫폼입니다. 단순한 가이드 투어가 아닌, 현지인의 삶과 문화를 직접 경험하고 소통하는 '진짜 여행'을 지향합니다." 
          />
          <FAQItem 
            question="일본어를 못해도 괜찮나요?" 
            answer="네, 가능합니다! 한국어가 가능한 일본인 호스트나, 현지에 거주하는 한국인 호스트가 진행하는 체험이 많습니다. 언어 걱정 없이 편하게 즐기세요." 
          />
          <FAQItem 
            question="결제는 안전한가요?" 
            answer="모든 결제는 Locally의 암호화된 보안 시스템을 통해 안전하게 처리됩니다. 예약금은 체험이 정상적으로 종료된 후에 호스트에게 지급되므로 안심하셔도 좋습니다." 
          />
          <FAQItem 
            question="예약 취소 및 환불 규정은 어떻게 되나요?" 
            answer="호스트가 설정한 환불 정책에 따라 달라집니다. 일반적으로 체험 7일 전까지는 전액 환불이 가능하며, 자세한 내용은 각 체험 페이지 하단에서 확인하실 수 있습니다." 
          />
          <FAQItem 
            question="나도 호스트가 될 수 있나요?" 
            answer="물론입니다! 현지에 거주하며 나만의 특별한 이야기나 재능이 있다면 누구나 호스트가 될 수 있습니다. 상단 '호스트 되기' 메뉴를 통해 신청해주세요." 
          />
        </div>
      </section>

      {/* 7. FOOTER CTA */}
      <section className="py-32 px-6 bg-[#222222] text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-[900] mb-10 tracking-tight leading-tight">
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