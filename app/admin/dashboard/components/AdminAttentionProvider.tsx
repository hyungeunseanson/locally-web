'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { AdminAttentionStore, EMPTY_ATTENTION } from '@/app/utils/adminAttentionState';

const AttentionContext = createContext<AdminAttentionStore | null>(null);
const noSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_ATTENTION;
export function useAdminAttention() { return useContext(AttentionContext); }
export function useAdminAttentionSnapshot() {
  const store = useAdminAttention();
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getSnapshot ?? emptySnapshot, emptySnapshot);
}
export default function AdminAttentionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const store = useMemo(() => new AdminAttentionStore(fetch, userId), [userId]);
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    let stopped = false;
    store.start();
    const catchUp = () => { if (!stopped && !document.hidden) void store.refresh(); };
    const channel = supabase.channel(`admin-attention-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiry_messages' }, payload => {
        const id = (payload.new as { inquiry_id?: string }).inquiry_id ?? (payload.old as { inquiry_id?: string }).inquiry_id;
        if (id != null) store.changed(id); else catchUp();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, payload => {
        const id = (payload.new as { id?: string }).id ?? (payload.old as { id?: string }).id;
        if (id != null) store.changed(id); else catchUp();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, store.alertsChanged)
      .subscribe(status => { if (status === 'SUBSCRIBED') catchUp(); });
    catchUp();
    let timer: ReturnType<typeof setTimeout>;
    const fallback = () => { timer = setTimeout(() => { catchUp(); fallback(); }, 300_000); };
    fallback();
    window.addEventListener('online', catchUp);
    document.addEventListener('visibilitychange', catchUp);
    return () => {
      stopped = true; clearTimeout(timer); store.stop(); void supabase.removeChannel(channel);
      window.removeEventListener('online', catchUp); document.removeEventListener('visibilitychange', catchUp);
    };
  }, [store, supabase, userId]);
  return <AttentionContext.Provider value={store}>{children}</AttentionContext.Provider>;
}
