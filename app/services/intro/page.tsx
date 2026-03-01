'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft, Clock, Users, Star, Shield, Zap, Check, ArrowRight, MapPin
} from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

const FEATURES = [
    {
        icon: <Shield size={22} className="text-blue-500" />,
        title: '검증된 현지인 가이드',
        desc: '로컬리가 직접 심사한 현지 거주 호스트만 활동합니다.',
    },
    {
        icon: <Zap size={22} className="text-amber-500" />,
        title: '빠른 매칭',
        desc: '의뢰 등록 후 보통 수 시간 안에 복수의 호스트가 지원합니다.',
    },
    {
        icon: <Clock size={22} className="text-emerald-500" />,
        title: '정찰제 요금',
        desc: '시간당 ₩35,000 — 숨겨진 추가 비용 없이 투명한 가격.',
    },
    {
        icon: <Users size={22} className="text-purple-500" />,
        title: '1:1 맞춤 서비스',
        desc: '병원 통역·쇼핑 동행·공항 픽업 등 원하는 일정에 딱 맞춥니다.',
    },
];

const HOW_IT_WORKS = [
    { step: '01', title: '의뢰 작성', desc: '날짜·도시·필요 언어·상세 내용을 입력하세요. 5분이면 충분합니다.' },
    { step: '02', title: '호스트 지원', desc: '해당 지역 현지인 호스트들이 어필 메시지와 함께 지원합니다.' },
    { step: '03', title: '호스트 선택 & 결제', desc: '프로필을 비교하고 마음에 드는 호스트를 선택한 뒤 결제합니다.' },
    { step: '04', title: '현장 서비스', desc: '약속 당일, 선택된 호스트가 함께합니다.' },
];

const REVIEWS = [
    { name: '이지원 님', city: '도쿄', rating: 5, text: '병원 예약부터 통역까지 완벽하게 도와주셨어요. 다음에도 꼭 이용할게요!' },
    { name: 'Jessica M.', city: '오사카', rating: 5, text: 'Amazing service! The host helped me navigate the whole city with ease.' },
    { name: '박민준 님', city: '후쿠오카', rating: 5, text: '쇼핑 동행 서비스가 너무 좋았어요. 현지만 아는 숨겨진 가게들을 알려줬어요.' },
];

