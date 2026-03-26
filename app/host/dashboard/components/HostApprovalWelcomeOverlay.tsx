'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, PartyPopper, X } from 'lucide-react';
import confetti from 'canvas-confetti';

import { useLanguage } from '@/app/context/LanguageContext';

type HostApprovalWelcomeOverlayProps = {
  onPrimaryAction: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
};

export default function HostApprovalWelcomeOverlay({
  onPrimaryAction,
  onDismiss,
}: HostApprovalWelcomeOverlayProps) {
  const { t } = useLanguage();
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (celebratedRef.current) return;
    celebratedRef.current = true;

    const random = (min: number, max: number) => Math.random() * (max - min) + min;
    const defaults = {
      startVelocity: 34,
      spread: 70,
      ticks: 100,
      gravity: 0.95,
      decay: 0.92,
      scalar: 0.95,
      zIndex: 1000,
      colors: ['#111827', '#22c55e', '#0ea5e9', '#f59e0b'],
    };

    confetti({ ...defaults, particleCount: 36, origin: { x: random(0.14, 0.24), y: 0.2 } });
    confetti({ ...defaults, particleCount: 36, origin: { x: random(0.76, 0.86), y: 0.2 } });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 px-4 py-6" data-testid="host-approval-welcome-overlay">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <button
          type="button"
          onClick={() => void onDismiss()}
          aria-label={t('cancel')}
          className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          <X size={16} />
        </button>

        <div className="space-y-5 px-6 pb-7 pt-8 text-center md:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-inner">
            <PartyPopper size={28} />
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            <CheckCircle2 size={14} />
            <span>{t('host_approved')}</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-[30px]">
              {t('host_approval_welcome_title')}
            </h2>
            <p className="text-sm leading-7 text-slate-600 md:text-[15px]">
              {t('host_approval_welcome_desc')}
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => void onPrimaryAction()}
              className="w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-300 transition-transform hover:scale-[1.01]"
            >
              {t('host_approval_welcome_cta')}
            </button>
            <button
              type="button"
              onClick={() => void onDismiss()}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t('host_approval_welcome_dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
