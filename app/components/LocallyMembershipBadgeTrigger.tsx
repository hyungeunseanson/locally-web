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
          className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-[12px] leading-[1.6] text-slate-600 shadow-[0_22px_60px_rgba(15,23,42,0.16)] sm:left-1/2 sm:w-[22rem] sm:-translate-x-1/2 md:text-[13px]"
        >
          <div className="divide-y divide-slate-100">
            {sections.map((section) => {
              const isActive = status === section.key;
              return (
                <div key={section.key} className="py-3 first:pt-0 last:pb-0">
                  {section.title ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${isActive ? 'bg-[#C9A64B]' : 'bg-slate-300'}`}
                        aria-hidden="true"
                      />
                      <p className={`text-[13px] font-bold md:text-sm ${isActive ? 'text-[#5B4520]' : 'text-slate-900'}`}>
                        {section.title}
                      </p>
                    </div>
                  ) : null}
                  <div className={`${section.title ? 'mt-1.5 pl-4' : ''} space-y-1`}>
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
