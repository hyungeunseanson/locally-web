'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Globe, DollarSign, Calendar, ChevronDown, ChevronUp, 
  ArrowRight, ShieldCheck, Heart, MessageCircle
} from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';

export default function BecomeHostPage() {
  const [hasApplication, setHasApplication] = useState(false);
  const supabase = createClient();

  // ✅ 유저의 신청 이력 확인 (버튼 링크 결정을 위해)
  useEffect(() => {
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('host_applications')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      
      if (data && data.length > 0) {
        setHasApplication(true);
      }
    };
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main>
        {/* 1. 히어로 섹션 */}
        <section className="max-w-[1440px] mx-auto px-6 py-20 lg:py-32 flex flex-col md:flex-row items-center justify-between gap-16">
          <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight">
              좋아하는 일을 하며<br/>
              <span className="text-rose-600">수입</span>을 올리세요.
            </h1>
            <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg">
              수많은 외국인 게스트의 시선을 사로잡을<br/>
              독특한 로컬리 체험을 만들어 보세요.
            </p>
            <div className="pt-4">
              {/* ✅ 스마트 버튼: 신청 이력이 있으면 대시보드, 없으면 등록 페이지 */}
              <Link href={hasApplication ? "/host/dashboard" : "/host/register"}>
                <button className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:shadow-xl hover:scale-105 transition-all duration-300">
                  {hasApplication ? "내 신청 현황 확인" : "시작하기"}
                </button>
              </Link>
            </div>
          </div>
          
          {/* 아이폰 목업 */}
          <div className="flex-1 flex justify-center md:justify-end relative">
             <div className="relative w-[340px] h-[680px] bg-black rounded-[60px] border-[12px] border-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-3xl z-20"></div>
                <div className="w-full h-full bg-white pt-14 pb-8 px-6 flex flex-col justify-between">
                   <div>
                      <div className="w-full h-12 rounded-full bg-slate-100 mb-8 flex items-center px-4 text-slate-400 text-sm">검색을 시작해 보세요</div>
                      <h3 className="font-black text-2xl mb-4">내일 서울에서<br/>진행되는 체험</h3>
                      <div className="space-y-4">
                         <div className="aspect-[4/3] rounded-2xl bg-slate-200 overflow-hidden relative">
                            <img src="https://images.unsplash.com/photo-1551632811-561732d1e306" className="w-full h-full object-cover"/>
                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-bold">오전 10시</div>
                         </div>
                         <div className="flex justify-between items-start">
                            <div>
                               <div className="font-bold text-sm">건축가와 함께하는 북촌 산책</div>
                               <div className="text-slate-500 text-xs mt-1">₩45,000 / 인</div>
                            </div>
                            <div className="flex text-[10px] items-center font-bold">★ 4.98</div>
                         </div>
                      </div>
                   </div>
                   <div className="border-t border-slate-100 pt-4 flex justify-around text-slate-300">
                      <div className="w-6 h-6 rounded bg-slate-200"></div>
                      <div className="w-6 h-6 rounded bg-rose-500"></div>
                      <div className="w-6 h-6 rounded bg-slate-200"></div>
                   </div>
                </div>
             </div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-100 rounded-full blur-3xl -z-10 opacity-50"></div>
          </div>
        </section>

        {/* 2. 혜택 섹션 */}
        <section className="bg-white py-32">
          <div className="max-w-[1440px] mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-black text-center mb-24 leading-tight">
              어디서도 만나볼 수 없는<br/>독특한 체험을 호스팅하세요
            </h2>
            
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-16">
              <FeatureItem 
                icon={<Globe className="w-10 h-10"/>}
                title="내가 사는 도시의 매력 소개"
                desc="랜드마크, 박물관, 문화 명소를 둘러보는 특별한 일정을 준비해 보세요."
              />
              <FeatureItem 
                icon={<Heart className="w-10 h-10"/>}
                title="좋아하는 것으로 수익 창출"
                desc="맛집 탐방, 등산, 쇼핑 등 평소 즐기던 활동을 하며 쏠쏠한 부수입을 만드세요."
              />
              <FeatureItem 
                icon={<Calendar className="w-10 h-10"/>}
                title="내 일정에 맞춘 자유로운 활동"
                desc="주말, 평일 저녁, 혹은 한 달에 한 번. 내가 원하는 시간에만 투어를 오픈하세요."
              />
            </div>
          </div>
        </section>

        {/* 3. 모바일 목업 섹션 */}
        <section className="bg-slate-50 py-32">
          <div className="max-w-[1440px] mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-20 mb-32">
               <div className="flex-1 order-2 md:order-1 flex justify-center">
                  <div className="relative w-[320px] bg-white rounded-[40px] shadow-2xl p-6 border border-slate-100 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden"><img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" className="w-full h-full object-cover"/></div>
                        <div><div className="font-bold text-sm">Alexi 님</div><div className="text-xs text-slate-500">예약 완료 · 5월 22일</div></div>
                     </div>
                     <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none text-sm text-slate-600 mb-4">
                        안녕하세요! 이번 주말 투어 정말 기대돼요. 혹시 채식 메뉴 추천도 가능할까요? 🥗
                     </div>
                     <div className="bg-rose-500 text-white p-4 rounded-2xl rounded-tr-none text-sm self-end ml-auto w-fit shadow-lg shadow-rose-200">
                        물론이죠! 비건 옵션이 훌륭한 식당 리스트를 이미 준비해뒀습니다 :)
                     </div>
                  </div>
               </div>
               <div className="flex-1 order-1 md:order-2">
                  <h3 className="text-3xl font-black mb-6">게스트와 간편한 소통</h3>
                  <p className="text-xl text-slate-500 leading-relaxed font-medium">
                     앱 내 채팅 기능을 통해 전 세계 게스트와 실시간으로 대화하세요.<br/>
                     개인 연락처 노출 걱정 없이 안전하게 소통할 수 있습니다.
                  </p>
               </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-20">
               <div className="flex-1">
                  <h3 className="text-3xl font-black mb-6">투명하고 신속한 정산</h3>
                  <p className="text-xl text-slate-500 leading-relaxed font-medium">
                     체험이 완료되면 다음 달 바로 입금됩니다.<br/>
                     복잡한 절차 없이 수익을 확인하고 관리하세요.
                  </p>
               </div>
               <div className="flex-1 flex justify-center">
                  <div className="relative w-[320px] bg-white rounded-[40px] shadow-2xl p-8 border border-slate-100 transform rotate-[2deg] hover:rotate-0 transition-transform duration-500 text-center">
                     <div className="text-slate-500 font-bold mb-2">5월 정산 예정 금액</div>
                     <div className="text-5xl font-black mb-8 tracking-tight">₩499,784</div>
                     <div className="space-y-4">
                        <div className="flex justify-between text-sm border-b border-slate-100 pb-4">
                           <span className="text-slate-500">지급 계좌</span>
                           <span className="font-bold">카카오뱅크 **** 1234</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-slate-500">다음 지급일</span>
                           <span className="font-bold text-green-600">내일</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* 4. FAQ 및 CTA */}
        <section className="py-32 max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-black mb-16 text-center">자주 묻는 질문</h2>
          <div className="space-y-6">
            <FAQItem q="외국어를 원어민처럼 잘해야 하나요?" a="아니요! 기본적인 의사소통만 가능하다면 충분합니다. 번역기 앱을 활용해도 괜찮습니다. 중요한 건 언어 실력보다 친절한 마음과 즐거운 분위기입니다."/>
            <FAQItem q="자격증이 필요한가요?" a="전문 가이드 자격증은 필수가 아닙니다. 로컬리는 '현지인 친구' 컨셉의 여행을 지향합니다. 다만, 특정 전문 지식이 필요한 투어라면 관련 내용을 소개에 적어주세요."/>
            <FAQItem q="수수료는 얼마인가요?" a="호스트 수수료는 20%입니다. 설정하신 금액의 80%가 정산됩니다. 게스트에게는 별도의 플랫폼 수수료가 부과됩니다."/>
          </div>

          <div className="mt-32 text-center bg-black rounded-[3rem] p-16 text-white relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-black mb-8">지금 바로 시작해보세요</h2>
                <p className="text-slate-400 text-lg mb-10">당신의 평범한 하루가 누군가에게는 잊지 못할 추억이 됩니다.</p>
                
