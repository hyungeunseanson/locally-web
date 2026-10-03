'use client';

import { useCallback, useEffect, useRef } from 'react';
import { adjacentConversation } from '@/app/utils/adminChatOperations';

export function useConversationNavigation(ids: string[], selectedId: string | null, select: (id: string) => void, enabled: boolean) {
  const current = useRef({ ids, selectedId, select });
  useEffect(() => { current.current = { ids, selectedId, select }; }, [ids, selectedId, select]);
  const move = useCallback((direction: -1 | 1) => {
    const next = adjacentConversation(current.current.ids, current.current.selectedId, direction);
    if (next == null) return;
    current.current.selectedId = next;
    current.current.select(next);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
        || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      const target = event.target instanceof window.Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
        || document.querySelector('dialog[open],[role="dialog"],details[open]')) return;
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled, move]);
  return { move, previous: adjacentConversation(ids, selectedId, -1), next: adjacentConversation(ids, selectedId, 1) };
}
