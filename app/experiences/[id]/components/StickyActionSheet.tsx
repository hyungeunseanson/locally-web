'use client';

import React, { useEffect, useState } from 'react';

type StickyActionSheetProps = {
    experience: {
        price?: number;
    };
};

export default function StickyActionSheet({ experience }: StickyActionSheetProps) {
    const [isVisible, setIsVisible] = useState(true);

    // IntersectionObserver to hide the sticky bar when the actual ReservationCard is in view.
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(!entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        const card = document.getElementById('reservation-card');
        if (card) {
            observer.observe(card);
        }

        // fallback check
        const handleScroll = () => {
            if (!card) setIsVisible(true);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const handleBookingClick = () => {
        const card = document.getElementById('reservation-card');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth' });
        }
    };

    if (!isVisible) return null;

    return (
        <div
            className="md:hidden fixed left-0 right-0 z-[105] px-4"
            style={{
                bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 76px)'
            }}
        >
            <div className="flex justify-between items-center max-w-sm mx-auto rounded-full border border-slate-200 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)] px-3 py-2.5">
                <div className="flex flex-col">
                    <span className="text-slate-900 font-semibold text-[13px] leading-none">
                        1인당 ₩{Number(experience.price).toLocaleString()} 부터
                    </span>
                    <span className="text-[#E00B41] font-semibold text-[10px] tracking-tight mt-0.5">7일 전에 취소하면 수수료 없음</span>
                </div>
                <button
                    onClick={handleBookingClick}
                    className="bg-[#E5006D] text-white min-w-[102px] px-4 py-2 rounded-full text-[13px] font-semibold hover:scale-[1.02] transition-transform shadow-[0_4px_10px_rgba(229,0,109,0.3)]"
                >
                    날짜 표시
                </button>
            </div>
        </div>
    );
}
