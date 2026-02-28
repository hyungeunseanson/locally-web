'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Bell, Settings, HelpCircle, Star,
    ChevronRight, BookOpen, CornerUpRight, Loader2,
    CalendarCheck, LayoutList, MessageSquare, CircleDollarSign, User
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import HostModeTransition from './HostModeTransition';
import MobileLanguageSwitcher from './MobileLanguageSwitcher';
import { getProfileCompletion } from '@/app/utils/profile';

type MobileHostProfile = {
    avatar_url?: string | null;
    full_name?: string | null;
    bio?: string | null;
    introduction?: string | null;
    languages?: string[] | null;
    job?: string | null;
    phone?: string | null;
    host_nationality?: string | null;
};

export default function MobileHostMenu() {
    const [profile, setProfile] = useState<MobileHostProfile | null>(null);
    const [earnings, setEarnings] = useState<{ month: string; amount: number } | null>(null);
    const [reviewSummary, setReviewSummary] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [showTransition, setShowTransition] = useState(false);

    const supabase = useMemo(() => createClient(), []);
    const profileCompletion = profile ? getProfileCompletion(profile, 'host') : null;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

                const [profileRes, hostRes] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                    supabase.from('host_applications').select('*').eq('user_id', user.id).maybeSingle(),
                ]);

                if (profileRes.data || hostRes.data) {
                    setProfile({
                        ...(profileRes.data || {}),
                        avatar_url: hostRes.data?.profile_photo || profileRes.data?.avatar_url,
                        full_name: profileRes.data?.full_name || hostRes.data?.name,
                        bio: profileRes.data?.bio || hostRes.data?.self_intro || null,
                        introduction: profileRes.data?.introduction || hostRes.data?.self_intro || null,
                        languages: (profileRes.data?.languages && profileRes.data.languages.length > 0)
                            ? profileRes.data.languages
                            : (hostRes.data?.languages || []),
                        job: profileRes.data?.job || null,
                        phone: profileRes.data?.phone || hostRes.data?.phone || null,
                        host_nationality: profileRes.data?.host_nationality || hostRes.data?.host_nationality || null,
                    });
                }

                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const { data: bookingData } = await supabase
                    .from('bookings')
                    .select('amount, host_payout_amount, created_at, experiences!inner(host_id)')
                    .eq('experiences.host_id', user.id)
                    .in('status', [...BOOKING_CONFIRMED_STATUSES])
                    .gte('created_at', monthStart);

                const totalEarning = (bookingData || []).reduce(
                    (sum: number, b: { amount: number | null; host_payout_amount: number | null }) =>
                        sum + (b.host_payout_amount || Math.floor((b.amount || 0) * 0.8)),
                    0
                );

                setEarnings({ month: `${now.getMonth() + 1}월 ${now.getFullYear()}`, amount: totalEarning });

                const { data: reviewData } = await supabase
                    .from('reviews')
                    .select('rating, experiences!inner(host_id)')
                    .eq('experiences.host_id', user.id);

                if (reviewData && reviewData.length > 0) {
                    const avg = reviewData.reduce((s: number, r: { rating: number | null }) => s + (r.rating || 0), 0) / reviewData.length;
                    setReviewSummary({ avg: Math.round(avg * 10) / 10, count: reviewData.length });
                } else {
                    setReviewSummary({ avg: 0, count: 0 });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [supabase]);

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

            {/* ── 헤더 ── */}
            <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-4">
                <h1 className="text-[20px] font-extrabold tracking-tight text-gray-900">메뉴</h1>
                <div className="flex items-center gap-2">
                    <MobileLanguageSwitcher />
                    <Link href="/host/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
                        <Bell size={17} className="text-gray-600" />
                    </Link>
                    <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden border border-gray-100">
                        {profile?.avatar_url
                            ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="profile" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <User size={16} className="text-gray-400" />
                            </div>
                        }
                    </div>
                </div>
            </div>

            {/* ── 수입/인사이트 카드 ── */}
            <div className="px-5 mb-5 grid grid-cols-2 gap-3">
                <Link href="/host/dashboard?tab=earnings" className="bg-gray-50 rounded-2xl p-4 active:scale-[0.98] transition-transform block">
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">호스팅 수입</p>
                    <p className="text-[9px] text-gray-400 mb-2">{earnings?.month || '-'}</p>
                    <p className="text-[18px] font-black text-gray-900">
                        ₩{(earnings?.amount || 0).toLocaleString()}
                    </p>
                </Link>
                <Link href="/host/dashboard?tab=reviews" className="bg-gray-50 rounded-2xl p-4 active:scale-[0.98] transition-transform block">
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">인사이트</p>
                    <p className="text-[9px] text-gray-400 mb-2">
                        {reviewSummary.count > 0 ? `${reviewSummary.count}개의 후기` : '아직 후기 없음'}
                    </p>
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Star
                                key={i}
                                size={13}
                                className={i <= Math.round(reviewSummary.avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
                            />
                        ))}
                    </div>
                </Link>
            </div>

            {/* ── 메뉴 그룹 1 ── */}
            <div className="px-5 mb-1">
                <HostMenuItem href="/host/dashboard?tab=reservations" icon={<CalendarCheck size={17} />} label="예약 관리" />
                <HostMenuItem href="/host/dashboard?tab=experiences" icon={<LayoutList size={17} />} label="내 체험 관리" />
                <HostMenuItem href="/host/dashboard?tab=inquiries" icon={<MessageSquare size={17} />} label="문의함" />
            </div>

            <div className="my-3 mx-5 border-t border-gray-100" />

            {/* ── 메뉴 그룹 2 ── */}
            <div className="px-5 mb-1">
                <HostMenuItem href="/host/dashboard?tab=earnings" icon={<CircleDollarSign size={17} />} label="수익 및 정산" />
                <HostMenuItem href="/host/dashboard?tab=reviews" icon={<Star size={17} />} label="받은 후기" />
                <HostMenuItem href="/host/dashboard?tab=guidelines" icon={<BookOpen size={17} />} label="교육 및 가이드라인" />
            </div>

            <div className="my-3 mx-5 border-t border-gray-100" />

            {/* ── 메뉴 그룹 3 ── */}
            <div className="px-5">
                <HostMenuItem
                    href="/host/dashboard?tab=profile"
                    icon={<Settings size={17} />}
                    label="프로필 설정"
                    badge={profileCompletion && profileCompletion.percent < 100 ? `${profileCompletion.percent}%` : null}
                />
                <HostMenuItem href="/host/help" icon={<HelpCircle size={17} />} label="도움말 센터" />
            </div>

            {/* ── 게스트 모드 전환 플로팅 버튼 ── */}
            <div className="fixed bottom-[80px] left-0 right-0 flex justify-center z-50 pointer-events-none">
                <button
                    onClick={() => setShowTransition(true)}
                    className="pointer-events-auto flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-full shadow-lg text-[13px] font-semibold active:scale-95 transition-transform"
                >
                    게스트 모드로 전환
                    <CornerUpRight size={14} />
                </button>
            </div>
        </div>
    );
}

function HostMenuItem({
    href,
    icon,
    label,
    badge,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    badge?: string | null;
}) {
    return (
        <Link href={href} className="flex items-center gap-3.5 py-3.5 border-b border-gray-100">
            <span className="text-gray-500 shrink-0">{icon}</span>
            <span className="flex-1 text-[13px] font-medium text-gray-800">{label}</span>
            {badge ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    {badge}
                </span>
            ) : null}
            <ChevronRight size={15} className="text-gray-300" />
        </Link>
    );
}
