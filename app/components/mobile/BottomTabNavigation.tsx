'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, MessageSquare, User, Bookmark, CalendarDays, List, AlignJustify } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

export default function BottomTabNavigation() {
    const pathname = usePathname();
    const isHostMode = pathname?.startsWith('/host');
    const { user } = useAuth();
    const avatarUrl = user?.user_metadata?.avatar_url;

    const guestTabs = [
        {
            name: '검색',
            href: '/',
            icon: (isActive: boolean) => <Search size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '위시리스트',
            href: '/guest/wishlists',
            icon: (isActive: boolean) => <Heart size={24} className={isActive ? 'text-[#FF385C] fill-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 0 : 2} />
        },
        {
            name: '여행',
            href: '/guest/trips',
            // 여백 없이 로고 자체를 꽉 채워 표시 (clip으로 여백 제거 효과)
            icon: (isActive: boolean) => (
                <div className={`w-7 h-7 flex items-center justify-center overflow-hidden ${isActive ? '' : 'opacity-50'}`}>
                    <img
                        src="/images/logo.png"
                        alt="여행"
                        className="w-full h-full object-cover"
                        style={{ transform: 'scale(1.35)' }} // 여백 부분 잘라내기
                    />
                </div>
            )
        },
        {
            name: '메시지',
            href: '/guest/inbox',
            icon: (isActive: boolean) => <MessageSquare size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2 : 2} />
        },
        {
            name: '프로필',
            href: '/account',
            icon: (isActive: boolean) => {
                if (avatarUrl) {
                    return (
                        <div className={`w-7 h-7 rounded-full overflow-hidden border-2 ${isActive ? 'border-[#FF385C]' : 'border-gray-200'}`}>
                            <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" />
                        </div>
                    );
                }
                return <User size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />;
            }
        }
    ];

    const hostTabs = [
        {
            name: '투데이',
            href: '/host/dashboard',
            icon: (isActive: boolean) => <Bookmark size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '달력',
            href: '/host/dashboard?tab=calendar',
            icon: (isActive: boolean) => <CalendarDays size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '리스팅',
            href: '/host/dashboard?tab=experiences',
            icon: (isActive: boolean) => <List size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '메시지',
            href: '/host/dashboard?tab=inquiries',
            icon: (isActive: boolean) => <MessageSquare size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2 : 2} />
        },
        {
            name: '메뉴',
            href: '/host/menu',
            icon: (isActive: boolean) => <AlignJustify size={24} className={isActive ? 'text-[#FF385C]' : 'text-gray-400'} strokeWidth={isActive ? 2.5 : 2} />
        }
    ];

    const tabs = isHostMode ? hostTabs : guestTabs;

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-[100] px-2 flex items-center justify-between"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', paddingTop: '8px' }}
        >
            {tabs.map((tab, idx) => {
                const isActive = tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href.split('?')[0]);
                return (
                    <Link key={idx} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1">
                        {tab.icon(isActive)}
                        <span className={`text-[10px] font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                            {tab.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
