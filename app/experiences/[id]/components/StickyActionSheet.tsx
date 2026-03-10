'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';

type StickyActionSheetProps = {
    experience: {
        price?: number;
    };
};

export default function StickyActionSheet({ experience }: StickyActionSheetProps) {
    const [isVisible, setIsVisible] = useState(true);
    const { t } = useLanguage();

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
            <div className="flex justify-between items-center max-w-sm mx-auto rounded-full border border-slate-200 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)] px-4 py-[11px]">
                <div className="flex flex-col pl-1">
                    <span className="leading-none">
                        <span className="text-[10px] text-slate-500 font-medium mr-1.5">{t('exp_card_per_person')}</span>
                        <span className="text-slate-900 font-semibold text-[15px]">
                            <span className="underline decoration-slate-700 underline-offset-[2px]">₩{Number(experience.price).toLocaleString()}</span>
                            <span className="ml-1">{t('exp_card_price_from')}</span>
                        </span>
                    </span>
                    <span className="text-[#E00B41] font-medium text-[10px] tracking-tight mt-[3px]">{t('exp_reservation_free_cancel_note')}</span>
                </div>
                <button
                    onClick={handleBookingClick}
                    className="bg-[#E5006D] text-white min-w-[102px] px-4 py-2 rounded-full text-[13px] font-semibold hover:scale-[1.02] transition-transform shadow-[0_4px_10px_rgba(229,0,109,0.3)]"
                >
                    {t('exp_reservation_show_dates')}
                </button>
            </div>
        </div>
    );
}
