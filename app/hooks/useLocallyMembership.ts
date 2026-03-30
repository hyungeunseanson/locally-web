'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import {
  fetchLocallyMembershipSummary,
  type LocallyMembershipSummary,
} from '@/app/utils/memberStatus';

export function useLocallyMembership(userId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [membership, setMembership] = useState<LocallyMembershipSummary | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      return;
    }

    void fetchLocallyMembershipSummary(supabase, userId)
      .then((summary) => {
        if (!cancelled) {
          setMembership(summary);
          setResolvedUserId(userId);
        }
      })
      .catch((error) => {
        console.error('[useLocallyMembership] failed to resolve membership:', error);
        if (!cancelled) {
          setMembership(null);
          setResolvedUserId(userId);
        }
      })
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  return {
    membership: resolvedUserId === userId ? membership : null,
    isLoading: Boolean(userId) && resolvedUserId !== userId,
    hasLocallyCare:
      resolvedUserId === userId &&
      (membership?.status === 'member' || membership?.status === 'circle'),
  };
}
