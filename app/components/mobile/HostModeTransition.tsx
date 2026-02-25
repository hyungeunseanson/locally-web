'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface HostModeTransitionProps {
    targetMode: 'host' | 'guest';
    onComplete?: () => void;
}

export default function HostModeTransition({ targetMode, onComplete }: HostModeTransitionProps) {
    const [phase, setPhase] = useState<'shrink' | 'logo' | 'expand' | 'done'>('shrink');
    const router = useRouter();

    useEffect(() => {
        // Phase 1: 현재 화면 축소 (0~400ms)
        const t1 = setTimeout(() => setPhase('logo'), 400);
        // Phase 2: 로고 및 파티클 표시 (400~900ms)
        const t2 = setTimeout(() => setPhase('expand'), 900);
        // Phase 3: 새 화면 등장 (900~1300ms)
        const t3 = setTimeout(() => {
            setPhase('done');
            if (targetMode === 'host') {
                router.push('/host/dashboard');
            } else {
                router.push('/');
            }
            onComplete?.();
        }, 1300);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    // 파티클 위치 (미리 계산)
    const particles = [
        { top: '18%', left: '12%', delay: '0ms', size: 5, color: '#FF385C' },
        { top: '22%', left: '82%', delay: '80ms', size: 4, color: '#111827' },
        { top: '70%', left: '8%', delay: '120ms', size: 6, color: '#FF385C' },
        { top: '75%', left: '88%', delay: '60ms', size: 4, color: '#111827' },
        { top: '40%', left: '5%', delay: '200ms', size: 3, color: '#6B7280' },
        { top: '35%', left: '92%', delay: '150ms', size: 5, color: '#FF385C' },
        { top: '85%', left: '45%', delay: '90ms', size: 4, color: '#111827' },
        { top: '12%', left: '55%', delay: '30ms', size: 3, color: '#6B7280' },
    ];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #111827 0%, #1f2937 50%, #111827 100%)',
            }}
        >
            <style>{`
        @keyframes float-up {
          0% { transform: translateY(0px) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(0); opacity: 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 0.4; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
        @keyframes logo-pop {
          0% { transform: scale(0.3) rotateY(-20deg); opacity: 0; }
          60% { transform: scale(1.08) rotateY(5deg); opacity: 1; }
          100% { transform: scale(1) rotateY(0deg); opacity: 1; }
        }
        @keyframes slide-in-up {
          0% { transform: translateY(40px) rotateX(8deg); opacity: 0; }
          100% { transform: translateY(0) rotateX(0deg); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

            {/* 파티클 */}
            {phase === 'logo' || phase === 'expand' ? (
                <>
                    {particles.map((p, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full"
                            style={{
                                top: p.top,
                                left: p.left,
                                width: p.size,
                                height: p.size,
                                backgroundColor: p.color,
                                animationName: 'float-up',
                                animationDuration: '1.2s',
                                animationDelay: p.delay,
                                animationFillMode: 'forwards',
                                animationTimingFunction: 'ease-out',
                            }}
                        />
                    ))}
                </>
            ) : null}

            {/* 로고 중앙 */}
            <div
                style={{
                    animationName: phase === 'logo' || phase === 'expand' ? 'logo-pop' : 'none',
                    animationDuration: '0.5s',
                    animationFillMode: 'forwards',
                    animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    opacity: phase === 'shrink' ? 0 : 1,
                    perspective: 1000,
                }}
                className="flex flex-col items-center gap-4"
            >
                {/* 펄스 링 */}
                <div className="relative flex items-center justify-center">
                    <div
                        className="absolute rounded-full border-2 border-rose-500/30 w-24 h-24"
                        style={{ animation: 'pulse-ring 1.5s ease-in-out infinite' }}
                    />
                    <div
                        className="absolute rounded-full border border-rose-500/15 w-32 h-32"
                        style={{ animation: 'pulse-ring 1.5s ease-in-out infinite', animationDelay: '0.3s' }}
                    />

                    {/* 로고 아이콘 */}
                    <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-2xl overflow-hidden relative">
                        <img src="/images/logo.png" alt="Locally" className="w-12 h-12 object-contain" />
                        {/* 쉬머 효과 */}
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            style={{
                                animationName: 'shimmer',
                                animationDuration: '1.5s',
                                animationIterationCount: 'infinite',
                                animationTimingFunction: 'linear',
                            }}
                        />
                    </div>
                </div>

                {/* 텍스트 */}
                <div
                    style={{
                        animationName: phase === 'expand' ? 'slide-in-up' : 'none',
                        animationDuration: '0.4s',
                        animationFillMode: 'forwards',
                    }}
                    className="text-center"
                >
                    <p className="text-white text-[13px] font-semibold tracking-widest uppercase opacity-80">
                        {targetMode === 'host' ? '호스트 모드 전환 중' : '게스트 모드 전환 중'}
                    </p>
                    <p className="text-white/40 text-[11px] mt-1">Locally</p>
                </div>

                {/* 로딩 바 */}
                <div className="w-32 h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                        style={{
                            width: phase === 'shrink' ? '0%' : phase === 'logo' ? '50%' : '100%',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
