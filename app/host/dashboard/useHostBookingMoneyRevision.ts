'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';

// The same booking change signal used by reservations, scoped to this host.
// One subscription feeds both the summary and its chart through the revision.
export function useHostBookingMoneyRevision() {
  const db = useMemo(() => createClient(), []);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof db.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; if (!cancelled) setRevision(value => value + 1); }, 350);
    };
    async function subscribe() {
      const { data: { user } } = await db.auth.getUser();
      if (!user || cancelled) return;
      const { data: experiences } = await db.from('experiences').select('id').eq('host_id', user.id);
      if (cancelled) return;
      const ids = new Set((experiences || []).map(row => String(row.id)));
      channel = db.channel('host-earnings-booking-money')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, payload => {
          const next = payload.new as { experience_id?: number };
          const prior = payload.old as { experience_id?: number };
          if (ids.has(String(next.experience_id || prior.experience_id))) refresh();
        }).subscribe();
    }
    void subscribe().catch(() => {});
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; if (timer) clearTimeout(timer); if (channel) void db.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible); };
  }, [db]);
  return revision;
}
