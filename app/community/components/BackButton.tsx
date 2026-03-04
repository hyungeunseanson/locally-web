'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

/** 뒤로가기 버튼 — 클릭 시 로딩 스피너로 시각 피드백 */
export default function BackButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleBack = () => {
        startTransition(() => {
            router.push('/community');
        });
    };

    return (
        <button
            onClick={handleBack}
            className="text-slate-600 hover:text-slate-900 transition-colors p-1 -m-1 rounded-lg hover:bg-slate-100 active:scale-95"
            aria-label="뒤로가기"
        >
            {isPending
                ? <Loader2 size={24} className="animate-spin text-slate-400" />
                : <ArrowLeft size={24} />
            }
        </button>
    );
}
