'use client';

import React from 'react';

interface DesktopModeTransitionProps {
  targetMode: 'host' | 'guest';
}

export default function DesktopModeTransition({ targetMode }: DesktopModeTransitionProps) {
  const isHostMode = targetMode === 'host';
  const imageSrc = isHostMode
    ? '/images/host-transition.png'
    : '/images/guest-transition.png';
  const overlayBackground = isHostMode ? '#fcfefb' : '#fffefc';
  const illustrationSize = isHostMode ? 'clamp(360px, 29vw, 460px)' : 'clamp(340px, 27vw, 430px)';
  const illustrationScale = isHostMode ? 1.04 : 1.015;
  const shadowWidth = isHostMode ? 'clamp(210px, 15vw, 260px)' : 'clamp(190px, 14vw, 230px)';

  return (
    <div
      className="fixed inset-0 z-[9999] hidden md:flex flex-col items-center justify-center px-8 animate-in fade-in duration-300"
      style={{ pointerEvents: 'none', backgroundColor: overlayBackground }}
    >
      <style>{`
        @keyframes desktop-image-appear {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes desktop-float-gently {
          0%, 100% { transform: translateY(0px) rotate(-0.8deg) scale(1); }
          33% { transform: translateY(-14px) rotate(0.9deg) scale(1.03); }
          66% { transform: translateY(-8px) rotate(-0.4deg) scale(1.018); }
        }
        @keyframes desktop-shadow-breathe {
          0%, 100% { transform: scaleX(1); opacity: 0.14; }
          50% { transform: scaleX(0.84); opacity: 0.08; }
        }
        @keyframes desktop-text-enter {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes desktop-soft-pulse {
          0%, 100% { opacity: 0.82; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>

      <div
        style={{
          width: illustrationSize,
          height: illustrationSize,
          animation: 'desktop-image-appear 0.48s cubic-bezier(0.22, 1, 0.36, 1) forwards, desktop-float-gently 3.6s ease-in-out 0.48s infinite',
        }}
      >
        <img
          src={imageSrc}
          alt="mode-transition"
          className="w-full h-full object-contain"
          style={{ transform: `scale(${illustrationScale})` }}
        />
      </div>

      <div
        className="h-5 rounded-full bg-black blur-xl -mt-6"
        style={{ width: shadowWidth, animation: 'desktop-shadow-breathe 3.6s ease-in-out 0.48s infinite' }}
      />

      <p className="mt-9 text-base lg:text-lg font-semibold text-gray-700 tracking-tight"
        style={{ animation: 'desktop-text-enter 0.45s ease-out 0.16s both, desktop-soft-pulse 2.8s ease-in-out 0.7s infinite' }}
      >
        {isHostMode ? '호스트 모드로 전환 중' : '게스트 모드로 전환 중'}
      </p>
    </div>
  );
}
