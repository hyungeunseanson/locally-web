'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';

import LocallyMembershipBadge from './LocallyMembershipBadge';

type Props = {
  status: Exclude<LocallyMembershipStatus, 'none'>;
  memberDescription: string;
  circleDescription: string;
  ariaLabel: string;
  testIdPrefix: string;
  size?: 'default' | 'compact';
  className?: string;
};

export default function LocallyMembershipBadgeTrigger({
  status,
  memberDescription,
  circleDescription,
  ariaLabel,
  testIdPrefix,
  size = 'default',
  className = '',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [supportsHover] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(hover: hover)').matches;
  });
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const panelId = `${testIdPrefix}-panel`;
  const sections = useMemo(
    () =>
      [
        { key: 'member', lines: memberDescription.split('\n').map((line) => line.trim()).filter(Boolean) },
        { key: 'circle', lines: circleDescription.split('\n').map((line) => line.trim()).filter(Boolean) },
      ].map(({ key, lines }) => ({
        key,
        title: lines[0] ?? '',
        bodyLines: lines.slice(1),
      })),
    [circleDescription, memberDescription]
  );

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
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? panelId : undefined}
        data-testid={`${testIdPrefix}-trigger`}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onFocus={() => setIsOpen(true)}
        className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C38A] focus-visible:ring-offset-2"
      >
        <LocallyMembershipBadge status={status} size={size} />
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="tooltip"
          data-testid={panelId}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#E9D6A8] bg-white px-4 py-3 text-[12px] leading-6 text-slate-600 shadow-[0_18px_48px_rgba(91,69,32,0.16)] sm:left-1/2 sm:w-80 sm:-translate-x-1/2 md:text-[13px]"
        >
          <div className="space-y-3">
            {sections.map((section) => {
              const isActive = status === section.key;
              return (
                <div
                  key={section.key}
                  className={`rounded-xl border px-3 py-2.5 ${
                    isActive ? 'border-[#E9D6A8] bg-[#FFF8E6]' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {section.title ? (
                    <p className={`text-[13px] font-bold md:text-sm ${isActive ? 'text-[#5B4520]' : 'text-slate-900'}`}>
                      {section.title}
                    </p>
                  ) : null}
                  <div className={`${section.title ? 'mt-1' : ''} space-y-0.5`}>
                    {section.bodyLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}
