'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'red' for destructive actions, 'default' for neutral */
  tone?: 'red' | 'default';
  isProcessing?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'default',
  isProcessing = false,
}: ConfirmModalProps) {
  // 닫힘 애니메이션
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reopening must clear exit state immediately to preserve modal timing.
      setClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleCancel = useCallback(() => {
    if (closing || isProcessing) return;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setClosing(false);
      onCancel();
    }, 150);
  }, [closing, isProcessing, onCancel]);

  // Escape 키 지원
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleCancel]);

  if (!isOpen && !closing) return null;

  const isRed = tone === 'red';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-150 ${closing ? 'opacity-0' : 'animate-in fade-in duration-200'}`}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleCancel} />

      <div
        className={`relative w-full max-w-[360px] md:max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-150 ${closing ? 'opacity-0 scale-95' : 'animate-in zoom-in-95 duration-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleCancel}
          className="absolute right-3 top-3 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-7 pb-5 text-center">
          {isRed && (
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
          )}
          <h3 className="text-[16px] md:text-[17px] font-bold text-slate-900 leading-snug">{title}</h3>
          <p className="mt-2 text-[13px] md:text-sm text-slate-500 leading-relaxed whitespace-pre-line">{description}</p>
        </div>

        <div className="flex gap-2.5 px-5 pb-5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex-1 h-11 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 h-11 rounded-xl text-[14px] font-bold text-white transition-colors disabled:opacity-50 ${
              isRed
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-slate-900 hover:bg-black'
            }`}
          >
            {isProcessing ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
