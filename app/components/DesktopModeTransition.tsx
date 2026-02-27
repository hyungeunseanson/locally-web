'use client';

import React from 'react';

interface DesktopModeTransitionProps {
  targetMode: 'host' | 'guest';
}

export default function DesktopModeTransition({ targetMode }: DesktopModeTransitionProps) {
  const imageSrc = targetMode === 'host'
    ? '/images/host-transition.png'
    : '/images/guest-transition.png';

  return (
    <div
      className="fixed inset-0 z-[9999] hidden md:flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in duration-150"
      style={{ pointerEvents: 'none' }}
    >
      <style>{`
        @keyframes desktop-float-gently {
          0%, 100% { transform: translateY(0px) rotate(-1deg) scale(1); }
          33% { transform: translateY(-9px) rotate(1deg) scale(1.02); }
          66% { transform: translateY(-5px) rotate(-0.5deg) scale(1.01); }
        }
        @keyframes desktop-shadow-breathe {
          0%, 100% { transform: scaleX(1); opacity: 0.12; }
          50% { transform: scaleX(0.88); opacity: 0.07; }
        }
      `}</style>

      <div
        style={{
          width: 230,
          height: 230,
          animation: 'desktop-float-gently 2.8s ease-in-out infinite',
        }}
      >
        <img
          src={imageSrc}
          alt="mode-transition"
          className="w-full h-full object-contain"
        />
      </div>

      <div
        className="w-32 h-4 bg-black rounded-full blur-xl -mt-3"
        style={{ animation: 'desktop-shadow-breathe 2.8s ease-in-out infinite' }}
      />

      <p className="mt-7 text-[14px] font-semibold text-gray-700 tracking-tight">
        {targetMode === 'host' ? '호스트 모드로 전환 중' : '게스트 모드로 전환 중'}
      </p>
    </div>
  );
}
