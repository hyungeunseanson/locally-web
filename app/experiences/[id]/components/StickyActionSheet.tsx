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
            className="md:hidden fixed bottom-0 left-0 right-0 z-[105] bg-[#f5f5f5] pt-3 px-4"
            style={{
                boxShadow: '0 -6px 24px rgba(0,0,0,0.08)',
                borderTopLeftRadius: '26px',
                borderTopRightRadius: '26px',
                borderTop: '1px solid #e2e8f0',
                paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 0px) + 72px)'
            }}
        >
            <div className="flex justify-between items-center max-w-lg mx-auto bg-white rounded-[22px] border border-slate-200 px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col">
                    <span className="text-[#E00B41] font-extrabold text-[12px] tracking-tight mb-0.5">취소 수수료 없음</span>
                    <span className="text-slate-900 font-bold text-[18px] md:text-[15px] leading-none">
                        1인당 ₩{Number(experience.price).toLocaleString()} 부터
                    </span>
                </div>
                <button
                    onClick={handleBookingClick}
                    className="bg-[#E30063] text-white px-7 py-3 rounded-full text-[15px] md:text-[14px] font-bold hover:scale-[1.02] transition-transform shadow-md"
                >
                    날짜 표시
                </button>
            </div>
        </div>
    );
}
