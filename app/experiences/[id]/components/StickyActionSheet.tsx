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
            className="md:hidden fixed bottom-0 left-0 right-0 z-[105] bg-[#f5f5f5] pt-2 px-4"
            style={{
                boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
                borderTop: '1px solid #e5e7eb',
                paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 70px)'
            }}
        >
            <div className="flex justify-between items-center max-w-lg mx-auto px-0.5 py-2">
                <div className="flex flex-col">
                    <span className="text-slate-900 font-bold text-[15px] md:text-[15px] leading-none">
                        1인당 ₩{Number(experience.price).toLocaleString()} 부터
                    </span>
                    <span className="text-[#E00B41] font-bold text-[12px] tracking-tight mt-0.5">취소 수수료 없음</span>
                </div>
                <button
                    onClick={handleBookingClick}
                    className="bg-[#E5006D] text-white min-w-[112px] py-2.5 rounded-full text-[14px] md:text-[14px] font-bold hover:scale-[1.02] transition-transform shadow-[0_4px_10px_rgba(229,0,109,0.3)]"
                >
                    날짜 표시
                </button>
            </div>
        </div>
    );
}
