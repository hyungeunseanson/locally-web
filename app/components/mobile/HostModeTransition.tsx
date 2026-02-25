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

    // 게스트→호스트: 해변 섬 일러스트
    // 호스트→게스트: 아늑한 집 일러스트
    const imageSrc = targetMode === 'host'
        ? '/images/host-transition.png'
        : '/images/guest-transition.png';

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
            <style>{`
                @keyframes float-gently {
                    0%, 100% {
                        transform: translateY(0px) rotate(-1deg) scale(1);
                    }
                    33% {
                        transform: translateY(-12px) rotate(1deg) scale(1.02);
                    }
                    66% {
                        transform: translateY(-6px) rotate(-0.5deg) scale(1.01);
                    }
                }
                @keyframes shadow-breathe {
                    0%, 100% { transform: scaleX(1); opacity: 0.12; }
                    50%       { transform: scaleX(0.85); opacity: 0.07; }
                }
                @keyframes fade-up {
                    0%   { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes img-appear {
                    0%   { opacity: 0; transform: scale(0.88); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>

            {/* 3D 일러스트레이션 */}
            <div
                style={{
                    width: 260,
                    height: 260,
                    animation: 'img-appear 0.5s ease-out forwards, float-gently 4s ease-in-out 0.5s infinite',
                }}
            >
                <img
                    src={imageSrc}
                    alt="transition"
                    className="w-full h-full object-contain"
                />
            </div>

            {/* 그림자 */}
            <div
                className="w-36 h-5 bg-black rounded-full blur-xl -mt-4"
                style={{ animation: 'shadow-breathe 4s ease-in-out 0.5s infinite' }}
            />

            {/* 텍스트 */}
            <p
                className="mt-8 text-[15px] font-semibold text-gray-600 tracking-tight"
                style={{ animation: 'fade-up 0.6s ease-out 0.4s both' }}
            >
                {targetMode === 'host' ? '호스트 모드로 전환 중' : '게스트 모드로 전환 중'}
            </p>
            <p
                className="mt-1.5 text-[12px] text-gray-400"
                style={{ animation: 'fade-up 0.6s ease-out 0.6s both' }}
            >
                {targetMode === 'host' ? '여행자들을 만나볼 준비를 해요 ✨' : '새로운 여행을 떠나볼까요 🌍'}
            </p>
        </div>
    );
}
