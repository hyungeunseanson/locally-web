'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft, Clock, Users, Globe2, MapPin,
    Star, CheckCircle, XCircle, Share2, Heart,
    ArrowRight, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

// ── 아이콘 그리드 데이터 ──────────────────────────────────────────
const QUICK_FACTS = [
    { icon: Clock, label: '소요 시간', val: '최소 4시간 (협의 가능)' },
    { icon: Users, label: '최대 인원', val: '1팀 최대 4명 (추가금 없음)' },
    { icon: Globe2, label: '언어', val: '한국어 레벨 3~4 (중·고급)' },
    { icon: MapPin, label: '지역', val: '도쿄 · 오사카 · 후쿠오카' },
];

// ── 추천 대상 ────────────────────────────────────────────────────
const RECOMMENDED = [
    '전자상가·로컬샵에서 상품 정보를 물어보고 구매하고 싶을 때',
    '부동산·병원·미용실 등 일본어 상담만 가능한 곳을 방문해야 할 때',
    '언어 걱정 없이 온전히 풍경과 분위기에 집중하고 싶을 때',
    '특정 상권을 벤치마킹하며 현지인 관점의 설명이 필요할 때',
];

// ── 포함/불포함 내역 ──────────────────────────────────────────────
const INCLUDES: string[] = []; // 포함 내역은 서비스 특성상 없음 (호스트 안내 자체가 서비스)
const EXCLUDES = [
    '고객 본인 모든 경비 (교통비, 식비, 입장료, 쇼핑비)',
    '호스트 경비 (동행 시 입장료, 식사비 등)',
    '호스트 기본 교통비(1,000엔) 초과 원거리 이동비',
    '전문 비즈니스 미팅 · 계약 통역 (별도 문의)',
];

// ── 후기 샘플 ─────────────────────────────────────────────────────
const REVIEWS = [
    { name: '이지원 님', city: '도쿄', rating: 5, text: '병원 예약부터 통역까지 완벽히 도와주셨어요. 혼자였으면 절대 못 했을 것들을 해결할 수 있었어요!' },
    { name: 'Jessica M.', city: '오사카', rating: 5, text: 'The host was incredibly helpful and patient. Felt like traveling with a local friend.' },
    { name: '박민준 님', city: '후쿠오카', rating: 5, text: '현지 로컬 가게들을 알려주셔서 너무 좋았습니다. 가격 흥정도 도와주셔서 쇼핑이 즐거웠어요.' },
    { name: '김서연 님', city: '도쿄', rating: 5, text: '일본어를 전혀 못해도 전혀 불편함이 없었어요. 덕분에 여행이 10배는 더 편해졌습니다.' },
];

