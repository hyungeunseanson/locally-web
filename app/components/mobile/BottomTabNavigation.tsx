'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, MessageSquare, User } from 'lucide-react';

export default function BottomTabNavigation() {
    const pathname = usePathname();

    const tabs = [
        {
            name: '검색',
            href: '/',
            icon: (isActive: boolean) => <Search size={24} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        },
        {
            name: '위시리스트',
            href: '/guest/wishlists',
            icon: (isActive: boolean) => <Heart size={24} className={isActive ? 'text-[#FF385C] fill-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 0 : 2} />
        },
        {
            name: '여행',
            href: '/guest/trips',
            icon: (isActive: boolean) => (
                <div className={`relative flex justify-center items-center w-6 h-6 ${isActive ? '' : 'opacity-60 grayscale-[80%]'}`}>
                    <img src="/images/logo.png" alt="Trips" className="w-[24px] h-[24px] object-contain" />
                </div>
            )
        },
        {
            name: '메시지',
            href: '/guest/inbox',
            icon: (isActive: boolean) => <MessageSquare size={24} className={isActive ? 'text-[#FF385C] fill-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 0 : 2} />
        },
        {
            name: '프로필',
            href: '/account',
            icon: (isActive: boolean) => <User size={24} className={isActive ? 'text-[#FF385C]' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
        }
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[100] px-4 shadow-[0_-2px_15px_rgba(0,0,0,0.03)] flex items-center justify-between"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', paddingTop: '8px' }}>
            {tabs.map((tab, idx) => {
                const isActive = tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href);
                return (
                    <Link key={idx} href={tab.href} className="flex flex-col items-center justify-center gap-1 min-w-[60px]">
                        {tab.icon(isActive)}
                        <span className={`text-[10px] ${isActive ? 'text-[#111827] font-semibold' : 'text-slate-500 font-medium'}`}>
                            {tab.name}
                        </span>
                    </Link>
                )
            })}
        </nav>
    );
}
