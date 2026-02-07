'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Users, Globe, ShieldCheck, Heart, ArrowRight } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader'; // ✅ 헤더 추가

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />

      {/* 1. 히어로 섹션: 차분한 톤의 브랜드 메시지 */}
      <section className="relative pt-32 pb-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-8 leading-tight">
            여행이 일상이 되는 곳, <br/>
            <span className="text-slate-600">Locally</span>입니다.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-light">
            우리는 낯선 도시를 여행하는 가장 좋은 방법은 <br className="hidden md:block"/>
            그곳에 사는 사람들과 연결되는 것이라고 믿습니다.
          </p>
        </div>
      </section>

      {/* 2. 브랜드 스토리 (이미지 + 텍스트 교차 배치) */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        {/* Story 1 */}
        <div className="flex flex-col md:flex-row items-center gap-16 mb-24">
          <div className="w-full md:w-1/2">
            <div className="aspect-[4/3] bg-slate-200 rounded-lg overflow-hidden relative shadow-sm">
              <img 
                src="https://images.unsplash.com/photo-1478860409698-8707f313ee8b?q=80&w=2070&auto=format&fit=crop" 
                alt="Community" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>
          <div className="w-full md:w-1/2 space-y-6">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase border-b border-slate-200 pb-2 inline-block">
              WHO WE ARE
            </div>
            <h2 className="text-3xl font-bold text-slate-800">
              관광객이 아닌,<br/>이웃으로 만나는 여행
            </h2>
            <p className="text-slate-600 leading-relaxed">
              가이드북에 나오는 유명한 명소도 좋지만, 
              현지인들만 아는 골목길의 작은 카페, 퇴근길의 풍경, 
              그리고 그들의 소소한 이야기를 듣는 것이야말로 진짜 여행 아닐까요?
            </p>
            <p className="text-slate-600 leading-relaxed">
              Locally는 전 세계 어디서든 당신을 반겨줄 '현지인 친구'를 찾아드립니다.
              단순한 가이드가 아닌, 당신의 취향을 공유할 수 있는 이웃을 만나보세요.
            </p>
          </div>
        </div>

        {/* Story 2 */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-16">
          <div className="w-full md:w-1/2">
            <div className="aspect-[4/3] bg-slate-200 rounded-lg overflow-hidden relative shadow-sm">
              <img 
                src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop" 
                alt="Connection" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>
          <div className="w-full md:w-1/2 space-y-6">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase border-b border-slate-200 pb-2 inline-block">
              OUR MISSION
            </div>
            <h2 className="text-3xl font-bold text-slate-800">
              경계 없는 연결,<br/>더 넓어지는 세상
            </h2>
            <p className="text-slate-600 leading-relaxed">
              우리는 기술을 통해 사람과 사람을 연결합니다. 
              언어와 문화의 장벽을 넘어, 서로의 삶을 이해하고 존중하는 
              글로벌 커뮤니티를 만들어가고 있습니다.
            </p>
            <p className="text-slate-600 leading-relaxed">
              당신의 재능과 일상이 누군가에게는 평생 잊지 못할 
              특별한 추억이 될 수 있습니다. Locally와 함께 세상의 경계를 허물어보세요.
            </p>
          </div>
        </div>
      </section>

      {/* 3. 핵심 가치 (아이콘 그리드 - 차분한 스타일) */}
      <section className="py-24 px-6 bg-slate-100/50">
        <div className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Locally가 약속합니다</h2>
          <p className="text-slate-600">안전하고 신뢰할 수 있는 커뮤니티를 위해 우리는 이 원칙을 지킵니다.</p>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 mb-6">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">사람 중심</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              모든 서비스의 중심에는 사람이 있습니다. 
              서로를 존중하고 배려하는 따뜻한 커뮤니티 문화를 만들어갑니다.
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 mb-6">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">신뢰와 안전</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              철저한 호스트 검증 시스템과 안전 결제 보호, 
              24시간 고객 지원을 통해 안심하고 여행할 수 있습니다.
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 mb-6">
              <Heart size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">다양성 존중</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              전 세계 다양한 문화와 배경을 가진 사람들이 모여 
              편견 없이 소통하고 교류하는 열린 공간을 지향합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 4. 통계 (심플한 숫자 강조) */}
      <section className="py-24 px-6 border-b border-slate-100">
        <div className="max-w-6xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">50+</div>
              <div className="text-sm font-medium text-slate-500">여행 가능한 도시</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">2,400+</div>
              <div className="text-sm font-medium text-slate-500">등록된 현지 호스트</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">18k+</div>
              <div className="text-sm font-medium text-slate-500">연결된 여행</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">4.9</div>
              <div className="text-sm font-medium text-slate-500">평균 사용자 평점</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 하단 CTA (여행자 & 호스트 모두에게) */}
      <section className="py-32 px-6 bg-white text-center">
        <div className="max-w-3xl mx-auto">
          <Globe className="w-12 h-12 text-slate-300 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
            당신의 다음 여정을 시작하세요.
          </h2>
          <p className="text-slate-500 mb-10 text-lg">
            새로운 세상을 만나는 가장 쉬운 방법, Locally가 함께합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <button className="px-8 py-4 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg min-w-[160px]">
                여행 떠나기
              </button>
            </Link>
            <Link href="/become-a-host">
              <button className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 hover:border-slate-300 transition-all min-w-[160px]">
                호스트 되기
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (메인 페이지와 동일한 스타일) */}
      <footer className="border-t border-slate-100 bg-slate-50 py-12 px-6">
        <div className="max-w-[1760px] mx-auto text-center text-sm text-slate-500">
          <div className="flex justify-center gap-6 font-bold text-slate-900 mb-6">
             <Link href="#" className="hover:underline">회사 소개</Link>
             <Link href="/help" className="hover:underline">도움말 센터</Link>
             <Link href="/terms" className="hover:underline">이용약관</Link>
          </div>
          <p>© 2026 Locally, Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}