export default function ServiceIntroPage() {
    const router = useRouter();
    const [wishlist, setWishlist] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 80);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const displayedReviews = showAllReviews ? REVIEWS : REVIEWS.slice(0, 2);

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans">
            <SiteHeader />

            {/* ── 히어로 이미지 영역 ─────────────────────────────────────── */}
            <div className="relative w-full h-[52vw] max-h-[520px] min-h-[240px] bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 overflow-hidden">
                {/* 그라디언트 오버레이 */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.25),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.15),transparent_60%)]" />

                {/* 떠다니는 장식 아이콘 */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                    <span className="absolute top-[15%] left-[8%] text-[42px] drop-shadow opacity-80 animate-[float_6s_ease-in-out_infinite]">🗾</span>
                    <span className="absolute top-[20%] right-[10%] text-[34px] drop-shadow opacity-70 animate-[float_8s_ease-in-out_0.5s_infinite]">🌸</span>
                    <span className="absolute bottom-[25%] left-[18%] text-[28px] drop-shadow opacity-60 animate-[float_7s_ease-in-out_1s_infinite]">🍣</span>
                    <span className="absolute bottom-[30%] right-[14%] text-[32px] drop-shadow opacity-75 animate-[float_9s_ease-in-out_2s_infinite]">⛩️</span>
                    <span className="absolute top-[45%] left-[40%] text-[22px] drop-shadow opacity-50 animate-[float_5s_ease-in-out_1.5s_infinite]">🎌</span>
                </div>

                {/* 중앙 배지 + 타이틀 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">BEST</span>
                        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg"><Sparkles size={9} />MD Pick</span>
                        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">SALE</span>
                    </div>
                    <h1 className="text-white font-black text-[18px] md:text-3xl lg:text-4xl leading-tight max-w-2xl drop-shadow-lg">
                        일본 현지인 통역 동행<br />
                        <span className="text-emerald-300">맞춤형 가이드 서비스</span>
                    </h1>
                    <p className="text-white/70 text-[12px] md:text-base">시간당 제공 · 로컬리 검증 호스트</p>
                </div>

                {/* 뒤로가기 + 액션 버튼 */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    <button
                        onClick={() => router.back()}
                        className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-colors text-slate-800"
                    >
                        <ChevronLeft size={18} />
                    </button>
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-colors text-slate-700">
                        <Share2 size={15} />
                    </button>
                    <button
                        onClick={() => setWishlist(!wishlist)}
                        className={`w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-colors ${wishlist ? 'text-rose-500' : 'text-slate-700'}`}
                    >
                        <Heart size={15} className={wishlist ? 'fill-current' : ''} />
                    </button>
                </div>
            </div>

            {/* ── 본문 + 사이드바 레이아웃 ──────────────────────────────── */}
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
                <div className="md:flex md:gap-12 lg:gap-16 relative items-start">

                    {/* ╔═══════════════ 왼쪽 메인 콘텐츠 ═══════════════╗ */}
                    <div className="flex-1 min-w-0 pb-28 md:pb-0">

                        {/* ── 제목 + 평점 + 위치 ── */}
                        <div className="mb-5 md:mb-6">
                            <h2 className="text-[20px] md:text-[28px] font-black leading-tight tracking-tight text-slate-900 mb-2">
                                일본 현지인 통역 동행 및 가이드 서비스
                                <span className="text-slate-400 font-medium"> (맞춤형/시간당)</span>
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] md:text-[13px] text-slate-600">
                                <span className="flex items-center gap-1">
                                    <Star size={13} className="fill-slate-900 text-slate-900" />
                                    <strong>5.0</strong>
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="underline underline-offset-2 cursor-pointer hover:text-slate-900">후기 {REVIEWS.length}개</span>
                                <span className="text-slate-300">·</span>
                                <span className="flex items-center gap-1"><MapPin size={11} />일본 전역</span>
                            </div>
                        </div>

                        {/* ── 구분선 ── */}
                        <div className="border-t border-slate-100 mb-6" />

                        {/* ── 아이콘 그리드 요약 ── */}
                        <div className="grid grid-cols-2 gap-3 mb-7">
                            {QUICK_FACTS.map((f) => {
                                const Icon = f.icon;
                                return (
                                    <div key={f.label} className="flex items-start gap-3 bg-slate-50 rounded-2xl px-3.5 py-3.5 border border-slate-100/80">
                                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                                            <Icon size={16} className="text-slate-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] md:text-[11px] text-slate-400 font-semibold mb-0.5">{f.label}</p>
                                            <p className="text-[12px] md:text-[13px] font-bold text-slate-800 leading-snug">{f.val}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── 구분선 ── */}
                        <div className="border-t border-slate-100 mb-6" />

                        {/* ── 서비스 소개 ── */}
                        <section className="mb-7">
                            <h3 className="text-[16px] md:text-xl font-black mb-3 flex items-center gap-2">
                                <span className="text-xl">🇯🇵</span> 서비스 소개
                            </h3>
                            <div className="text-[13px] md:text-[14px] text-slate-600 leading-7 space-y-3">
                                <p>
                                    일본어가 걱정되어 일본 여행이 망설여지셨나요? <strong className="text-slate-900">이제 걱정 마세요.</strong>
                                    한국어를 유창하게 구사하는 일본인 현지 호스트가 여러분의 여행을 더욱 편리하게 만들어 드립니다.
                                </p>
                                <p>
                                    로컬리 현지인 한국어 동행 서비스는 여러분의 자유 일정에{' '}
                                    <strong className="text-slate-900">현지인 친구처럼 동행</strong>하며 모든 일본어 문제를 해결해 드립니다.
                                    단순한 여행 가이드가 아닌, 여러분의 일본 여행을 편안하게 서포트하는 <strong className="text-slate-900">현지 파트너</strong>입니다.
                                </p>
                            </div>
                        </section>

                        {/* ── 구분선 ── */}
                        <div className="border-t border-slate-100 mb-6" />

                        {/* ── 이런 분들에게 추천 ── */}
                        <section className="mb-7">
                            <h3 className="text-[16px] md:text-xl font-black mb-4">이런 분들에게 추천해요 ✅</h3>
                            <ul className="space-y-3">
                                {RECOMMENDED.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-[13px] md:text-[14px] text-slate-600">
                                        <CheckCircle size={17} className="text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* ── 구분선 ── */}
                        <div className="border-t border-slate-100 mb-6" />

                        {/* ── 포함 · 불포함 ── */}
                        <section className="mb-7">
                            <h3 className="text-[16px] md:text-xl font-black mb-4">비용 안내</h3>

                            {/* 포함 내역 — 핵심 서비스 */}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-3">
                                <p className="text-[11px] md:text-xs font-black text-emerald-700 uppercase tracking-widest mb-2.5">서비스 포함</p>
                                <ul className="space-y-2">
                                    {['한국어 가능 현지인 호스트 동행 (시간당)', '일본어 통·번역 전반', '현지 추천 장소 안내 및 정보 제공', '쇼핑·식당·기관 방문 지원'].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-[12px] md:text-[13px] text-emerald-800">
                                            <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* 불포함 내역 */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                <p className="text-[11px] md:text-xs font-black text-slate-500 uppercase tracking-widest mb-2.5">불포함 내역</p>
                                <ul className="space-y-2">
                                    {EXCLUDES.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-[12px] md:text-[13px] text-slate-600">
                                            <XCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* ── 구분선 ── */}
                        <div className="border-t border-slate-100 mb-6" />

                        {/* ── 후기 ── */}
                        <section className="mb-7">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-[16px] md:text-xl font-black flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                        <Star size={18} className="fill-slate-900 text-slate-900" />
                                        5.0
                                    </span>
                                    <span className="text-slate-400 font-normal text-[14px] md:text-base">후기 {REVIEWS.length}개</span>
                                </h3>
                            </div>

                            <div className="grid gap-4">
                                {displayedReviews.map((r, i) => (
                                    <div key={i} className="border border-slate-100 rounded-2xl p-4 md:p-5 bg-white [box-shadow:0_1px_6px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-1 mb-2">
                                            {Array.from({ length: r.rating }).map((_, j) => (
                                                <Star key={j} size={12} className="fill-slate-900 text-slate-900" />
                                            ))}
                                        </div>
                                        <p className="text-[12px] md:text-[13px] text-slate-700 leading-relaxed mb-3">"{r.text}"</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-black text-slate-600">
                                                {r.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-800">{r.name}</p>
                                                <p className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin size={9} />{r.city}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {REVIEWS.length > 2 && (
                                <button
                                    onClick={() => setShowAllReviews(!showAllReviews)}
                                    className="mt-4 flex items-center gap-1.5 text-[12px] md:text-[13px] font-bold text-slate-700 underline underline-offset-2 hover:text-slate-900 transition-colors"
                                >
                                    {showAllReviews ? (<><ChevronUp size={14} /> 접기</>) : (<><ChevronDown size={14} /> 후기 {REVIEWS.length}개 모두 보기</>)}
                                </button>
                            )}
                        </section>

                        {/* ── 구분선 ── */}
                        <div className="border-t border-slate-100 mb-6" />

                        {/* ── 유의사항 ── */}
                        <section className="mb-7">
                            <h3 className="text-[16px] md:text-xl font-black mb-3">💡 유의사항</h3>
                            <ul className="space-y-2 text-[12px] md:text-[13px] text-slate-500 leading-relaxed">
                                <li>· 입장료, 티켓, 교통비, 식사 비용은 모두 고객 부담입니다.</li>
                                <li>· 본 서비스는 전문 비즈니스 미팅, 계약 통역을 포함하지 않습니다. (별도 문의)</li>
                                <li>· 다른 날짜나 도시가 필요하시면 의뢰 작성 시 상세 내용란에 기재해 주세요.</li>
                                <li>· 의뢰 등록 후 호스트가 지원하면, 직접 선택하고 결제합니다.</li>
                            </ul>
                        </section>

                    </div>
                    {/* ╚════════════════════════════════════════════╝ */}

                    {/* ╔═══════════════ 오른쪽 사이드바 (데스크탑) ═══════════════╗ */}
                    <aside className="hidden md:block w-80 shrink-0">
                        <div className="sticky top-24">
                            <div className="border border-slate-200 rounded-3xl p-6 [box-shadow:0_6px_30px_rgba(0,0,0,0.1)] bg-white">
                                {/* 가격 */}
                                <div className="flex items-baseline gap-1.5 mb-1">
                                    <span className="text-[26px] font-black text-slate-900">₩35,000</span>
                                    <span className="text-[13px] text-slate-400 font-medium">/ 시간</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mb-4">최소 4시간 · 총 ₩140,000~</p>

                                {/* 평점 */}
                                <div className="flex items-center gap-1.5 text-[12px] text-slate-600 mb-5 pb-5 border-b border-slate-100">
                                    <Star size={13} className="fill-slate-900 text-slate-900" />
                                    <strong>5.0</strong>
                                    <span className="text-slate-400">·</span>
                                    <span className="underline underline-offset-2 cursor-pointer hover:text-slate-900">후기 {REVIEWS.length}개</span>
                                </div>

                                {/* 선택 - 지역 */}
                                <div className="border border-slate-200 rounded-2xl mb-3 overflow-hidden">
                                    <div className="px-3.5 py-2.5 border-b border-slate-100">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">희망 지역</p>
                                        <p className="text-[12px] font-medium text-slate-700">도쿄 / 오사카 / 후쿠오카</p>
                                    </div>
                                    <div className="px-3.5 py-2.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">소요 시간</p>
                                        <p className="text-[12px] font-medium text-slate-700">최소 4시간</p>
                                    </div>
                                </div>

                                {/* CTA */}
                                <Link href="/services/request">
                                    <button
                                        className="w-full py-3.5 rounded-2xl font-black text-[14px] text-white transition-all active:scale-[0.98] hover:opacity-90 mb-3"
                                        style={{ background: 'linear-gradient(135deg, #111827 0%, #1f2937 60%, #374151 100%)', boxShadow: '0 6px 20px rgba(17,24,39,0.30)' }}
                                    >
                                        의뢰 등록하기
                                    </button>
                                </Link>
                                <p className="text-[10px] text-slate-400 text-center">예약 확정 전까지 요금이 청구되지 않습니다</p>

                                {/* 합계 미리보기 */}
                                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                                    <div className="flex justify-between text-[12px] text-slate-500">
                                        <span>₩35,000 × 4시간</span><span>₩140,000</span>
                                    </div>
                                    <div className="flex justify-between text-[12px] text-slate-500">
                                        <span>서비스 수수료</span><span className="text-emerald-600">₩0</span>
                                    </div>
                                    <div className="flex justify-between text-[13px] font-black text-slate-900 pt-2 border-t border-slate-100">
                                        <span>최소 합계</span><span>₩140,000</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                    {/* ╚════════════════════════════════════════════╝ */}

                </div>
            </div>

            {/* ── 모바일 하단 고정 바 ──────────────────────────────────── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 [box-shadow:0_-4px_20px_rgba(0,0,0,0.08)]">
                <div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[20px] font-black text-slate-900">₩35,000</span>
                        <span className="text-[11px] text-slate-400">/ 시간</span>
                    </div>
                    <p className="text-[10px] text-slate-400">최소 4시간 · ₩140,000~</p>
                </div>
                <Link href="/services/request" className="flex-1 max-w-[200px]">
                    <button
                        className="w-full py-3 rounded-2xl font-black text-[13px] text-white active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #111827 0%, #374151 100%)', boxShadow: '0 4px 15px rgba(17,24,39,0.30)' }}
                    >
                        의뢰 등록하기 <ArrowRight size={14} />
                    </button>
                </Link>
            </div>

            {/* float 키프레임 */}
            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(2deg); }
          75% { transform: translateY(4px) rotate(-1deg); }
        }
      `}</style>
        </div>
    );
}
