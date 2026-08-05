'use client';

import { useEffect, useRef } from 'react';

type ExperienceDraftRestoreDialogProps = {
  title: string;
  description: string;
  continueLabel: string;
  startNewLabel: string;
  onContinue: () => void;
  onStartNew: () => void;
};

export default function ExperienceDraftRestoreDialog({
  title,
  description,
  continueLabel,
  startNewLabel,
  onContinue,
  onStartNew,
}: ExperienceDraftRestoreDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    );
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-draft-dialog-title"
        aria-describedby="experience-draft-dialog-description"
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl sm:p-6"
      >
        <h2 id="experience-draft-dialog-title" className="text-lg font-bold text-slate-950">
          {title}
        </h2>
        <p id="experience-draft-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onContinue}
            className="h-11 flex-1 rounded-md bg-black px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            {continueLabel}
          </button>
          <button
            type="button"
            onClick={onStartNew}
            className="h-11 flex-1 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            {startNewLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
