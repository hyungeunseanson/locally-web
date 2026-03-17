'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function MobileSplash({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setMounted(true);
    const fadeTimer = setTimeout(() => setFading(true), 1000);
    const doneTimer = setTimeout(() => onDoneRef.current(), 1300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!mounted) return null;

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
        className="w-[144px] h-[144px] md:w-[432px] md:h-[432px] object-contain"
      />
    </div>,
    document.body
  );
}
