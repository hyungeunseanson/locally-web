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
      className="fixed inset-0 z-[9999] hidden md:flex flex-col items-center justify-center bg-white/95 backdrop-blur-md animate-in fade-in duration-300"
      style={{ pointerEvents: 'none' }}
    >
      <style>{`
        @keyframes desktop-float-gently {
          0%, 100% { transform: translateY(0px) rotate(-0.8deg) scale(1); }
          33% { transform: translateY(-12px) rotate(0.9deg) scale(1.03); }
          66% { transform: translateY(-7px) rotate(-0.4deg) scale(1.015); }
        }
        @keyframes desktop-shadow-breathe {
          0%, 100% { transform: scaleX(1); opacity: 0.12; }
          50% { transform: scaleX(0.84); opacity: 0.07; }
        }
        @keyframes desktop-soft-pulse {
          0%, 100% { opacity: 0.78; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>

      <div
        style={{
          width: 320,
          height: 320,
          animation: 'desktop-float-gently 3.3s ease-in-out infinite',
        }}
      >
        <img
          src={imageSrc}
          alt="mode-transition"
          className="w-full h-full object-contain"
        />
      </div>

      <div
        className="w-44 h-5 bg-black rounded-full blur-xl -mt-5"
        style={{ animation: 'desktop-shadow-breathe 3.3s ease-in-out infinite' }}
      />

      <p className="mt-8 text-[16px] font-semibold text-gray-700 tracking-tight"
        style={{ animation: 'desktop-soft-pulse 2.6s ease-in-out infinite' }}
      >
        {targetMode === 'host' ? '호스트 모드로 전환 중' : '게스트 모드로 전환 중'}
      </p>
    </div>
  );
}