export default function ServiceIntroPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans">
            <SiteHeader />

            {/* 뒤로가기 */}
            <div className="max-w-2xl mx-auto px-4 pt-5 md:pt-8">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-[12px] md:text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <ChevronLeft size={16} /> 뒤로
                </button>
            </div>

            {/* Hero */}
            <section className="max-w-2xl mx-auto px-4 pt-8 pb-10 text-center">
                <div className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1 text-[11px] md:text-xs font-semibold text-slate-600 mb-4">
                    <Zap size={11} className="text-amber-500" /> NEW · 맞춤 동행 서비스
                </div>
                <h1 className="text-[26px] md:text-[40px] font-black tracking-tight leading-tight mb-4">
                    나에게 꼭 맞는<br />
                    <span className="text-slate-900">현지인 가이드</span>를 직접 고르세요
                </h1>
                <p className="text-[14px] md:text-lg text-slate-500 leading-relaxed mb-8">
                    의뢰를 올리면 현지 호스트들이 직접 지원합니다.<br className="hidden md:block" />
                    병원 통역·쇼핑 동행·공항 픽업 — 어떤 상황도 OK.
                </p>
                <Link href="/services/request">
                    <button className="inline-flex items-center gap-2 bg-slate-900 text-white px-7 py-4 rounded-2xl font-black text-[15px] md:text-base hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl active:scale-[0.98]">
                        맞춤 의뢰 시작하기 <ArrowRight size={18} />
                    </button>
                </Link>
                <p className="text-[11px] md:text-xs text-slate-400 mt-3">시간당 ₩35,000 · 최소 4시간 · 결제는 호스트 선택 후</p>
            </section>

            {/* 가격 하이라이트 */}
            <section className="bg-slate-50 border-y border-slate-100 py-8 md:py-10">
                <div className="max-w-2xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 text-center">
                    <div>
                        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">시간당 요금</p>
                        <p className="text-[28px] md:text-4xl font-black text-slate-900">₩35,000</p>
                    </div>
                    <div className="hidden md:block w-px h-12 bg-slate-200" />
                    <div>
                        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">최소 이용 시간</p>
                        <p className="text-[28px] md:text-4xl font-black text-slate-900">4시간</p>
                    </div>
                    <div className="hidden md:block w-px h-12 bg-slate-200" />
                    <div>
                        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">평균 지원자</p>
                        <p className="text-[28px] md:text-4xl font-black text-slate-900">3~5명</p>
                    </div>
                </div>
            </section>

            {/* 서비스 특징 */}
            <section className="max-w-2xl mx-auto px-4 py-10 md:py-14">
                <h2 className="text-[18px] md:text-2xl font-black text-center mb-8">왜 로컬리 맞춤 의뢰인가요?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="flex items-start gap-4 bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                                {f.icon}
                            </div>
                            <div>
                                <p className="font-bold text-[13px] md:text-sm text-slate-900 mb-0.5">{f.title}</p>
                                <p className="text-[12px] md:text-[13px] text-slate-500 leading-relaxed">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 이용 방법 */}
            <section className="bg-slate-50 border-y border-slate-100 py-10 md:py-14">
                <div className="max-w-2xl mx-auto px-4">
                    <h2 className="text-[18px] md:text-2xl font-black text-center mb-8">이렇게 진행돼요</h2>
                    <div className="space-y-5">
                        {HOW_IT_WORKS.map((step, i) => (
                            <div key={i} className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                                    {step.step}
                                </div>
                                <div className="pt-1">
                                    <p className="font-bold text-[13px] md:text-sm text-slate-900 mb-0.5">{step.title}</p>
                                    <p className="text-[12px] md:text-[13px] text-slate-500 leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 이용 후기 */}
            <section className="max-w-2xl mx-auto px-4 py-10 md:py-14">
                <h2 className="text-[18px] md:text-2xl font-black text-center mb-8">실제 후기</h2>
                <div className="space-y-4">
                    {REVIEWS.map((r, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 [box-shadow:0_1px_6px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-1.5 mb-1">
                                {Array.from({ length: r.rating }).map((_, j) => (
                                    <Star key={j} size={13} className="fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <p className="text-[12px] md:text-[13px] text-slate-700 leading-relaxed mb-2">"{r.text}"</p>
                            <div className="flex items-center gap-1 text-[11px] md:text-xs text-slate-400">
                                <MapPin size={10} /> {r.city} · {r.name}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 하단 CTA */}
            <section className="bg-slate-900 text-white py-12 md:py-16">
                <div className="max-w-2xl mx-auto px-4 text-center">
                    <h2 className="text-[20px] md:text-3xl font-black mb-3">지금 바로 시작해보세요</h2>
                    <p className="text-[13px] md:text-base text-slate-400 mb-8">현지인이 직접 지원하는, 나만을 위한 여행 파트너.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <Link href="/services/request">
                            <button className="inline-flex items-center gap-2 bg-white text-slate-900 px-7 py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-100 transition-colors shadow-lg active:scale-[0.98]">
                                맞춤 의뢰 시작하기 <ArrowRight size={18} />
                            </button>
                        </Link>
                        <Link href="/services">
                            <button className="inline-flex items-center gap-2 bg-transparent border border-slate-600 text-slate-300 px-6 py-4 rounded-2xl font-semibold text-[13px] md:text-sm hover:border-slate-400 hover:text-white transition-colors">
                                <Check size={14} /> 현재 의뢰 목록 보기
                            </button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
