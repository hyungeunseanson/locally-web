'use client';

import React, { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    Search, Heart, MessageSquare, User,
    CalendarCheck, LayoutList, BookOpen, AlignJustify, Loader2
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import LoginModal from '@/app/components/LoginModal';
import { usePendingNavigation } from '@/app/hooks/usePendingNavigation';

export default function BottomTabNavigation() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isHostMode = pathname?.startsWith('/host');
    const isHostNavPath =
        pathname?.startsWith('/host/dashboard') ||
        pathname?.startsWith('/host/menu') ||
        pathname?.startsWith('/host/help') ||
        pathname?.startsWith('/host/notifications') ||
        pathname?.startsWith('/services');
    const activeHostTab = searchParams?.get('tab') || 'reservations';
    const { user } = useAuth();
    const avatarUrl = user?.user_metadata?.avatar_url;
    const [showLogin, setShowLogin] = useState(false);
    const { pendingHref, isNavigating, navigate } = usePendingNavigation();

    // 어드민/인증/결제 플로우에서는 하단 탭바 숨김
    // 호스트 모드에서는 dashboard/menu에서만 노출해 생성/수정 화면과 충돌 방지
    if (
        pathname?.startsWith('/admin') ||
        pathname?.startsWith('/login') ||
        pathname?.startsWith('/signup') ||
        pathname?.includes('/payment') ||
        (isHostMode && !isHostNavPath)
    ) {
        return null;
    }

    const handleTabPress = (href: string, requireAuth: boolean) => {
        if (isNavigating) {
            return;
        }

        if (requireAuth && !user) {
            setShowLogin(true);
            return;
        }

        navigate(href);
    };

    const guestTabs = [
        {
            name: '검색',
            href: '/',
            requireAuth: false,
            icon: (isActive: boolean) => <Search size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '위시리스트',
            href: '/guest/wishlists',
            requireAuth: true,
            icon: (isActive: boolean) => <Heart size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={2} />
        },
        {
            name: '여행',
            href: '/guest/trips',
            requireAuth: false,
            icon: (isActive: boolean) => (
                <div className={`w-6 h-6 flex items-center justify-center overflow-hidden ${isActive ? '' : 'opacity-50'}`}>
                    <img src="/images/logo.png" alt="여행" className="w-full h-full object-cover" style={{ transform: 'scale(1.35)' }} />
                </div>
            )
        },
        {
            name: '메시지',
            href: '/guest/inbox',
            requireAuth: true,
            icon: (isActive: boolean) => <MessageSquare size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={2} />
        },
        {
            name: '프로필',
            href: '/account',
            requireAuth: true,
            icon: (isActive: boolean) => {
                if (avatarUrl) {
                    return (
                        <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${isActive ? 'border-[#FF385C]' : 'border-gray-200'}`}>
                            <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" />
                        </div>
                    );
                }
                return <User size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />;
            }
        }
    ];

    // 새로운 호스트 탭 구조: 예약 | 관리 | 교육 | 메시지 | 메뉴
    const hostTabs = [
        {
            name: '예약',
            href: '/host/dashboard?tab=reservations',
            requireAuth: true,
            icon: (isActive: boolean) => <CalendarCheck size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '관리',
            href: '/host/dashboard?tab=experiences',
            requireAuth: true,
            icon: (isActive: boolean) => <LayoutList size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '교육',
            href: '/host/dashboard?tab=guidelines',
            requireAuth: true,
            icon: (isActive: boolean) => <BookOpen size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '메시지',
            href: '/host/dashboard?tab=inquiries',
            requireAuth: true,
            icon: (isActive: boolean) => <MessageSquare size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={2} />
        },
        {
            name: '더보기',
            href: '/host/menu',
            requireAuth: true,
            icon: (isActive: boolean) => <AlignJustify size={22} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        }
    ];

    const tabs = isHostMode ? hostTabs : guestTabs;
    const isTabActive = (href: string) => {
        if (href === '/') return pathname === '/';

        if (href.startsWith('/host/dashboard?tab=')) {
            const tabValue = href.split('tab=')[1];
            return pathname?.startsWith('/host/dashboard') && activeHostTab === tabValue;
        }

        if (href === '/host/menu') {
            return pathname?.startsWith('/host/menu');
        }

        return pathname?.startsWith(href.split('?')[0]);
    };

    return (
        <>
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-[100] px-2 flex items-center justify-between"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)', paddingTop: '8px' }}
            >
                {tabs.map((tab, idx) => {
                    const isActive = isTabActive(tab.href);

                    if (tab.requireAuth && !user) {
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleTabPress(tab.href, tab.requireAuth)}
                                className="flex min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition-all duration-150 active:scale-[0.96] active:bg-slate-50"
                            >
                                {tab.icon(false)}
                                <span className="text-[10px] font-medium text-gray-400">
                                    {tab.name}
                                </span>
                            </button>
                        );
                    }

                    const isPending = pendingHref === tab.href;

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleTabPress(tab.href, tab.requireAuth)}
                            disabled={isNavigating}
                            aria-busy={isPending}
                            className={`flex min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition-all duration-150 active:scale-[0.96] disabled:cursor-not-allowed ${isPending ? 'bg-slate-100/90' : 'active:bg-slate-50'}`}
                        >
                            {isPending
                                ? <Loader2 size={20} className="animate-spin text-slate-500" />
                                : tab.icon(isActive)
                            }
                            <span className={`text-[10px] font-medium ${isPending || isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                {tab.name}
                            </span>
                        </button>
                    );
                })}
            </nav>

            <LoginModal
                isOpen={showLogin}
                onClose={() => setShowLogin(false)}
                onLoginSuccess={() => setShowLogin(false)}
            />
        </>
    );
}
