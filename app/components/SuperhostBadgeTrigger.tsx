'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useLanguage } from '@/app/context/LanguageContext';

type SuperhostBadgeTriggerProps = {
  className?: string;
  iconSize?: number;
  labelClassName?: string;
  showLabel?: boolean;
  testIdPrefix?: string;
};

export default function SuperhostBadgeTrigger({
  className = '',
  iconSize = 18,
  labelClassName = '',
  showLabel = true,
  testIdPrefix = 'superhost-badge',
}: SuperhostBadgeTriggerProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [supportsHover] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(hover: hover)').matches;
  });
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const panelId = `${testIdPrefix}-panel`;

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
    <span ref={wrapperRef} className={`relative inline-flex shrink-0 ${className}`.trim()} {...hoverHandlers}>
      <button
        type="button"
        aria-label={t('host_superhost_info_aria')}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? panelId : undefined}
        data-testid={`${testIdPrefix}-trigger`}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
      >
        <Image
          src="/images/badges/superhost-blue-check.png"
          alt=""
          width={iconSize}
          height={iconSize}
          aria-hidden="true"
          className="shrink-0 drop-shadow-[0_1px_3px_rgba(14,165,233,0.35)]"
        />
        {showLabel ? (
          <span className={`text-xs font-bold text-slate-900 ${labelClassName}`.trim()}>
            {t('host_superhost')}
          </span>
        ) : null}
      </button>

      {isOpen && (
        <span
          id={panelId}
          role="tooltip"
          data-testid={panelId}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-1/2 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-[12px] font-medium leading-relaxed text-slate-700 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl ring-1 ring-sky-100/70"
        >
          <span className="mb-1 block text-[13px] font-black text-slate-950">{t('host_superhost')}</span>
          <span className="block">{t('host_superhost_verified_desc')}</span>
        </span>
      )}
    </span>
  );
}
