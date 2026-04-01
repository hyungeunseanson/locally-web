import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type StatusTone = 'info' | 'success' | 'warning' | 'error';
type StatusSize = 'sm' | 'md';

type StatusNoticeProps = {
  tone: StatusTone;
  size?: StatusSize;
  role?: 'status' | 'alert';
  testId?: string;
  icon?: React.ReactNode | null;
  className?: string;
  children: React.ReactNode;
};

const TONE_STYLES: Record<StatusTone, string> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
};

const SIZE_STYLES: Record<StatusSize, string> = {
  sm: 'rounded-lg px-3 py-2 text-[11px] md:text-xs',
  md: 'rounded-2xl px-4 py-3 text-[12px] md:text-[13px]',
};

const ICON_STYLES: Record<StatusSize, string> = {
  sm: 'mt-0.5 h-3.5 w-3.5',
  md: 'mt-0.5 h-4 w-4',
};

const TONE_ICON: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function StatusNotice({
  tone,
  size = 'md',
  role,
  testId,
  icon,
  className = '',
  children,
}: StatusNoticeProps) {
  const Icon = TONE_ICON[tone];
  const resolvedRole = role ?? (tone === 'error' ? 'alert' : 'status');
  const leadingIcon = icon === undefined ? <Icon className={ICON_STYLES[size]} /> : icon;

  return (
    <div
      data-testid={testId}
      data-tone={tone}
      role={resolvedRole}
      className={cn(
        'flex items-start gap-2 border leading-relaxed',
        TONE_STYLES[tone],
        SIZE_STYLES[size],
        className
      )}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
