'use client';

import type { ReactNode } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';

export function FieldHint({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`mt-1 ml-1 text-xs leading-5 text-slate-500 ${className}`}>{children}</p>;
}

export function HelpDisclosure({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group rounded-2xl border border-slate-200 bg-slate-50/80 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CircleHelp size={16} className="text-slate-400" />
          <span>{title}</span>
        </div>
        <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600">
        {children}
      </div>
    </details>
  );
}
