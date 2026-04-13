/* eslint-disable @next/next/no-img-element */
'use client';

// Splash art stays on plain static assets to avoid image optimization cost for a short-lived full-screen transition.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function MobileSplash({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 1000);
    const doneTimer = window.setTimeout(() => onDoneRef.current(), 1300);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
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
