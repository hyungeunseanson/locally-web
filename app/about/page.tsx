'use client';

import React from 'react';
import Link from 'next/link';
// 필요한 아이콘 import
import { ChevronDown, Star, MessageSquare, Calendar, MapPin, Music, Heart, Utensils, Mountain, Building2, Search, CheckCircle2, Globe, Users, ShieldCheck } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader'; 

const AboutPage = () => {
  return (
    <div className="bg-white font-sans text-[#222222] antialiased">
      {/* 1. 글로벌 네비게이션 (SiteHeader 사용) */}
      <SiteHeader />

      {/* 2. 히어로 섹션 (디자인: AirbnbExperienceFull / 내용: Locally) */}
      <section className="px-6 pt-32 pb-24 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <h1 className="text-[44px] font-extrabold leading-[1.1] tracking-tight mb-6">
            해외여행에서 <br />
            <span className="text-[#FF385C]">현지인과 교류하고 싶어요!</span>
          </h1>
          <p className="text-[17px] text-[#717171] leading-relaxed max-w-md font-serif italic mb-8">
            "Travel like a local with locals."
          </p>
          <div className="flex gap-4">
            <Link href="/">
              <button className="bg-[#FF385C] text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-[#E31C5F] transition shadow-lg hover:shadow-xl hover:scale-105 active:scale-95">
                여행 시작하기
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="bg-white text-[#222222] border-2 border-gray-200 px-8 py-3.5 rounded-xl font-bold text-lg hover:border-black transition">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
        
        {/* iPhone Mockup: 로컬리 앱 UI 반영 */}
        <div className="flex-1 w-full max-w-[320px] flex justify-center">
          <div className="relative border-[12px] border-[#222222] rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] aspect-[9/19] bg-white ring-4 ring-gray-50">
            <div className="p-4 pt-10 h-full flex flex-col">
              {/* Fake Search Bar */}
              <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 shadow-sm mb-4">
                <Search size={14} className="text-[#FF385C]" />
                <span className="text-[10px] font-bold text-gray-400">어디로 여행가세요?</span>
              </div>
              
              {/* App Content */}
              <div className="space-y-4 flex-1 overflow-hidden">
                {/* Card 1 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-100 aspect-video relative">
                    <img src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=400&auto=format&fit=crop" className="w-full h-full object-cover" alt="Seoul"/>
                    <div className="absolute top-2 right-2 bg-white px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-0.5"><Star size={8} fill="#FF385C" color="#FF385C"/>4.9</div>
                  </div>
                  <div className="p-2">
                    <div className="text-[12px] font-bold truncate">현지인과 함께하는 야경 투어</div>
                    <div className="text-[10px] text-gray-500">서울 • 호스트 Jiwon</div>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-100 aspect-video relative">
                    <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=400&auto=format&fit=crop" className="w-full h-full object-cover" alt="Cafe"/>
                     <div className="absolute top-2 right-2 bg-white px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-0.5"><Star size={8} fill="#FF385C" color="#FF385C"/>5.0</div>
                  </div>
                  <div className="p-2">
                    <div className="text-[12px] font-bold truncate">성수동 카페거리 도슨트</div>
                    <div className="text-[10px] text-gray-500">서울 • 호스트 Minji</div>
                  </div>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="mt-auto bg-black text-white h-12 rounded-full flex justify-around items-center px-4 shadow-lg">
                  <Globe size={16} color="#FF385C" />
                  <Heart size={16} className="opacity-50" />
                  <MessageSquare size={16} className="opacity-50" />
                  <Users size={16} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 로컬 매력 소개 섹션 (디자인: Airbnb / 내용: Locally Categories) */}
      <section className="bg-white py-24 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4 tracking-tight">
            로컬리에서<br />진짜 여행을 경험하세요
          </h2>
          <p className="text-[#717171] mb-12">당신의 관심사에 딱 맞는 특별한 만남이 기다립니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { img: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=600&auto=format&fit=crop", label: "로컬 미식 탐방" },
              { img: "https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=600&auto=format&fit=crop", label: "숨겨진 야경 투어" },
              { img: "https://images.unsplash.com/photo-1583324113626-70df0f4deaab?q=80&w=600&auto=format&fit=crop", label: "전통 문화 체험" }
            ].map((item, idx) => (
              <div key={idx} className="rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer">
                <div className="aspect-[4/5] overflow-hidden">
                  <img src={item.img} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={item.label}/>
                </div>
                <div className="p-4 text-left font-bold text-lg bg-white">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. 독특한 체험 카테고리 (아이콘 리스트) */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center mb-16 tracking-tight">
          어디서도 만나볼 수 없는<br />독특한 로컬 체험
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-10">
          {[
            { icon: <Building2 className="text-amber-700" />, title: "로컬 헤리티지", desc: "지역의 숨겨진 유적지와 역사적 이야기를 공유하세요." },
            { icon: <Utensils className="text-orange-500" />, title: "로컬 미식", desc: "시장의 숨은 맛집과 전통 요리를 소개합니다." },
            { icon: <Mountain className="text-blue-500" />, title: "아웃도어 액티비티", desc: "등산, 서핑, 요가 등 활동적인 체험을 이끄세요." },
            { icon: <Heart className="text-pink-500" />, title: "웰빙 & 힐링", desc: "심신의 안정을 돕는 특별한 클래스를 만나보세요." },
            { icon: <Music className="text-purple-500" />, title: "예술 & 공연", desc: "함께 즐기는 콘서트나 예술 창작 활동에 참여하세요." },
            { icon: <Users className="text-green-600" />, title: "비즈니스 네트워킹", desc: "현지 창업가, 전문가들과 교류하며 인사이트를 얻으세요." }
          ].map((item, i) => (
            <div key={i} className="flex gap-4 group">
              <div className="shrink-0 w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-gray-100 transition">
                {item.icon}
              </div>
              <div>
                <h4 className="font-bold mb-1 text-lg">{item.title}</h4>
                <p className="text-sm text-[#717171] leading-snug">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. 브랜드 파워 및 수치 섹션 (Social Proof) */}
      <section className="py-24 px-6 bg-[#F7F7F7] text-center border-y border-gray-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[32px] font-extrabold mb-4 tracking-tight leading-tight">
            여행 업계에서 가장 사랑받는<br />로컬 커뮤니티.
          </h2>
          <p className="text-[#717171] mb-12">전 세계 수천 명의 호스트와 여행자가 Locally와 함께합니다.</p>
          
          <div className="flex justify-center -space-x-4 mb-10">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-20 h-20 rounded-full border-[6px] border-white overflow-hidden shadow-sm bg-gray-200">
                <img src={`https://i.pravatar.cc/150?u=${i + 10}`} className="w-full h-full object-cover" alt="User"/>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-3xl shadow-sm">
               <div className="text-3xl font-black mb-1 text-[#FF385C]">800+</div>
               <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hosts</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm">
               <div className="text-3xl font-black mb-1 text-[#FF385C]">5+</div>
               <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cities</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm">
               <div className="text-3xl font-black mb-1 text-[#FF385C]">3+</div>
               <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Countries</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm">
               <div className="text-3xl font-black mb-1 text-[#FF385C]">4.9</div>
               <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. 기능별 설명 섹션 (Mockup & Description) */}
      <section className="py-24 px-6 max-w-6xl mx-auto space-y-32">
        {/* 여행자용 */}
        <div className="flex flex-col md:flex-row items-center gap-16 md:gap-24">
          <div className="flex-1">
            <h3 className="text-3xl font-extrabold mb-6 leading-tight">나만의 취향을<br />발견하세요</h3>
            <p className="text-[#717171] text-lg leading-relaxed">
              획일화된 패키지 여행은 그만. 요리, 예술, 아웃도어 등 당신의 관심사에 딱 맞는 로컬 경험을 찾아보세요.
              새로운 세상을 만나는 가장 쉬운 방법입니다.
            </p>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="w-72 h-[500px] border-[10px] border-[#222222] rounded-[2.5rem] bg-white overflow-hidden shadow-2xl relative group">
               <img src="https://images.unsplash.com/photo-1540555700478-4be289fbecee?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" alt="Traveler"/>
               <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20 text-white">
                  <div className="font-bold text-xl mb-1">Explore Seoul</div>
                  <div className="text-xs opacity-80">Discover hidden gems</div>
               </div>
            </div>
          </div>
        </div>

        {/* 호스트용 (Reverse Layout) */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-16 md:gap-24">
          <div className="flex-1 text-right md:text-left">
            <h3 className="text-3xl font-extrabold mb-6 leading-tight">당신의 일상이<br />여행이 됩니다</h3>
            <p className="text-[#717171] text-lg leading-relaxed">
              남는 방, 취미, 재능을 공유하고 수입을 만드세요. 
              전 세계에서 온 여행자들을 만나고 새로운 문화를 경험할 수 있습니다.
              Locally가 안전한 호스팅을 지원합니다.
            </p>
          </div>
          <div className="flex-1 flex justify-center md:justify-start">
             <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center shadow-sm">
                   <Calendar className="text-[#FF385C] mb-3 w-8 h-8" />
                   <div className="font-bold">자유로운 일정</div>
                </div>
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center shadow-sm">
                   <MessageSquare className="text-[#FF385C] mb-3 w-8 h-8" />
                   <div className="font-bold">실시간 소통</div>
                </div>
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center shadow-sm col-span-2">
                   <ShieldCheck className="text-[#FF385C] mb-3 w-8 h-8" />
                   <div className="font-bold">안전한 결제 보장</div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ 아코디언 섹션 */}
      <section className="py-24 px-6 bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-12">자주 묻는 질문</h2>
          <div className="space-y-4">
            {[
              { q: "Locally는 어떤 서비스인가요?", a: "Locally는 전 세계 현지인 호스트와 여행자를 연결하여, 가이드북에 없는 특별한 로컬 경험을 제공하는 플랫폼입니다." },
              { q: "체험 호스팅은 어떻게 시작하나요?", a: "상단 메뉴의 '호스트 되기' 버튼을 통해 누구나 신청할 수 있습니다. 간단한 프로필 작성과 체험 기획 후 승인을 받으면 활동이 가능합니다." },
              { q: "결제는 안전한가요?", a: "네, 모든 결제는 Locally의 보안 시스템을 통해 안전하게 처리되며, 체험이 완료된 후 호스트에게 정산됩니다." },
              { q: "예약을 취소하고 싶어요.", a: "마이페이지 > 여행 탭에서 예약을 관리할 수 있습니다. 호스트가 설정한 환불 정책에 따라 환불이 진행됩니다." }
            ].map((item, i) => (
              <details key={i} className="bg-white rounded-2xl p-6 shadow-sm group cursor-pointer hover:bg-white/80 transition">
                <summary className="flex items-center justify-between font-bold list-none text-lg">
                  {item.q}
                  <ChevronDown size={20} className="text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-4 text-[#717171] leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8. 최종 CTA & 푸터 */}
      <section className="bg-black py-24 px-6 text-center text-white">
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-8 tracking-tight leading-tight">
            지금 바로 Locally와<br />함께하세요.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
             <Link href="/">
               <button className="bg-[#FF385C] hover:bg-[#E01E5A] text-white px-10 py-5 rounded-xl font-bold text-xl transition-transform hover:scale-105 shadow-2xl w-full sm:w-auto">
                 여행 시작하기
               </button>
             </Link>
             <Link href="/become-a-host">
               <button className="bg-white text-black hover:bg-gray-100 px-10 py-5 rounded-xl font-bold text-xl transition-transform hover:scale-105 shadow-2xl w-full sm:w-auto">
                 호스트 되기
               </button>
             </Link>
          </div>
        </div>
        
        {/* Footer Links */}
        <div className="max-w-6xl mx-auto pt-12 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-gray-500 font-bold uppercase tracking-widest">
           <div>© 2026 Locally, Inc.</div>
           <div className="flex gap-8">
              <span className="cursor-pointer hover:text-white transition">About</span>
              <span className="cursor-pointer hover:text-white transition">Privacy</span>
              <span className="cursor-pointer hover:text-white transition">Terms</span>
              <span className="cursor-pointer hover:text-white transition">Contact</span>
           </div>
           <div className="flex gap-4 text-white">
              <span>KR</span>
              <span>₩ KRW</span>
           </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;