'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Bell, Settings, HelpCircle, Plus, Star,
    ChevronRight, BookOpen, Users, CornerUpRight, Loader2
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import HostModeTransition from './HostModeTransition';

export default function MobileHostMenu() {
    const [profile, setProfile] = useState<any>(null);
    const [earnings, setEarnings] = useState<{ month: string; amount: number } | null>(null);
    const [reviewSummary, setReviewSummary] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [showTransition, setShowTransition] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [profileRes, hostRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                supabase.from('host_applications').select('*').eq('user_id', user.id).maybeSingle(),
            ]);

            if (profileRes.data || hostRes.data) {
                setProfile({
                    ...(profileRes.data || {}),
                    avatar_url: hostRes.data?.profile_photo || profileRes.data?.avatar_url,
                    full_name: profileRes.data?.full_name || hostRes.data?.name,
                });
            }

            // 이번 달 수입 계산 (bookings 테이블에서)
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('amount, host_earning')
                .eq('status', 'confirmed')
                .gte('created_at', monthStart);

            const totalEarning = (bookingData || []).reduce((sum: number, b: any) =>
                sum + (b.host_earning || Math.floor((b.amount || 0) * 0.8)), 0);

            setEarnings({
                month: `${now.getMonth() + 1}월 ${now.getFullYear()}`,
                amount: totalEarning
            });

            // 리뷰 요약
            const { data: reviewData } = await supabase
                .from('reviews')
                .select('rating')
                .eq('host_id', user.id);

            if (reviewData && reviewData.length > 0) {
                const avg = reviewData.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviewData.length;
                setReviewSummary({ avg: Math.round(avg * 10) / 10, count: reviewData.length });
            }

            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
    );

    return (
        <div className="min-h-screen bg-white pb-28">
            {showTransition && (
                <HostModeTransition targetMode="guest" onComplete={() => setShowTransition(false)} />
            )}

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-4">
                <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900">메뉴</h1>
                <div className="flex items-center gap-2">
                    <Link href="/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-full bg-slate-100">
                        <Bell size={17} className="text-slate-600" />
                    </Link>
                    <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
                        {profile?.avatar_url
                            ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="profile" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                                {profile?.full_name?.[0] || 'H'}
                            </div>
                        }
                    </div>
                </div>
            </div>

            {/* 수입/인사이트 카드 */}
            <div className="px-5 mb-5 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[11px] font-semibold text-slate-500">호스팅 수입</p>
                    <p className="text-[10px] text-slate-400 mb-3">{earnings?.month || '-'}</p>
                    <p className="text-[20px] font-black text-slate-900">
                        ₩{(earnings?.amount || 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[11px] font-semibold text-slate-500">인사이트</p>
                    <p className="text-[10px] text-slate-400 mb-3">
                        {reviewSummary.count > 0 ? `${reviewSummary.count}개의 후기` : '아직 후기 없음'}
                    </p>
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Star
                                key={i}
                                size={14}
                                className={i <= Math.round(reviewSummary.avg) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 새 리스팅 CTA */}
            <div className="mx-5 mb-6">
                <Link href="/host/create" className="block bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <Bell size={15} className="text-slate-600" />
                        </div>
                        <div>
                            <p className="text-[13px] font-bold text-slate-900">새로운 리스팅 등록하기</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">숙소, 체험, 서비스를 호스팅하세요.</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* 메뉴 리스트 */}
            <div className="px-5">
                <MenuItem href="/account" icon={<Settings size={17} className="text-slate-600" />} label="계정 관리" />
                <MenuItem href="/host/dashboard?tab=guidelines" icon={<BookOpen size={17} className="text-slate-600" />} label="호스팅 자료" />
                <MenuItem href="/help" icon={<HelpCircle size={17} className="text-slate-600" />} label="도움 요청" />
                <MenuItem href="/host/dashboard?tab=profile" icon={<Users size={17} className="text-slate-600" />} label="공동 호스트 찾기" />

                <div className="my-5 border-t border-slate-100" />

                <Link href="/host/create" className="flex items-center gap-3.5 py-3.5 border-b border-slate-100">
                    <Plus size={17} className="text-slate-600 shrink-0" />
                    <span className="flex-1 text-[13px] font-medium text-slate-800">새로운 리스팅 등록하기</span>
                    <ChevronRight size={16} className="text-slate-400" />
                </Link>
            </div>

            {/* 게스트 모드 전환 플로팅 버튼 */}
            <div className="fixed bottom-[80px] left-0 right-0 flex justify-center z-50 pointer-events-none">
                <button
                    onClick={() => setShowTransition(true)}
                    className="pointer-events-auto flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-full shadow-lg text-[13px] font-semibold active:scale-95 transition-transform"
                >
                    <CornerUpRight size={15} />
                    게스트 모드로 전환
                </button>
            </div>
        </div>
    );
}

function MenuItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link href={href} className="flex items-center gap-3.5 py-3.5 border-b border-slate-100">
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 text-[13px] font-medium text-slate-800">{label}</span>
            <ChevronRight size={16} className="text-slate-400" />
        </Link>
    );
}
