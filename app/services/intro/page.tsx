'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    ChevronLeft, ChevronRight, Share, Heart, MapPin, Star, Globe,
    Check, X, Grid, Copy, ArrowLeft,
    Clock, Users, Globe2, Sparkles, AlertCircle
} from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { useToast } from '@/app/context/ToastContext';

// ── 사진 데이터 ───────────────────────────────────────────────
const PHOTOS = [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1542051812871-75f850b68a88?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1551482850-24982613ce43?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800',
];

// ── 핵심 요약 ────────────────────────────────────────────────
const QUICK_FACTS = [
    { icon: Clock, label: '소요 시간', val: '최소 4시간 (협의 가능)' },
    { icon: Users, label: '최대 인원', val: '1팀 4명 (추가금 없음)' },
    { icon: Globe2, label: '사용 언어', val: '한국어 레벨 3~4 (중·고급)' },
    { icon: MapPin, label: '가능 지역', val: '도쿄, 오사카, 후쿠오카' },
];

export default function ServiceIntroAirbnbStylePage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [isSaved, setIsSaved] = useState(false);
    const [isCopySuccess, setIsCopySuccess] = useState(false);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    // 예약(의뢰) 폼 상태
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(4);
    const [guests, setGuests] = useState(1);

    // 달력 상태
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysCount = getDaysInMonth(year, month);
        const startBlank = getFirstDay(year, month);
        const days = [];
        for (let i = 0; i < startBlank; i++) days.push(<div key={`empty-${i}`} />);
        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= daysCount; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isPast = dateStr < todayStr;
            const isSelected = date === dateStr;
            days.push(
                <button
                    key={d}
                    disabled={isPast}
                    onClick={() => setDate(dateStr)}
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium transition-all ${isSelected ? 'bg-black text-white' : ''} ${!isSelected && !isPast ? 'hover:bg-slate-100 hover:border-black border border-transparent' : ''} ${isPast ? 'text-slate-300 decoration-slate-300 line-through cursor-not-allowed' : ''}`}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    // 30분 단위 시작 시간 옵션 (오전 8시 ~ 오후 8시)
    const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
        const hour = Math.floor(i / 2) + 8;
        const min = i % 2 === 0 ? '00' : '30';
        return `${String(hour).padStart(2, '0')}:${min}`;
    });

    // 모바일 예약 바 스크롤 감지 (기존 sticky action sheet 효과)
    const [isMobileBarVisible, setIsMobileBarVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setIsMobileBarVisible(false); // 아래로 스크롤 시 숨김
            } else {
                setIsMobileBarVisible(true); // 위로 스크롤 시 표시
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setIsCopySuccess(true);
        setTimeout(() => setIsCopySuccess(false), 3000);
    };

    const handleReserve = () => {
        if (!date) return showToast('날짜를 선택해주세요.', 'error');
        if (!time) return showToast('시작 시간을 선택해주세요.', 'error');

        // 의뢰 폼으로 데이터 전달
        const params = new URLSearchParams({
            date,
            startTime: time,
            duration: duration.toString(),
            guests: guests.toString()
        });
        router.push(`/services/request?${params.toString()}`);
    };

    const DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 12];
    const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6];

    const totalPrice = 35000 * duration;

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans pb-0">
            <SiteHeader />

            {/* 링크 복사 토스트 */}
            {isCopySuccess && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Check size={16} className="text-green-400" /> 링크가 복사되었습니다.
                </div>
            )}

            {/* 📱 모바일 전용 상단 헤더 */}
            <div
                className="md:hidden fixed top-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-sm h-[52px] flex items-center justify-between px-4"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft size={18} className="text-slate-900" />
                </button>
                <p className="absolute left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500">일본 전역 · 맞춤 동행</p>
                <div className="flex items-center gap-1">
                    <button onClick={handleShare} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <Share size={16} className="text-slate-900" />
                    </button>
                    <button onClick={() => setIsSaved(!isSaved)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} />
                    </button>
                </div>
            </div>

            <main className="max-w-[1120px] mx-auto px-4 md:px-6 pt-[58px] md:pt-8 pb-[100px] md:pb-16">
                {/* 📸 데스크탑 5분할 사진 그리드 */}
                <section className="hidden md:block relative rounded-2xl overflow-hidden h-[480px] mb-12 bg-slate-100 group border border-slate-200 shadow-sm select-none">
                    <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
                        <div className="col-span-2 row-span-2 relative overflow-hidden">
                            <Image src={PHOTOS[0]} alt="Main" fill className="object-cover hover:scale-105 transition-transform duration-700" />
                        </div>
                        {PHOTOS.slice(1, 5).map((photo, i) => (
                            <div key={i} className="col-span-1 row-span-1 relative overflow-hidden">
                                <Image src={photo} alt={`Sub ${i}`} fill className="object-cover hover:scale-105 transition-transform duration-700" />
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsGalleryOpen(true); }}
                        className="absolute bottom-6 right-6 bg-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg border border-black/10 flex items-center gap-2 hover:scale-105 transition-transform z-10"
                    >
                        <Grid size={16} /> 사진 모두 보기
                    </button>
                </section>

                {/* 📱 모바일 사진 그리드 (2x2) */}
                <section className="md:hidden">
                    <div
                        className="relative w-full aspect-square mb-6 overflow-hidden rounded-[24px] cursor-pointer border border-slate-200"
                        onClick={() => setIsGalleryOpen(true)}
                    >
                        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[5px] bg-white">
                            <div className="relative overflow-hidden w-full h-full rounded-tl-[24px]">
                                <Image src={PHOTOS[0]} alt="Main" fill className="object-cover" />
                            </div>
                            <div className="relative overflow-hidden w-full h-full rounded-tr-[24px]">
                                <Image src={PHOTOS[1]} alt="Sub 1" fill className="object-cover" />
                            </div>
                            <div className="relative overflow-hidden w-full h-full rounded-bl-[24px]">
                                <Image src={PHOTOS[2]} alt="Sub 2" fill className="object-cover" />
                            </div>
                            <div className="relative overflow-hidden w-full h-full rounded-br-[24px]">
                                <Image src={PHOTOS[3]} alt="Sub 3" fill className="object-cover" />
                            </div>
                        </div>
                        <div className="absolute bottom-4 right-4 bg-white p-2.5 rounded-full shadow-[0_3px_10px_rgba(0,0,0,0.15)] border border-slate-200 z-10 text-slate-800">
                            <Grid size={16} />
                        </div>
                    </div>
                </section>

                {/* ── 상단 헤더 섹션 ── */}
                <div className="md:hidden text-center px-2 mb-6">
                    <div className="flex justify-center mb-3">
                        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm">
                            <Sparkles size={10} /> 로컬리 전용 서비스
                        </span>
                    </div>
                    <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.01em] mb-3">
                        일본 현지인 통역 동행 및 가이드 서비스 (맞춤형/시간당)
                    </h1>
                    <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium mb-4">
                        <Star size={12} className="fill-slate-900" />
                        <span>5.0</span>
                        <span className="text-slate-300">·</span>
                        <span className="underline underline-offset-2">후기 24개</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">일본 전역</span>
                    </div>
                </div>

                <section className="hidden md:block mb-10">
                    <div className="max-w-3xl">
                        <div className="flex items-start justify-between gap-6">
                            <div>
                                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-sm mb-3">
                                    <Sparkles size={11} /> 로컬리 전용 서비스
                                </span>
                                <h1 className="text-[40px] leading-[1.15] font-black tracking-tight text-slate-900">
                                    일본 현지인 통역 동행<br />가이드 서비스 <span className="text-[24px] text-slate-400 font-medium align-middle ml-2">(맞춤형/시간당)</span>
                                </h1>
                            </div>
                            <div className="flex shrink-0 gap-2 pt-1">
                                <button onClick={handleShare} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                                    <Share size={16} /> 공유하기
                                </button>
                                <button onClick={() => setIsSaved(!isSaved)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg text-sm font-semibold underline decoration-1">
                                    <Heart size={16} fill={isSaved ? '#F43F5E' : 'none'} className={isSaved ? 'text-rose-500' : 'text-slate-900'} />
                                    {isSaved ? '저장됨' : '저장'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center gap-2 text-[15px] font-medium text-slate-800">
                            <Star size={14} className="fill-slate-900" />
                            <span>5.0</span>
                            <span className="text-slate-300">·</span>
                            <span className="underline underline-offset-2 cursor-pointer">후기 24개</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-500 text-sm flex items-center gap-1"><MapPin size={14} />도쿄, 오사카, 후쿠오카 등 일본 전역</span>
                        </div>
                    </div>
                </section>

                {/* ── 본문 레이아웃 ── */}
                <div className="flex flex-col md:flex-row gap-10 md:gap-20">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0 md:max-w-2xl">
                        {/* 호스트 요약 바 */}
                        <div className="border-y border-slate-200 py-6 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-200 border border-slate-200 flex items-center justify-center shrink-0">
                                    <span className="text-slate-400 text-xl font-bold">L</span>
                                </div>
                                <div>
                                    <p className="text-[18px] md:text-[20px] font-semibold">호스트: 한국어 가능한 로컬리 현지인</p>
                                    <p className="mt-1 text-[14px] text-slate-500 flex items-center gap-2">
                                        통역 특화 호스트 <span className="text-slate-300">|</span> <Globe size={13} /> 한국어 레벨 3~4
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 핵심 아이콘 그리드 */}
                        <div className="mb-10 text-[15px] md:text-[16px] text-slate-800 space-y-5">
                            {QUICK_FACTS.map((fact, idx) => {
                                const Icon = fact.icon;
                                return (
                                    <div key={idx} className="flex gap-4 items-start">
                                        <Icon size={24} className="text-slate-900 shrink-0" />
                                        <div>
                                            <p className="font-semibold">{fact.label}</p>
                                            <p className="text-slate-500 text-[14px] mt-0.5">{fact.val}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-t border-slate-200 mb-8" />

                        {/* 소개 상세 내용 */}
                        <div className="prose prose-slate prose-p:leading-[1.7] prose-p:text-[16px] text-slate-600 mb-10">
                            <h2 className="text-[22px] font-bold text-slate-900 mb-4 pb-2">서비스 소개</h2>
                            <p>🇯🇵 일본어가 걱정되어 일본 여행이 망설여지셨나요? <strong>이제 걱정 마세요!</strong><br />
                                한국어를 유창하게 구사하는 일본인 현지 호스트가 여러분의 일본 여행을 더욱 편리하게 만들어 드립니다.
                            </p>
                            <p>로컬리 현지인 한국어 동행 서비스는 여러분의 자유 일정에 현지인 친구처럼 동행하며 모든 일본어 문제를 해결해 드립니다. 단순한 여행 가이드가 아닌, 여러분의 일본 여행을 편안하게 서포트하는 <strong>현지 파트너</strong>입니다.</p>

                            <h3 className="text-[18px] font-bold text-slate-900 mt-8 mb-3">이런 분들에게 추천!</h3>
                            <ul className="list-none pl-0 space-y-3">
                                {[
                                    '전자상가, 로컬샵 등에서 상품의 정보나 구매에 대해 물어보고 싶을 때',
                                    '부동산, 병원, 미용실 등 일본어로만 상담이 필요한 곳을 방문해야 할 때',
                                    '일본 여행에서 언어 걱정 없이, 온전히 풍경과 분위기에 집중하고 싶을 때',
                                    '특정 상권을 벤치마킹하고, 현지인 관점의 설명이 가볍게 필요할 때'
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-3 items-start p-0 m-0">
                                        <Check size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="border-t border-slate-200 mb-8" />

                        {/* 포함/불포함 내역 */}
                        <div className="mb-10">
                            <h2 className="text-[22px] font-bold text-slate-900 mb-5">안내 사항</h2>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                                <p className="font-bold text-slate-900 mb-4">불포함 내역 (고객 부담)</p>
                                <ul className="space-y-3 text-[15px] text-slate-600">
                                    <li className="flex gap-2.5 items-start"><X size={18} className="text-red-400 shrink-0 mt-0.5" />고객 본인의 모든 경비 (교통비, 식비, 입장료, 쇼핑비 등)</li>
                                    <li className="flex gap-2.5 items-start"><X size={18} className="text-red-400 shrink-0 mt-0.5" />호스트의 모든 경비 (함께 입장하는 시설 입장료, 식사비 등)</li>
                                    <li className="flex gap-2.5 items-start"><X size={18} className="text-red-400 shrink-0 mt-0.5" />호스트의 기본 교통비(1,000엔)를 초과한 최소 원거리 이동 교통비</li>
                                    <li className="flex gap-2.5 items-start"><AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />본 서비스는 전문 비즈니스 미팅, 계약 통역을 포함하지 않습니다. (별도 문의)</li>
                                </ul>
                            </div>
                        </div>

                    </div>

                    {/* ────── 데스크탑 우측 스티키 폼 (ReservationCard 복제 완벽 동기화) ────── */}
                    <aside className="hidden md:block w-[320px] lg:w-[380px] shrink-0">
                        <div className="sticky top-28 border border-slate-200 shadow-[0_6px_16px_rgba(0,0,0,0.12)] rounded-2xl p-5 md:p-6 bg-white">
                            <div className="flex justify-between items-end mb-5">
                                <div>
                                    <span className="text-xl md:text-2xl font-semibold">₩35,000</span>
                                    <span className="text-slate-500 text-xs md:text-sm"> / 1시간</span>
                                </div>
                            </div>

                            <div className="border border-slate-300 rounded-xl mb-4 overflow-hidden">
                                {/* 카스텀 달력 UI */}
                                <div className="p-3.5 md:p-4 border-b border-slate-200 bg-white">
                                    <div className="flex justify-between items-center mb-3">
                                        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft size={16} /></button>
                                        <span className="font-semibold text-xs md:text-sm">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</span>
                                        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight size={16} /></button>
                                    </div>
                                    <div className="grid grid-cols-7 text-center mb-2">
                                        {['일', '월', '화', '수', '목', '금', '토'].map(d => <span key={d} className="text-[10px] md:text-[10px] text-slate-400 font-semibold">{d}</span>)}
                                    </div>
                                    <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                                        {renderCalendar()}
                                    </div>
                                </div>

                                {/* 시작 시간 및 이용 시간 */}
                                <div className="flex border-b border-slate-300">
                                    <div className="flex-1 p-3 border-r border-slate-300">
                                        <label className="block text-[10px] uppercase font-bold text-slate-800 mb-1">시작 시간</label>
                                        <select
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full text-[13px] md:text-sm outline-none cursor-pointer bg-transparent font-semibold py-1"
                                        >
                                            <option value="">선택</option>
                                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1 p-3 bg-white">
                                        <label className="block text-[10px] uppercase font-bold text-slate-800 mb-1">이용 시간 (최소 4시간)</label>
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(Number(e.target.value))}
                                            className="text-[13px] md:text-sm outline-none bg-transparent font-semibold w-full cursor-pointer py-1"
                                        >
                                            {DURATION_OPTIONS.map(h => <option key={h} value={h}>{h}시간</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* 인원 */}
                                <div className="p-3 bg-white flex flex-col justify-center">
                                    <label className="block text-[10px] uppercase font-bold text-slate-800 mb-1">인원 (최대 4명 기준가)</label>
                                    <select
                                        value={guests}
                                        onChange={(e) => setGuests(Number(e.target.value))}
                                        className="text-[13px] md:text-sm outline-none bg-transparent font-semibold w-full cursor-pointer py-1"
                                    >
                                        {GUEST_OPTIONS.map(g => <option key={g} value={String(g)}>게스트 {g}명</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleReserve}
                                className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white text-[14px] md:text-base font-semibold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.01] transition-all mb-4"
                            >
                                의뢰 등록하기 (조건 확정)
                            </button>
                            <p className="text-center text-slate-500 text-xs mb-3">예약 확정 전에는 요금이 청구되지 않습니다.</p>

                            <div className="space-y-2 pt-4 border-t border-slate-100 text-[12px] md:text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span className="underline">₩35,000 x {duration}시간</span>
                                    <span>₩{totalPrice.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span className="underline">로컬리 서비스 수수료</span>
                                    <span>₩0</span>
                                </div>
                            </div>

                            <div className="flex justify-between font-semibold pt-4 border-t border-slate-100 mt-4 text-base md:text-lg">
                                <span>총 합계</span>
                                <span>₩{totalPrice.toLocaleString()}</span>
                            </div>
                        </div>
                    </aside>

                </div>
            </main>

            {/* ────── 모바일 하단 스티키 예약 폼 바 ────── */}
            <div
                className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-3 pb-8 transition-transform duration-300 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] ${isMobileBarVisible ? 'translate-y-0' : 'translate-y-[120%]'
                    }`}
            >
                <div className="flex justify-between items-center gap-4">
                    <div>
                        <p className="text-[15px] font-bold text-slate-900">₩35,000 <span className="text-[12px] font-normal text-slate-500">/ 1시간</span></p>
                        <p className="text-[12px] text-slate-500 underline underline-offset-2">날짜 및 시간 선택</p>
                    </div>
                    <button
                        onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            // 모바일에서는 간단히 시간을 선택하지 않았더라도 폼으로 바로 넘어가게 처리할 수 있습니다. 
                            // 여기서는 일단 데스크탑처럼 빈값 전달 후 request 폼에서 작성 유도
                            const params = new URLSearchParams({ duration: '4', guests: '1' });
                            router.push(`/services/request?${params.toString()}`);
                        }}
                        className="flex-1 max-w-[160px] py-3 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-xl font-bold text-[15px] hover:opacity-90 transition-opacity flex justify-center items-center shadow-md"
                    >
                        의뢰 등록하기
                    </button>
                </div>
            </div>

            {/* 사진 모달 갤러리 */}
            {isGalleryOpen && (
                <div className="fixed inset-0 z-[150] bg-white animate-in fade-in duration-200 flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <button onClick={() => setIsGalleryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
                        <h3 className="font-bold text-lg">사진 모두 보기</h3>
                        <div className="w-10"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {PHOTOS.map((photo, index) => (
                                <div key={index} className="relative w-full aspect-[4/3] md:aspect-[16/10] bg-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <Image src={photo} alt={`Gallery ${index}`} fill className="object-contain bg-black/5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
