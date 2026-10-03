'use client';

import { useCallback, useEffect, useState } from 'react';

/** Observes existing I/O only. No channel, timer or request is created here. */
export function useAdminChatSync(enabled = true) {
  const [subscription, setSubscription] = useState(false);
  const [online, setOnline] = useState(true);
  const [visible, setVisible] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const connectivity = () => setOnline(window.navigator.onLine);
    const visibility = () => setVisible(!document.hidden);
    connectivity(); visibility();
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled]);
  const onSubscription = useCallback((status: string) => setSubscription(status === 'SUBSCRIBED'), []);
  const onSuccess = useCallback(() => { setLastSyncedAt(new Date().toISOString()); setFailed(false); }, []);
  const onFailure = useCallback(() => setFailed(true), []);
  const state: 'offline' | 'paused' | 'connected' | 'reconnecting' = !online ? 'offline' : !visible || !enabled ? 'paused' : subscription && !failed ? 'connected' : 'reconnecting';
  return { state, lastSyncedAt, onSubscription, onSuccess, onFailure };
}
export type AdminChatSync = ReturnType<typeof useAdminChatSync>;
