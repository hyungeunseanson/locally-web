'use client';

import React, { useRef, useCallback } from 'react';

interface PostImagesProps {
    images: string[];
    /** 상세 페이지에서는 true (단일 이미지를 크게) */
    detail?: boolean;
}

/**
 * 이미지 비율 자동 감지 컴포넌트
 *
 * 규칙:
 *  - 이미지 1장 + 세로형(ratio ≥ 1.15, 즉 4:5에 가까운) → aspect-[4/5]
 *  - 이미지 1장 + 가로/정방형                             → aspect-square
 *  - 이미지 2~3장                                         → 항상 aspect-square 그리드
 *
 * 왜 onLoad 방식인가:
 *  - SSR 단계에서는 이미지 비율을 알 수 없음
 *  - naturalWidth/naturalHeight는 클라이언트에서만 접근 가능
 *  - 기본값 aspect-square → 비율 감지 후 업데이트하면 레이아웃 시프트 최소화
 */
export default function PostImages({ images, detail = false }: PostImagesProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleSingleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        if (!wrapperRef.current) return;
        const img = e.currentTarget;
        const ratio = img.naturalHeight / img.naturalWidth;
        // 4:5 = 1.25, 여유 허용 범위: 1.15 이상이면 4:5로 판정
        if (ratio >= 1.15) {
            wrapperRef.current.classList.remove('aspect-square');
            wrapperRef.current.classList.add('aspect-[4/5]');
        }
    }, []);

    if (!images || images.length === 0) return null;

    // ─── 단일 이미지 (비율 자동 감지) ───────────────────────────────
    if (images.length === 1) {
        const maxClass = detail
            ? 'max-w-sm md:max-w-md mx-auto'   // 상세 페이지: 너무 크지 않게 제한
            : 'max-h-72 md:max-h-80';          // 피드 카드: 높이 상한 제한

        return (
            <div
                ref={wrapperRef}
                className={`aspect-square rounded-xl overflow-hidden bg-gray-100 ${maxClass} w-full`}
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

    // ─── 2~3장 이미지 그리드 (항상 1:1) ────────────────────────────
    const gridClass = images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
    const maxClass = detail ? '' : 'max-h-64 md:max-h-72';

    return (
        <div className={`grid ${gridClass} gap-1 rounded-xl overflow-hidden ${maxClass}`}>
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
