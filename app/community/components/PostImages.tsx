'use client';

import React, { useRef, useCallback } from 'react';

interface PostImagesProps {
    images: string[];
    /** 상세 페이지에서는 true */
    detail?: boolean;
}

/**
 * 이미지 비율 자동 감지 컴포넌트
 *
 * 규칙:
 *  - 1장 + 세로형 (ratio ≥ 1.15, 4:5에 가까운) → aspect-[4/5]
 *  - 1장 + 가로/정방형                          → aspect-square
 *  - 2~3장                                      → 항상 aspect-square 그리드
 *
 * 데스크탑 비율 이슈 해결:
 *  - 이전: aspect-square + w-full + max-h → 세 클래스가 충돌해 이상한 비율
 *  - 현재: max-w로 너비를 먼저 제한 → aspect로 높이 결정 (충돌 없음)
 */
export default function PostImages({ images, detail = false }: PostImagesProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleSingleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        if (!wrapperRef.current) return;
        const img = e.currentTarget;
        const ratio = img.naturalHeight / img.naturalWidth;
        if (ratio >= 1.15) {
            wrapperRef.current.classList.remove('aspect-square');
            wrapperRef.current.classList.add('aspect-[4/5]');
        }
    }, []);

    if (!images || images.length === 0) return null;

    // ─── 단일 이미지 ──────────────────────────────────────────────────
    if (images.length === 1) {
        // 피드 카드: 모바일은 full-width, 데스크탑은 max-w-xs(320px)로 제한 후 중앙 정렬
        // 상세 페이지: max-w-sm(384px) 고정
        const sizeClass = detail
            ? 'w-full max-w-sm mx-auto'
            : 'w-full md:max-w-xs md:mx-auto';

        return (
            <div
                ref={wrapperRef}
                className={`${sizeClass} aspect-square rounded-xl overflow-hidden bg-gray-100`}
            >
                <img
                    src={images[0]}
                    alt="첨부 이미지"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onLoad={handleSingleImageLoad}
                />
            </div>
        );
    }

    // ─── 2~3장 그리드 (항상 1:1) ─────────────────────────────────────
    const gridClass = images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

    return (
        <div className={`grid ${gridClass} gap-1 rounded-xl overflow-hidden`}>
            {images.slice(0, 3).map((img, idx) => (
                <div key={idx} className="aspect-square bg-gray-100 overflow-hidden">
                    <img
                        src={img}
                        alt={`첨부 이미지 ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                </div>
            ))}
        </div>
    );
}
