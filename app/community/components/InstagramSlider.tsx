'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface InstagramSliderProps {
    images: string[];
    /** 슬라이드 컨테이너에 추가 className */
    className?: string;
    /** 이미지 alt 텍스트에 사용할 게시물 제목 */
    title?: string;
}

/**
 * 인스타그램 스타일 이미지 슬라이더
 * - 비율: 4:5 (1080×1350)
 * - 터치 스와이프 + 화살표 버튼(데스크탑 hover)
 * - 하단 닷 인디케이터 + 상단 우측 N/Total 카운터
 */
export default function InstagramSlider({ images, className = '', title }: InstagramSliderProps) {
    const [current, setCurrent] = useState(0);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);
    const total = images.length;

    const prev = useCallback(() => {
        setCurrent((c) => (c > 0 ? c - 1 : c));
    }, []);

    const next = useCallback(() => {
        setCurrent((c) => (c < total - 1 ? c + 1 : c));
    }, [total]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        touchEndX.current = e.changedTouches[0].clientX;
        const diff = touchStartX.current - touchEndX.current;
        if (Math.abs(diff) > 40) {
            if (diff > 0) next();
            else prev();
        }
    };

    if (!images || images.length === 0) return null;

    // 단일 이미지이면 슬라이더 불필요
    if (images.length === 1) {
        return (
            <div className={`w-full aspect-[4/5] overflow-hidden rounded-[28px] bg-gray-100 ${className}`}>
                <img
                    src={images[0]}
                    alt={title || '첨부 이미지'}
                    className="h-full w-full object-cover"
                    loading="eager"
                />
            </div>
        );
    }

    return (
        <div className={`relative w-full aspect-[4/5] overflow-hidden rounded-[28px] bg-gray-100 select-none group ${className}`}>
            {/* 슬라이드 트랙 */}
            <div
                className="flex h-full transition-transform duration-300 ease-out will-change-transform"
                style={{ transform: `translateX(-${current * 100}%)` }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {images.map((src, idx) => (
                    <div key={idx} className="h-full w-full flex-shrink-0">
                        <img
                            src={src}
                            alt={title ? `${title} - 이미지 ${idx + 1}` : `첨부 이미지 ${idx + 1}`}
                            className="h-full w-full object-cover"
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            draggable={false}
                        />
                    </div>
                ))}
            </div>

            {/* 카운터 (상단 우측) */}
            <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">
                {current + 1}/{total}
            </div>

            {/* 이전 버튼 */}
            {current > 0 && (
                <button
                    type="button"
                    aria-label="이전 이미지"
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-800 shadow-md backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 md:opacity-100"
                >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
            )}

            {/* 다음 버튼 */}
            {current < total - 1 && (
                <button
                    type="button"
                    aria-label="다음 이미지"
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-800 shadow-md backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 md:opacity-100"
                >
                    <ChevronRight size={20} strokeWidth={2.5} />
                </button>
            )}

            {/* 닷 인디케이터 */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        type="button"
                        aria-label={`이미지 ${idx + 1}로 이동`}
                        onClick={() => setCurrent(idx)}
                        className={`rounded-full transition-all duration-200 ${
                            idx === current
                                ? 'w-4 h-2 bg-white'
                                : 'w-2 h-2 bg-white/50'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}
