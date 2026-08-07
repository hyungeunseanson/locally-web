'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { useLanguage } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';
import { useModalClose } from '@/app/hooks/useModalClose';
import { getSupportInquiryCopy } from './supportInquiryCopy';

type SupportInquiryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUnauthorized: () => void;
  onSubmitted: (redirectUrl: string) => void;
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.hasAttribute('hidden'));
}

export default function SupportInquiryModal({
  isOpen,
  onClose,
  onUnauthorized,
  onSubmitted,
}: SupportInquiryModalProps) {
  const { lang, t } = useLanguage();
  const { showToast } = useToast();
  const copy = getSupportInquiryCopy(lang);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const completeClose = useCallback(() => {
    setContent('');
    onClose();
  }, [onClose]);
  const { visible, closing, requestClose } = useModalClose(isOpen, completeClose);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;

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
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, requestClose]);

  const handleSubmit = async () => {
    const message = content.trim();
    if (!message || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/inquiries/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextType: 'admin_support',
          message,
        }),
      });
      const result = await response.json().catch(() => null) as {
        success?: boolean;
        inquiryId?: string | number;
        redirectUrl?: string;
        error?: string;
      } | null;

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok || !result?.success || !result.inquiryId) {
        throw new Error(result?.error || copy.noAdmin);
      }

      setContent('');
      showToast(copy.submitSuccess, 'success');
      onClose();
      onSubmitted(result.redirectUrl || `/guest/inbox?inquiryId=${result.inquiryId}`);
    } catch (error: unknown) {
      console.error('[support inquiry] submit failed:', error);
      const dbError = error as { code?: string; message?: string };
      let message = error instanceof Error ? error.message : copy.unknownError;

      if (dbError.code === '23503' && dbError.message?.includes('profiles')) {
        message = copy.profileSyncDelay;
      }

      showToast(copy.submitFailPrefix + message, 'error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      data-testid="help-contact-modal"
      className={`fixed inset-0 z-[190] flex items-end bg-black/35 backdrop-blur-[1px] transition-opacity duration-150 md:items-center md:justify-center md:p-4 ${closing ? 'opacity-0' : 'animate-in fade-in'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[min(88dvh,680px)] w-full flex-col rounded-t-[28px] bg-[#fcfcfc] px-5 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+16px)] pt-5 shadow-2xl md:h-auto md:max-h-[78dvh] md:max-w-[560px] md:rounded-[28px] md:px-7 md:pb-6 md:pt-6"
      >
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            aria-label={copy.closeSr}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <h2 id={titleId} className="mb-1.5 text-[19px] font-medium leading-tight tracking-[-0.01em] md:text-[24px]">
          {copy.modalTitle}
        </h2>
        <p className="mb-4 text-[11px] leading-relaxed text-slate-500 md:mb-5 md:text-[13px]">
          {copy.modalDesc}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <textarea
            ref={textareaRef}
            data-testid="support-inquiry-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={copy.modalPlaceholder}
            className="h-[122px] w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[12px] font-normal text-slate-700 placeholder:text-slate-300 focus:border-slate-500 focus:outline-none md:h-[170px] md:px-5 md:py-4 md:text-[14px]"
          />
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500 md:text-[12px]">
            {t('help_modal_inbox_hint')}
          </p>
        </div>
        <div className="mt-5 flex-shrink-0">
          <button
            type="button"
            data-testid="support-inquiry-submit"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            aria-busy={isSubmitting}
            className={`w-full rounded-2xl py-3 text-[13px] font-medium md:py-3.5 md:text-[15px] ${
              !content.trim() || isSubmitting
                ? 'cursor-not-allowed bg-slate-300 text-slate-50'
                : 'bg-[#111827] text-white hover:bg-slate-800'
            }`}
          >
            {isSubmitting ? copy.modalSubmitting : copy.modalSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
