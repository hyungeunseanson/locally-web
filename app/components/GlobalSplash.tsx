/* eslint-disable @next/next/no-img-element */
'use client';

// Splash art stays on plain static assets to avoid image optimization cost for a short-lived full-screen transition.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSplash } from '@/app/context/SplashContext';

export default function GlobalSplash() {
  const { visible, hideSplash } = useSplash();

  useEffect(() => {
    if (!visible) return;
    const doneTimer = window.setTimeout(() => {
      hideSplash();
    }, 1300);

    return () => {
      clearTimeout(doneTimer);
    };
  }, [visible, hideSplash]);

  if (!visible || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="locally-brand-splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#F8F8F8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/images/logo-black-transparent.png"
        alt="Locally"
        className="w-[144px] h-[144px] md:w-[216px] md:h-[216px] object-contain"
      />
    </div>,
    document.body
  );
}
