'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function MobileSplash({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1000);
    const doneTimer = setTimeout(() => onDoneRef.current(), 1300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []); // onDone 참조 변화에 영향받지 않도록 빈 deps

  return (
    <div
      className={`md:hidden transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
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
        className="w-[144px] h-[144px] object-contain"
      />
    </div>
  );
}
