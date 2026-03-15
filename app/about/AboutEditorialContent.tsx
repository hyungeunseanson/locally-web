'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, CheckCircle2, Compass, Globe, Heart, MessageCircle, MoonStar, Palette, Search, ShieldCheck, ShoppingBag, Sparkles, Star, Trees, Users, UtensilsCrossed } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

const tastePillars = [
  {
    icon: Compass,
    title: '동네 산책과 일상 탐방',
    description: '길 하나, 빵집 하나, 작은 골목 하나까지. 관광보다 생활에 가까운 로컬 무드를 천천히 경험해보세요.',
  },
  {
    icon: UtensilsCrossed,
    title: '현지 식문화와 테이블',
    description: '이자카야, 빵집, 시장, 쿠킹 클래스까지. 한 도시의 취향이 음식으로 어떻게 이어지는지 만납니다.',
  },
  {
    icon: ShoppingBag,
    title: '빈티지와 취향 쇼핑',
    description: '가이드북 대신 호스트의 감각으로. 오래 머무는 사람만 아는 상점과 동네 취향을 따라갑니다.',
  },
  {
    icon: Trees,
    title: '도시 밖의 자연 액티비티',
    description: '조용한 워킹 코스, 바다, 숲과 같은 숨은 장소에서 여행의 리듬을 잠시 늦춰보세요.',
  },
  {
    icon: Palette,
    title: '아트와 원데이 클래스',
    description: '창작자와 함께하는 짧은 수업, 전시, 공방 경험으로 여행을 더 오래 남는 기억으로 만듭니다.',
  },
  {
    icon: MoonStar,
    title: '밤의 로컬 무드',
    description: '해가 진 뒤에 시작되는 도시의 분위기. 바, 야경, 심야 산책처럼 밤에만 열리는 감정을 소개합니다.',
  },
] as const;

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

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 py-5 md:py-6 cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h3 className="text-[16px] md:text-lg font-medium text-[#222222] group-hover:text-rose-600 transition-colors pr-8">{question}</h3>
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${isOpen ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
          <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="text-[14px] md:text-base text-[#717171] leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function AboutEditorialContent() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#222222] selection:bg-rose-100">
      <SiteHeader />

      <section className="relative pt-12 md:pt-24 pb-8 md:pb-16 px-4 md:px-6 max-w-[1440px] mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-12 lg:gap-20">
          <div className="flex-1 text-left lg:text-left z-10 lg:pl-10">
            <h1 className="text-[32px] md:text-7xl lg:text-8xl font-[900] tracking-tighter leading-[1.0] mb-4 md:mb-6 text-[#222222]">
              여행은 <br />
              <span className="text-rose-600">살아보는 거야.</span>
            </h1>
            <p className="text-[16px] md:text-2xl text-[#222222] font-serif italic mb-5 md:mb-8">
              &quot;Travel like a local with locals&quot;
            </p>
            <p className="text-[13px] md:text-lg text-[#717171] font-medium leading-relaxed max-w-lg mx-0 mb-7 md:mb-10">
              유명한 관광지가 아닌, 현지인의 일상 속으로.<br />
              전 세계의 이웃들이 당신을 기다립니다.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-start">
              <Link href="/">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-6 md:px-10 py-2.5 md:py-4 rounded-full font-bold text-[14px] md:text-lg transition-all shadow-xl hover:shadow-rose-200 hover:-translate-y-1">
                  여행 둘러보기
                </button>
              </Link>
              <Link href="/become-a-host">
                <button className="bg-white text-[#222222] border border-gray-200 hover:border-black px-6 md:px-10 py-2.5 md:py-4 rounded-full font-bold text-[14px] md:text-lg transition-all hover:-translate-y-1">
                  호스트 되기
                </button>
              </Link>
            </div>
          </div>

          <div className="flex-1 flex justify-center lg:justify-end relative">
            <div className="relative w-[260px] h-[520px] md:w-[340px] md:h-[680px] bg-black rounded-[44px] md:rounded-[60px] border-[9px] md:border-[12px] border-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-900/5 transform hover:scale-[1.01] transition-transform duration-500">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-3xl z-20"></div>
              <div className="w-full h-full bg-white pt-12 md:pt-14 pb-7 md:pb-8 px-5 md:px-6 flex flex-col justify-between">
                <div>
                  <div className="w-full h-12 rounded-full bg-slate-100 mb-8 flex items-center px-4 gap-3 shadow-inner">
                    <Search size={18} className="text-rose-500" />
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-bold text-black">어디로 떠나세요?</span>
                      <span className="text-[10px] text-slate-400">현지인 체험 검색</span>
                    </div>
                  </div>

                  <h3 className="font-black text-[20px] md:text-2xl mb-5 md:mb-6 leading-tight">내일 도쿄에서<br />진행되는 체험</h3>

                  <div className="space-y-5">
                    <div className="group cursor-pointer">
                      <div className="aspect-[4/3] rounded-2xl bg-slate-200 overflow-hidden relative shadow-md mb-3">
                        <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Activity" />
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold shadow-sm">오전 10시</div>
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur p-1.5 rounded-full shadow-sm">
                          <Heart size={14} className="text-rose-500 fill-rose-500" />
                        </div>
                      </div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm text-slate-900 leading-tight">마린과 함께하는<br />도쿄 빵집 투어</div>
                          <div className="text-slate-500 text-xs mt-1">₩35,000 / 인</div>
                        </div>
                        <div className="flex text-xs items-center font-bold gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          <Star size={10} className="fill-black" /> 4.98
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-around items-center text-slate-300">
                  <div className="flex flex-col items-center gap-1">
                    <Globe size={24} className="text-rose-500" />
                  </div>
                  <Heart size={24} />
                  <MessageCircle size={24} />
                  <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
                    <img src="https://i.pravatar.cc/150?u=user" className="w-full h-full object-cover opacity-80" alt="User profile preview" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-100/60 rounded-full blur-3xl -z-10"></div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-20 bg-[#F7F7F7]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-[18px] md:text-2xl font-bold mb-2 tracking-tight">가장 사랑받는 로컬 커뮤니티</h2>
            <p className="text-[#717171] text-xs md:text-sm">전 세계 여행자와 호스트가 만들어가는 따뜻한 연결</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[
              { label: 'Active Hosts', value: 800, suffix: '+' },
              { label: 'Cities', value: 5, suffix: '' },
              { label: 'Countries', value: 3, suffix: '' },
              { label: 'Avg Rating', value: 4.9, suffix: '' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 md:p-6 bg-white rounded-[24px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-[26px] md:text-4xl font-black text-[#222222] mb-1">
                  <AirbnbCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-28 px-4 md:px-6 max-w-[1440px] mx-auto">
        <div className="mb-8 md:mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 md:gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500 mb-4 md:mb-5">
              <Sparkles size={14} className="text-rose-500" />
              Curated on Locally
            </div>
            <h2 className="text-[29px] md:text-5xl font-[900] text-[#222222] mb-3 tracking-tight leading-[1.04]">
              당신의 취향을 발견하세요
            </h2>
            <p className="text-[15px] md:text-[19px] text-[#717171] leading-relaxed max-w-xl">
              가이드북에는 없는, 오직 로컬리에서만 가능한 경험들. 비교하는 리스트가 아니라 어떤 결의 여행을 좋아하는지부터 보여드립니다.
            </p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm md:text-base font-bold text-[#222222] hover:text-rose-600 transition-colors group">
            모든 체험 보기
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] items-stretch">
          <article className="relative overflow-hidden rounded-[28px] md:rounded-[36px] bg-[#222222] min-h-[440px] md:min-h-[560px]">
            <img
              src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&auto=format&fit=crop"
              alt="도쿄 골목의 로컬한 분위기"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            <div className="relative flex h-full flex-col justify-between p-6 md:p-9 text-white">
              <div className="flex flex-wrap gap-2">
                {['Tokyo morning', 'Neighborhood walk', 'Slow travel'].map((label) => (
                  <span key={label} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-white/90 backdrop-blur-sm">
                    {label}
                  </span>
                ))}
              </div>
              <div className="max-w-md">
                <p className="text-xs md:text-sm font-bold uppercase tracking-[0.22em] text-white/70 mb-3">Editor&apos;s Pick</p>
                <h3 className="text-[30px] md:text-[46px] font-[900] leading-[0.98] tracking-tight mb-4">
                  동네의 리듬을
                  <br />
                  따라가는 여행
                </h3>
                <p className="text-sm md:text-lg leading-relaxed text-white/85 max-w-md">
                  유명 스팟을 찍고 이동하는 일정이 아니라, 오래 머문 사람만 아는 속도와 취향을 따라가는 여행. 로컬리는 이런 경험을 큐레이션합니다.
                </p>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {tastePillars.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <article
                  key={pillar.title}
                  className="group flex h-full flex-col rounded-[26px] border border-stone-200 bg-white p-5 md:p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(15,23,42,0.08)]"
                >
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-[#222222] transition-colors group-hover:bg-rose-50 group-hover:text-rose-600">
                    <Icon size={22} strokeWidth={1.9} />
                  </div>
                  <h3 className="text-[18px] md:text-[20px] font-[800] leading-[1.2] tracking-tight text-[#222222] mb-3">
                    {pillar.title}
                  </h3>
                  <p className="text-[14px] md:text-[15px] leading-relaxed text-[#717171]">
                    {pillar.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 md:py-24 my-5 md:my-10">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16 mb-14 md:mb-24">
            <div className="flex-1 order-2 md:order-1 flex justify-center">
              <div className="relative w-[292px] md:w-[320px] bg-white rounded-[34px] md:rounded-[40px] shadow-xl p-5 md:p-6 border border-slate-100 transform rotate-[-1deg] hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border border-slate-100"><img src="https://i.pravatar.cc/150?u=host33" className="w-full h-full object-cover" alt="Host avatar preview" /></div>
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
            <div className="flex-1 order-1 md:order-2">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-rose-500">
                <MessageCircle size={28} />
              </div>
              <h3 className="text-[30px] md:text-4xl font-[900] mb-3 md:mb-4 leading-tight">여행 전부터 시작되는<br />현지인과의 소통</h3>
              <p className="text-[15px] md:text-lg text-slate-500 leading-relaxed">
                예약 전에도, 후에도 궁금한 점은 언제든 물어보세요.<br />
                맛집 추천부터 복장 팁까지, 호스트가 친절하게 알려드립니다.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-12 md:gap-16">
            <div className="flex-1">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-rose-500">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-[30px] md:text-4xl font-[900] mb-3 md:mb-4 leading-tight">복잡한 계획 없이<br />떠나는 자유로움</h3>
              <p className="text-[15px] md:text-lg text-slate-500 leading-relaxed">
                일일이 검색하고 예약할 필요 없습니다.<br />
                현지 호스트가 검증한 최적의 코스로 편안하게 즐기세요.
              </p>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="relative w-[292px] md:w-[320px] bg-white rounded-[34px] md:rounded-[40px] shadow-xl p-6 md:p-8 border border-slate-100 transform rotate-[1deg] hover:rotate-0 transition-transform duration-500">
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

      <section className="py-12 md:py-24 px-4 md:px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <ShieldCheck size={32} className="text-rose-600" />
            <span className="text-[22px] md:text-2xl font-black italic tracking-tighter">Locally Cover</span>
          </div>
          <h2 className="text-[20px] md:text-3xl font-[900] mb-8 md:mb-12">안전한 여행을 위한 약속</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-5 md:p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-900"><Users size={20} /></div>
              <h4 className="font-bold text-[16px] md:text-lg mb-2">신원 인증</h4>
              <p className="text-sm text-slate-500">모든 호스트와 게스트는 엄격한 신원 확인 절차를 거칩니다.</p>
            </div>
            <div className="p-5 md:p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-900"><ShieldCheck size={20} /></div>
              <h4 className="font-bold text-[16px] md:text-lg mb-2">안전 결제</h4>
              <p className="text-sm text-slate-500">체험이 완료될 때까지 결제 대금은 안전하게 보호됩니다.</p>
            </div>
            <div className="p-5 md:p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-900"><Heart size={20} /></div>
              <h4 className="font-bold text-[16px] md:text-lg mb-2">24시간 지원</h4>
              <p className="text-sm text-slate-500">여행 중 문제가 생기면 언제든 글로벌 지원팀이 도와드립니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-24 px-4 md:px-6 max-w-3xl mx-auto border-t border-gray-100">
        <h2 className="text-[20px] md:text-3xl font-[900] mb-8 md:mb-12">자주 묻는 질문</h2>
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

      <section className="py-16 md:py-32 px-4 md:px-6 bg-[#222222] text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[30px] md:text-6xl font-[900] mb-6 md:mb-10 tracking-tight leading-tight">
            지금 바로 Locally와<br />함께하세요.
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
            <Link href="/">
              <button className="bg-rose-600 hover:bg-rose-700 text-white px-7 md:px-12 py-3 md:py-5 rounded-full font-bold text-[14px] md:text-xl transition-all shadow-xl hover:shadow-rose-900/50 hover:scale-105">
                여행 시작하기
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="bg-transparent border-2 border-white/20 text-white hover:bg-white hover:text-black px-7 md:px-12 py-3 md:py-5 rounded-full font-bold text-[14px] md:text-xl transition-all hover:scale-105">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
