'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';

type Props = {
  description: string;
  ariaLabel: string;
  testIdPrefix: string;
};

export default function LocallyMembershipInfoTrigger({
  description,
  ariaLabel,
  testIdPrefix,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [supportsHover] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(hover: hover)').matches;
  });
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hoverHandlers = useMemo(
    () =>
      supportsHover
        ? {
            onMouseEnter: () => setIsOpen(true),
            onMouseLeave: () => setIsOpen(false),
          }
        : {},
    [supportsHover]
  );

  return (
    <span ref={wrapperRef} className="relative inline-flex shrink-0" {...hoverHandlers}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        data-testid={`${testIdPrefix}-trigger`}
        onClick={() => setIsOpen((prev) => !prev)}
        onFocus={() => setIsOpen(true)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          data-testid={`${testIdPrefix}-panel`}
          className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] whitespace-pre-line rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px] leading-6 text-slate-600 shadow-xl md:w-80 md:text-[13px]"
        >
          {description}
        </div>
      )}
    </span>
  );
}
