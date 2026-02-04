'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Globe, DollarSign, Calendar, MessageCircle, ShieldCheck, 
  Star, ArrowRight, CheckCircle2, ChevronDown, ChevronUp // 👈 여기 추가됨
} from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

export default function BecomeHostPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main>
        {/* 1. 히어로 섹션 (초대형 타이포) */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <span className="text-rose-600 font-bold tracking-wide text-sm">LOCALLY HOST</span>
            <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
              좋아하는 일을 하며<br/>
              <span className="text-rose-600">수입</span>을 올리세요.
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed max-w-lg">
              수많은 게스트의 시선을 사로잡을 독특한<br/>
              로컬리 체험을 만들어 보세요.
            </p>
            <Link href="/host/register">
              <button className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:scale-105 transition-transform shadow-xl shadow-rose-200">
                시작하기
              </button>
            </Link>
          </div>
          {/* 우측 이미지 그리드 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4 mt-12">
              <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80" className="rounded-[2rem] w-full h-64 object-cover shadow-2xl hover:-translate-y-2 transition-transform duration-500"/>
              <img src="https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80" className="rounded-[2rem] w-full h-48 object-cover shadow-2xl hover:-translate-y-2 transition-transform duration-500"/>
            </div>
            <div className="space-y-4">
              <img src="https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80" className="rounded-[2rem] w-full h-48 object-cover shadow-2xl hover:-translate-y-2 transition-transform duration-500"/>
              <img src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80" className="rounded-[2rem] w-full h-64 object-cover shadow-2xl hover:-translate-y-2 transition-transform duration-500"/>
            </div>
          </div>
        </section>

        {/* 2. 가치 제안 (3단 그리드) */}
        <section className="bg-slate-50 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="text-4xl font-black mb-6">어디서도 만나볼 수 없는<br/>독특한 체험을 호스팅하세요</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-10">
              <FeatureCard 
                icon={<Globe className="w-8 h-8 text-blue-600"/>}
                title="내가 사는 도시의 매력 소개"
                desc="랜드마크, 박물관, 숨겨진 골목 맛집까지. 당신만이 아는 특별한 일정을 공유하세요."
              />
              <FeatureCard 
                icon={<DollarSign className="w-8 h-8 text-green-600"/>}
                title="취미를 수익으로 연결"
                desc="맛집 탐방, 등산, 쇼핑 등 평소 즐기던 활동을 하며 쏠쏠한 부수입을 창출하세요."
              />
              <FeatureCard 
                icon={<Calendar className="w-8 h-8 text-purple-600"/>}
                title="유연한 일정 관리"
                desc="주말, 평일 저녁, 혹은 한 달에 한 번. 내가 원하는 시간에만 자유롭게 활동하세요."
              />
            </div>
          </div>
        </section>

        {/* 3. 앱 목업 섹션 (지그재그 레이아웃) */}
        <div className="max-w-7xl mx-auto px-6 py-32 space-y-32">
          
          {/* 섹션 A: 게스트와 소통 */}
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 order-2 md:order-1 flex justify-center">
               {/* 폰 목업 CSS */}
               <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20"></div>
                 <div className="w-full h-full bg-white pt-12 px-4 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                      <div className="h-3 w-32 bg-slate-100 rounded"></div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-xs text-slate-500">
                        안녕하세요! 이번 주말 투어 예약했습니다.
                      </div>
                      <div className="bg-rose-500 text-white p-3 rounded-2xl rounded-tr-none text-xs self-end ml-auto w-fit">
                        환영합니다! 맛집 리스트 준비해둘게요 :)
                      </div>
                      <img src="https://images.unsplash.com/photo-1559333086-b0a56225a93c" className="w-full h-40 object-cover rounded-xl mt-2"/>
                    </div>
                 </div>
               </div>
            </div>
            <div className="flex-1 order-1 md:order-2">
              <h3 className="text-3xl font-black mb-6">게스트와 간편한 소통</h3>
              <p className="text-xl text-slate-500 leading-relaxed">
                앱 내 채팅 기능을 통해 게스트와 실시간으로 대화하세요.<br/>
                예약 문의부터 만남 장소 공유까지,<br/>
                개인 연락처 노출 없이 안전하게 소통할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 섹션 B: 예약 및 일정 관리 */}
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <h3 className="text-3xl font-black mb-6">내 스케줄에 맞춘 호스팅</h3>
              <p className="text-xl text-slate-500 leading-relaxed">
                달력에서 가능한 날짜만 콕콕 찍어 오픈하세요.<br/>
                갑작스러운 일정 변경도 간편하게 관리할 수 있습니다.<br/>
                구글 캘린더 연동으로 더 스마트하게!
              </p>
            </div>
            <div className="flex-1 flex justify-center">
               <div className="relative w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20"></div>
                 <div className="w-full h-full bg-white pt-14 px-6">
                    <h4 className="font-bold text-xl mb-6">5월 일정</h4>
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold mb-4">
                      {['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {[...Array(31)].map((_,i) => (
                        <div key={i} className={`h-8 w-8 rounded-full flex items-center justify-center text-xs ${[3,4,10,11,17,18].includes(i) ? 'bg-black text-white' : 'text-slate-300'}`}>
                          {i+1}
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-500 mb-1">5월 4일 (토)</div>
                      <div className="font-bold">을지로 노포 투어</div>
                      <div className="text-sm text-rose-500 mt-2">예약 4명 (마감)</div>
                    </div>
                 </div>
               </div>
            </div>
          </div>

        </div>

        {/* 4. FAQ 및 하단 CTA */}
        <section className="bg-slate-50 py-24 border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-4xl font-black mb-12 text-center">자주 묻는 질문</h2>
            <div className="space-y-4">
              <FAQItem q="외국어를 원어민처럼 잘해야 하나요?" a="아니요! 기본적인 의사소통만 가능하다면 충분합니다. 번역기 앱을 활용해도 괜찮습니다. 중요한 건 친절한 태도입니다."/>
              <FAQItem q="자격증이 반드시 필요한가요?" a="전문 가이드 자격증은 필수가 아닙니다. 로컬리는 '현지인 친구' 컨셉을 지향합니다. 다만 전문 지식이 필요한 투어는 소개에 명시해 주세요."/>
              <FAQItem q="수수료는 얼마인가요?" a="호스트 수수료는 20%입니다. 설정하신 금액의 80%가 정산됩니다. 게스트에게는 별도의 플랫폼 수수료가 부과됩니다."/>
            </div>

            <div className="mt-24 text-center">
              <h2 className="text-4xl font-black mb-8">지금 바로 시작해보세요</h2>
              <Link href="/host/register">
                <button className="bg-rose-600 hover:bg-rose-700 text-white px-16 py-6 rounded-2xl font-bold text-xl shadow-xl hover:scale-105 transition-transform">
                  호스트 등록하기
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="flex flex-col items-start text-left">
      <div className="mb-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string, a: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center py-6 text-left hover:text-rose-600 transition-colors">
        <span className="font-bold text-lg">{q}</span>
        {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
      </button>
      {isOpen && <div className="pb-6 text-slate-600 leading-relaxed">{a}</div>}
    </div>
  );
}