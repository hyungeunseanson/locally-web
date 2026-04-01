import React from 'react';
import { Loader2 } from 'lucide-react';

export type SpinnerVariant = 'primary' | 'muted' | 'inverse';

interface SpinnerProps {
    size?: number;
    className?: string;
    fullScreen?: boolean; // 화면 전체 중앙 정렬 여부
    fullHeight?: boolean; // 부모 컨테이너 기준 중앙 정렬 여부
    variant?: SpinnerVariant;
    inline?: boolean;
    label?: string;
    ariaHidden?: boolean;
}

const VARIANT_CLASS: Record<SpinnerVariant, string> = {
    primary: 'text-slate-900',
    muted: 'text-slate-400',
    inverse: 'text-white',
};

export default function Spinner({
    size = 24,
    className = '',
    fullScreen = false,
    fullHeight = false,
    variant = 'primary',
    inline = false,
    label,
    ariaHidden,
}: SpinnerProps) {
    const spinnerElement = (
        <>
            <Loader2
                size={size}
                aria-hidden={ariaHidden ?? true}
                className={`animate-spin ${VARIANT_CLASS[variant]} ${className}`}
            />
            {label ? <span className="sr-only">{label}</span> : null}
        </>
    );

    if (inline) {
        return (
            <span
                className="inline-flex items-center justify-center"
                role={label ? 'status' : undefined}
                aria-live={label ? 'polite' : undefined}
            >
                {spinnerElement}
            </span>
        );
    }

    if (fullScreen) {
        return (
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/78 backdrop-blur-sm"
                role={label ? 'status' : undefined}
                aria-live={label ? 'polite' : undefined}
            >
                {spinnerElement}
            </div>
        );
    }

    if (fullHeight) {
        return (
            <div
                className="min-h-[50vh] flex items-center justify-center w-full"
                role={label ? 'status' : undefined}
                aria-live={label ? 'polite' : undefined}
            >
                {spinnerElement}
            </div>
        );
    }

    return (
        <div
            className="flex items-center justify-center w-full h-full p-4"
            role={label ? 'status' : undefined}
            aria-live={label ? 'polite' : undefined}
        >
            {spinnerElement}
        </div>
    );
}
