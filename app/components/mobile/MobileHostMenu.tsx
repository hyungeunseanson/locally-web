'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Bell, Settings, HelpCircle, Star,
    ChevronRight, BookOpen, CornerUpRight, Loader2,
    CalendarCheck, LayoutList, MessageSquare, CircleDollarSign, User, Briefcase
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import HostModeTransition from './HostModeTransition';
import MobileLanguageSwitcher from './MobileLanguageSwitcher';
import { getHostPublicProfile, getProfileCompletion } from '@/app/utils/profile';
import { useNotification } from '@/app/context/NotificationContext';
import { usePendingNavigation } from '@/app/hooks/usePendingNavigation';

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
    const { pendingHref, isNavigating, navigate } = usePendingNavigation();

    const { notifications } = useNotification();
    const serviceUnread = notifications.some(
        (n) => !n.is_read && [
            'service_request_new', 'service_application_new',
            'service_host_selected', 'service_host_rejected',
            'service_payment_confirmed', 'service_cancelled'
        ].includes(n.type)
    );

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
                    const hostPublicProfile = getHostPublicProfile(profileRes.data, hostRes.data, '호스트');
                    setProfile({
                        ...(profileRes.data || {}),
                        avatar_url: hostPublicProfile.avatarUrl,
                        full_name: hostPublicProfile.name,
                        bio: hostPublicProfile.bio,
                        introduction: hostPublicProfile.bio,
                        languages: hostPublicProfile.languages,
                        job: profileRes.data?.job || null,
                        phone: profileRes.data?.phone || hostRes.data?.phone || null,
                        host_nationality: hostPublicProfile.location,
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
                    <button
                        type="button"
                        onClick={() => navigate('/host/notifications')}
                        disabled={isNavigating}
                        aria-busy={pendingHref === '/host/notifications'}
                        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 active:scale-[0.96] disabled:cursor-not-allowed ${pendingHref === '/host/notifications' ? 'bg-gray-200' : 'bg-gray-100 active:bg-gray-200'}`}
                    >
                        {pendingHref === '/host/notifications'
                            ? <Loader2 size={16} className="animate-spin text-gray-600" />
                            : <Bell size={17} className="text-gray-600" />
                        }
                    </button>
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
                <DashboardShortcutCard
                    title="호스팅 수입"
                    subtitle={earnings?.month || '-'}
                    href="/host/dashboard?tab=earnings"
                    isPending={pendingHref === '/host/dashboard?tab=earnings'}
                    disabled={isNavigating}
                    onNavigate={navigate}
                >
                    <p className="text-[18px] font-black text-gray-900">
                        ₩{(earnings?.amount || 0).toLocaleString()}
                    </p>
                </DashboardShortcutCard>
                <DashboardShortcutCard
                    title="인사이트"
                    subtitle={reviewSummary.count > 0 ? `${reviewSummary.count}개의 후기` : '아직 후기 없음'}
                    href="/host/dashboard?tab=reviews"
                    isPending={pendingHref === '/host/dashboard?tab=reviews'}
                    disabled={isNavigating}
                    onNavigate={navigate}
                >
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Star
                                key={i}
                                size={13}
                                className={i <= Math.round(reviewSummary.avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
                            />
                        ))}
                    </div>
                </DashboardShortcutCard>
            </div>

            {/* ── 메뉴 그룹 1 ── */}
            <div className="px-5 mb-1">
                <HostMenuItem href="/host/dashboard?tab=reservations" icon={<CalendarCheck size={17} />} label="예약 관리" isPending={pendingHref === '/host/dashboard?tab=reservations'} disabled={isNavigating} onNavigate={navigate} />
                <HostMenuItem href="/host/dashboard?tab=experiences" icon={<LayoutList size={17} />} label="내 체험 관리" isPending={pendingHref === '/host/dashboard?tab=experiences'} disabled={isNavigating} onNavigate={navigate} />
                <HostMenuItem href="/host/dashboard?tab=inquiries" icon={<MessageSquare size={17} />} label="문의함" isPending={pendingHref === '/host/dashboard?tab=inquiries'} disabled={isNavigating} onNavigate={navigate} />
                <HostMenuItem href="/host/dashboard?tab=service-jobs" icon={<Briefcase size={17} />} label="서비스 매칭" showDot={serviceUnread} isPending={pendingHref === '/host/dashboard?tab=service-jobs'} disabled={isNavigating} onNavigate={navigate} />
            </div>

            <div className="my-3 mx-5 border-t border-gray-100" />

            {/* ── 메뉴 그룹 2 ── */}
            <div className="px-5 mb-1">
                <HostMenuItem href="/host/dashboard?tab=earnings" icon={<CircleDollarSign size={17} />} label="수익 및 정산" isPending={pendingHref === '/host/dashboard?tab=earnings'} disabled={isNavigating} onNavigate={navigate} />
                <HostMenuItem href="/host/dashboard?tab=reviews" icon={<Star size={17} />} label="받은 후기" isPending={pendingHref === '/host/dashboard?tab=reviews'} disabled={isNavigating} onNavigate={navigate} />
                <HostMenuItem href="/host/dashboard?tab=guidelines" icon={<BookOpen size={17} />} label="교육 및 가이드라인" isPending={pendingHref === '/host/dashboard?tab=guidelines'} disabled={isNavigating} onNavigate={navigate} />
            </div>

            <div className="my-3 mx-5 border-t border-gray-100" />

            {/* ── 메뉴 그룹 3 ── */}
            <div className="px-5">
                <HostMenuItem
                    href="/host/dashboard?tab=profile"
                    icon={<Settings size={17} />}
                    label="프로필 설정"
                    badge={profileCompletion && profileCompletion.percent < 100 ? `${profileCompletion.percent}%` : null}
                    isPending={pendingHref === '/host/dashboard?tab=profile'}
                    disabled={isNavigating}
                    onNavigate={navigate}
                />
                <HostMenuItem href="/host/help" icon={<HelpCircle size={17} />} label="도움말 센터" isPending={pendingHref === '/host/help'} disabled={isNavigating} onNavigate={navigate} />
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

function DashboardShortcutCard({
    title,
    subtitle,
    href,
    isPending,
    disabled,
    onNavigate,
    children,
}: {
    title: string;
    subtitle: string;
    href: string;
    isPending: boolean;
    disabled: boolean;
    onNavigate: (href: string) => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={() => onNavigate(href)}
            disabled={disabled}
            aria-busy={isPending}
            className={`relative block rounded-2xl p-4 text-left transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${isPending ? 'bg-gray-100 ring-1 ring-gray-200' : 'bg-gray-50 active:bg-gray-100'}`}
        >
            <div className="absolute right-4 top-4">
                {isPending ? <Loader2 size={15} className="animate-spin text-gray-400" /> : null}
            </div>
            <p className="mb-1 text-[10px] font-semibold text-gray-500">{title}</p>
            <p className="mb-2 text-[9px] text-gray-400">{subtitle}</p>
            {children}
        </button>
    );
}

function HostMenuItem({
    href,
    icon,
    label,
    badge,
    showDot,
    isPending,
    disabled,
    onNavigate,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    badge?: string | null;
    showDot?: boolean;
    isPending: boolean;
    disabled: boolean;
    onNavigate: (href: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onNavigate(href)}
            disabled={disabled}
            aria-busy={isPending}
            className={`flex w-full items-center gap-3.5 border-b border-gray-100 py-3.5 text-left transition-all duration-150 active:scale-[0.995] disabled:cursor-not-allowed ${isPending ? 'bg-gray-50/80' : ''}`}
        >
            <span className="text-gray-500 shrink-0">{icon}</span>
            <span className="flex-1 text-[13px] font-medium text-gray-800">{label}</span>
            {showDot && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {badge ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    {badge}
                </span>
            ) : null}
            {isPending
                ? <Loader2 size={15} className="animate-spin text-gray-400" />
                : <ChevronRight size={15} className="text-gray-300" />
            }
        </button>
    );
}
