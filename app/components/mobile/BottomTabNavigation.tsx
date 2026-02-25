'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, MessageSquare, User, Bookmark, CalendarDays, List, AlignJustify } from 'lucide-react';

export default function BottomTabNavigation() {
    const pathname = usePathname();
    const isHostMode = pathname?.startsWith('/host');

    const guestTabs = [
        {
            name: '검색',
            href: '/',
            icon: (isActive: boolean) => <Search size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '위시리스트',
            href: '/guest/wishlists',
            icon: (isActive: boolean) => <Heart size={22} className={isActive ? 'text-[#FF385C] fill-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 0 : 2} />
        },
        {
            name: '여행',
            href: '/guest/trips',
            icon: (isActive: boolean) => (
                <div className={`relative flex justify-center items-center w-6 h-6 ${isActive ? '' : 'opacity-60 grayscale-[80%]'}`}>
                    <img src="/images/logo.png" alt="Trips" className="w-[22px] h-[22px] object-contain" />
                </div>
            )
        },
        {
            name: '메시지',
            href: '/guest/inbox',
            icon: (isActive: boolean) => <MessageSquare size={22} className={isActive ? 'text-[#FF385C] fill-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 0 : 2} />
        },
        {
            name: '프로필',
            href: '/account',
            icon: (isActive: boolean) => <User size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        }
    ];

    const hostTabs = [
        {
            name: '투데이',
            href: '/host/dashboard?tab=reservations',
            icon: (isActive: boolean) => <Bookmark size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '달력',
            href: '/host/dashboard?tab=reservations',
            icon: (isActive: boolean) => <CalendarDays size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '리스팅',
            href: '/host/dashboard?tab=experiences',
            icon: (isActive: boolean) => <List size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '메시지',
            href: '/host/dashboard?tab=inquiries',
            icon: (isActive: boolean) => <MessageSquare size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '메뉴',
            href: '/host/menu',
            icon: (isActive: boolean) => <AlignJustify size={22} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        }
    ];

    const tabs = isHostMode ? hostTabs : guestTabs;

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[100] px-4 shadow-[0_-2px_15px_rgba(0,0,0,0.03)] flex items-center justify-between"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', paddingTop: '8px' }}>
            {tabs.map((tab, idx) => {
                const isActive = tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href.split('?')[0]);
                return (
                    <Link key={idx} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 min-w-[56px]">
                        {tab.icon(isActive)}
                        <span className={`text-[9px] ${isActive ? 'text-[#111827] font-semibold' : 'text-slate-500 font-medium'}`}>
                            {tab.name}
                        </span>
                    </Link>
                )
            })}
        </nav>
    );
}
