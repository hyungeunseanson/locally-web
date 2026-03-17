'use client';

import React, { useEffect, useState } from 'react';

export default function MobileSplash({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1000);
    const doneTimer = setTimeout(() => onDone(), 1350);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`md:hidden fixed inset-0 z-[9999] bg-[#F3F3F3] flex flex-col items-center justify-center transition-opacity duration-350 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <img
        src="/images/logo.png"
        alt="Locally"
        className="w-[144px] h-[144px] object-contain mix-blend-multiply grayscale contrast-200"
      />
    </div>
  );
}
