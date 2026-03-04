'use client';

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
    title: string;
    url: string;
}

/** 공유 버튼 — Web Share API 우선, fallback 클립보드 복사 + 토스트 */
export default function ShareButton({ title, url }: ShareButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        // Web Share API (모바일 네이티브 공유 시트 지원 시)
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title, url });
                return;
            } catch {
                // 취소 등 예외는 무시
            }
        }
        // Fallback: 클립보드 복사 + 체크 아이콘 토스트
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard 미지원 환경 graceful fallback
        }
    };

    return (
        <button
            onClick={handleShare}
            className="hover:text-slate-900 transition-colors p-1 -m-1 rounded-lg hover:bg-slate-100 active:scale-95 relative"
            aria-label="공유하기"
        >
            {copied ? (
                <span className="flex items-center gap-1 text-[12px] font-bold text-green-600 px-1">
                    <Check size={14} strokeWidth={3} /> 복사됨
                </span>
            ) : (
                <Share2 size={20} />
            )}
        </button>
    );
}
