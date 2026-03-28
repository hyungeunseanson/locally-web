'use client';

import React, { useCallback, useRef, useState } from 'react';
import ConfirmModal from '@/app/components/ui/ConfirmModal';

interface ConfirmConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'red' | 'default';
}

/**
 * confirm() 대체용 훅.
 * `requestConfirm(config, onConfirm)` 호출 → 모달 표시 → 확인 시 onConfirm 실행.
 * JSX에 `<ConfirmDialogElement />` 를 한 번 렌더하면 됨.
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmConfig>({ title: '', description: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const onConfirmRef = useRef<(() => void | Promise<void>) | null>(null);

  const requestConfirm = useCallback((cfg: ConfirmConfig, onConfirm: () => void | Promise<void>) => {
    setConfig(cfg);
    onConfirmRef.current = onConfirm;
    setIsOpen(true);
    setIsProcessing(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!onConfirmRef.current) return;
    setIsProcessing(true);
    try {
      await onConfirmRef.current();
    } finally {
      setIsProcessing(false);
      setIsOpen(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const ConfirmDialogElement = (
    <ConfirmModal
      isOpen={isOpen}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={config.title}
      description={config.description}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      tone={config.tone}
      isProcessing={isProcessing}
    />
  );

  return { requestConfirm, ConfirmDialogElement };
}
