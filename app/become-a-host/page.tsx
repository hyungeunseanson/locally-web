'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Globe, DollarSign, Calendar, ChevronDown, ChevronUp, 
  CheckCircle2, ArrowRight, Star
} from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

export default function BecomeHostPage() {
  // 수익 계산기 상태
  const [guestCount, setGuestCount] = useState(10);
  const PRICE_PER_PERSON = 50000; // 1인당 평균 투어비
  const HOST_FEE_RATE = 0.2; // 수수료 20%
  const hostRevenue = Math.floor(PRICE_PER_PERSON * (1 - HOST_FEE_RATE)); // 호스트 실수령액

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-24">
      <SiteHeader />

      <main>
        {/* 1. 히어로 섹션 */}
        <section className="relative h-[500px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-slate-900">
            {/* 배경 이미지 (실제 이미지로 교체 권장) */}
            <img 
              src="https://images.unsplash.com/photo-1523539693385-e5e891eb4465?q=80&w=2000&auto=format&fit=crop" 
              className="w-full h-full object-cover opacity-60"
              alt="Background"
            />
          </div>
          <div className="relative z-10 text-center px-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <span className="inline-block px-4 py-1.5 rounded-full border border-white/30 bg-white/10 text-white text-xs font-bold mb-6 backdrop-blur-md">
              Locally Host
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              당신의 일상이<br/>누군가에겐 <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400">여행</span>이 됩니다.
            </h1>
            <p className="text-slate-200 text-lg md:text-xl max-w-xl mx-auto leading-relaxed mb-10">
              퇴근 후 맛집 탐방, 주말 등산, 단골 카페 수다...<br/>
              좋아하는 것을 외국인 친구와 함께하며 수익을 창출하세요.
            </p>
            <Link href="/host/create">
              <button className="bg-rose-500 hover:bg-rose-600 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl hover:scale-105">
                호스트 시작하기
              </button>
            </Link>
          </div>
        </section>

        {/* 2. 혜택 섹션 */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4">왜 로컬리 호스트인가요?</h2>
            <p className="text-slate-500">단순한 가이드가 아닙니다. 우리는 문화를 나누는 친구입니다.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-8 rounded-3xl text-center hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100 group">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Globe size={32}/>
              </div>
              <h3 className="text-xl font-bold mb-3">글로벌 인맥</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                전 세계에서 온 여행자들과 친구가 되어보세요.<br/>언어 교환은 물론, 새로운 문화를 경험할 수 있습니다.
              </p>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl text-center hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100 group">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <DollarSign size={32}/>
              </div>
              <h3 className="text-xl font-bold mb-3">쏠쏠한 부수입</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                내가 원하는 가격을 직접 설정하세요.<br/>취미 생활을 즐기면서 추가 수익을 만들 수 있습니다.
              </p>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl text-center hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-slate-100 group">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Calendar size={32}/>
              </div>
              <h3 className="text-xl font-bold mb-3">자유로운 일정</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                주말, 평일 저녁, 한 달에 한 번도 괜찮아요.<br/>내가 가능한 시간에만 투어를 열 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* 3. 수익 계산기 섹션 */}
        <section className="bg-black text-white py-24">
          <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <span className="text-rose-400 font-bold tracking-wider text-sm mb-2 block">EARNINGS</span>
              <h2 className="text-4xl font-black mb-6 leading-tight">얼마나 벌 수<br/>있을까요?</h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                서울 지역 평균 1인당 투어 요금은 50,000원입니다.<br/>
                한 달에 몇 명의 게스트를 만날 수 있을지 상상해 보세요.
              </p>
              <div className="flex items-center gap-4 text-sm font-medium">
                <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> 수수료 20% 제외</span>
                <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> 정산은 투어 다음날</span>
              </div>
            </div>

            <div className="flex-1 w-full bg-slate-800 rounded-3xl p-8 md:p-10 border border-slate-700 shadow-2xl">
              <div className="mb-8">
                <label className="block text-slate-400 text-sm font-bold mb-4">월간 게스트 수: <span className="text-white text-lg">{guestCount}명</span></label>
                <input 
                  type="range" min="1" max="50" step="1" 
                  value={guestCount} 
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full h-3 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                  <span>1명</span>
                  <span>50명</span>
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-2xl p-6 text-center border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">예상 월 수익</p>
                <h3 className="text-4xl font-black text-white">
                  ₩ {(guestCount * hostRevenue).toLocaleString()}
                </h3>
              </div>
            </div>
          </div>
        </section>

        {/* 4. FAQ 섹션 */}
        <section className="max-w-3xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-4">자주 묻는 질문</h2>
          </div>
          <div className="space-y-4">
            <FAQItem 
              q="외국어를 원어민처럼 잘해야 하나요?" 
              a="아니요! 기본적인 의사소통만 가능하다면 충분합니다. 번역기를 활용해도 괜찮습니다. 중요한 건 언어 실력보다 친절한 마음과 즐거운 분위기입니다."
            />
            <FAQItem 
              q="자격증이 필요한가요?" 
              a="전문 가이드 자격증은 필수가 아닙니다. 로컬리는 '현지인 친구' 컨셉의 여행을 지향합니다. 다만, 특정 전문 지식이 필요한 투어라면 관련 내용을 소개에 적어주세요."
            />
            <FAQItem 
              q="투어 코스는 어떻게 짜나요?" 
              a="본인이 평소에 즐겨 찾는 맛집, 산책로, 단골 카페 등을 엮어서 만들면 됩니다. 거창한 관광지가 아니어도 좋습니다. 현지인의 '찐' 일상을 공유해 주세요."
            />
            <FAQItem 
              q="정산은 언제 되나요?" 
              a="투어가 완료된 다음 날, 등록하신 계좌로 정산 금액이 입금됩니다. (주말/공휴일 제외)"
            />
          </div>
        </section>

        {/* 5. 하단 CTA 섹션 */}
        <section className="bg-slate-50 py-20 px-6 text-center border-t border-slate-100">
          <h2 className="text-3xl font-black mb-6">지금 바로 시작해보세요</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            망설이지 마세요. 당신의 평범한 하루가<br/>누군가에게는 평생 잊지 못할 추억이 됩니다.
          </p>
          <Link href="/host/create">
            <button className="bg-black text-white px-12 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl flex items-center gap-2 mx-auto">
              호스트 등록하기 <ArrowRight size={20}/>
            </button>
          </Link>
        </section>
      </main>

      {/* 모바일용 하단 고정 버튼 (스크롤 시 노출) */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-100 md:hidden z-50">
        <Link href="/host/create">
          <button className="w-full bg-rose-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg">
            호스트 시작하기
          </button>
        </Link>
      </div>
    </div>
  );
}

// FAQ 아이템 컴포넌트
function FAQItem({ q, a }: { q: string, a: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-white hover:border-black">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-6 text-left font-bold text-lg"
      >
        {q}
        {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 text-slate-600 leading-relaxed text-sm bg-slate-50 pt-4 border-t border-slate-100">
          {a}
        </div>
      )}
    </div>
  );
}