'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 모달 닫힘 애니메이션을 위한 훅.
 * isOpen이 false로 바뀌어도 duration 동안 DOM을 유지해 퇴장 트랜지션을 재생한다.
 *
 * @returns visible – DOM 렌더 여부, closing – 퇴장 중 여부, requestClose – onClose 대신 호출
 */
export function useModalClose(isOpen: boolean, onClose: () => void, duration = 150) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reopening must clear exit state immediately to preserve modal timing.
      setClosing(false);
    }
  }, [isOpen]);

  // cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setClosing(false);
      onClose();
    }, duration);
  }, [closing, onClose, duration]);

  return {
    visible: isOpen || closing,
    closing,
    requestClose,
  };
}
