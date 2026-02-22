'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';

export default function StickyActionSheet({ experience }: { experience: any }) {
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

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

        // Check initial visibility if observer hasn't fired yet
        setIsVisible(true);

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
            className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] px-6"
            style={{
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                borderTop: '1px solid #f1f5f9'
            }}
        >
            <div className="flex justify-between items-center max-w-lg mx-auto">
                <div className="flex flex-col">
                    <span className="text-[#E00B41] font-extrabold text-[12px] tracking-tight mb-0.5">취소 수수료 없음</span>
                    <span className="text-slate-900 font-bold border-b border-black w-fit leading-tight pb-[1px]">
                        1인당 ₩{Number(experience.price).toLocaleString()} 부터
                    </span>
                </div>
                <button
                    onClick={handleBookingClick}
                    className="bg-[#FF385C] text-white px-7 py-3 rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-md"
                >
                    날짜 표시
                </button>
            </div>
        </div>
    );
}
