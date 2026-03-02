import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    size?: number;
    className?: string;
    fullScreen?: boolean; // 화면 전체 중앙 정렬 여부
    fullHeight?: boolean; // 부모 컨테이너 기준 중앙 정렬 여부
}

export default function Spinner({ size = 24, className = '', fullScreen = false, fullHeight = false }: SpinnerProps) {
    const spinnerElement = (
        <Loader2
            size={size}
            className={`animate-spin text-[#FF385C] ${className}`}
        />
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
                {spinnerElement}
            </div>
        );
    }

    if (fullHeight) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center w-full">
                {spinnerElement}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center w-full h-full p-4">
            {spinnerElement}
        </div>
    );
}