{/* ✅ 수정된 CTA 버튼 영역 (교체용) */}
<div className="pt-4">
              <button 
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert("호스트 등록을 위해 먼저 로그인해 주세요.");
                    window.location.href = '/login'; // 로그인 페이지 또는 모달로 유도
                    return;
                  }
                  // 신청 이력이 있으면 대시보드, 없으면 등록 페이지
                  window.location.href = hasApplication ? "/host/dashboard" : "/host/register";
                }}
                className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {hasApplication ? "내 신청 현황 확인" : "시작하기"}
              </button>
            </div>
             </div>
             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-800 to-black z-0"></div>
             <div className="absolute -top-24 -right-24 w-96 h-96 bg-rose-600 rounded-full blur-[100px] opacity-30"></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: any) {
  return (
    <div className="flex flex-col items-start group">
      <div className="mb-6 p-4 rounded-2xl bg-slate-50 group-hover:bg-rose-50 transition-colors duration-300">
        {React.cloneElement(icon, { className: "w-8 h-8 text-slate-900 group-hover:text-rose-600 transition-colors" })}
      </div>
      <h3 className="text-2xl font-bold mb-3 leading-tight">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-lg">{desc}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string, a: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center py-8 text-left hover:text-rose-600 transition-colors">
        <span className="font-bold text-xl md:text-2xl">{q}</span>
        {isOpen ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
      </button>
      {isOpen && <div className="pb-8 text-slate-500 leading-relaxed text-lg">{a}</div>}
    </div>
  );
}