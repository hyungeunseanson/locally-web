'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HostModeTransitionProps {
    targetMode: 'host' | 'guest';
    onComplete?: () => void;
}

export default function HostModeTransition({ targetMode, onComplete }: HostModeTransitionProps) {
    const [visible, setVisible] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // 2.5초 대기 후 라우팅
        const t = setTimeout(() => {
            setVisible(false);
            if (targetMode === 'host') {
                router.push('/host/dashboard');
            } else {
                router.push('/');
            }
            onComplete?.();
        }, 2500);

        return () => clearTimeout(t);
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
            <style>{`
                @keyframes float-rotate {
                    0%   { transform: perspective(800px) rotateY(0deg) rotateX(4deg) scale(1); }
                    25%  { transform: perspective(800px) rotateY(10deg) rotateX(2deg) scale(1.04); }
                    50%  { transform: perspective(800px) rotateY(0deg) rotateX(-3deg) scale(1.06); }
                    75%  { transform: perspective(800px) rotateY(-10deg) rotateX(2deg) scale(1.04); }
                    100% { transform: perspective(800px) rotateY(0deg) rotateX(4deg) scale(1); }
                }
                @keyframes shadow-pulse {
                    0%, 100% { transform: scaleX(1); opacity: 0.15; }
                    50%       { transform: scaleX(1.1); opacity: 0.1; }
                }
                @keyframes fade-up-in {
                    0%   { opacity: 0; transform: translateY(12px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* 3D 일러스트레이션 */}
            <div
                className="w-[280px] h-[280px] flex items-center justify-center"
                style={{
                    animationName: 'float-rotate',
                    animationDuration: '4s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                }}
            >
                <img
                    src="/images/mode-transition.png"
                    alt="mode transition"
                    className="w-full h-full object-contain drop-shadow-xl"
                />
            </div>

            {/* 그림자 */}
            <div
                className="w-40 h-4 bg-black/10 rounded-full blur-md -mt-6"
                style={{
                    animationName: 'shadow-pulse',
                    animationDuration: '4s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                }}
            />

            {/* 텍스트 */}
            <p
                className="mt-8 text-[14px] font-medium text-gray-500 tracking-tight"
                style={{
                    animationName: 'fade-up-in',
                    animationDuration: '0.6s',
                    animationFillMode: 'both',
                    animationDelay: '0.3s',
                }}
            >
                {targetMode === 'host' ? '호스트 모드로 전환 중' : '게스트 모드로 전환 중'}
            </p>
        </div>
    );
}
