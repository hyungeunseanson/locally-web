'use client';

import { useEffect, useState } from 'react';
import type { LocallyMembershipSummary } from '@/app/utils/memberStatus';

export function useLocallyMembership(userId: string | null | undefined) {
  const [membership, setMembership] = useState<LocallyMembershipSummary | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      return;
    }

    void fetch('/api/account/membership', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; membership?: LocallyMembershipSummary; error?: string };
        if (!response.ok || !result.success || !result.membership) {
          throw new Error(result.error || 'Failed to resolve membership.');
        }
        return result.membership;
      })
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
  }, [userId]);

  return {
    membership: resolvedUserId === userId ? membership : null,
    isLoading: Boolean(userId) && resolvedUserId !== userId,
    hasLocallyCare:
      resolvedUserId === userId &&
      (membership?.status === 'member' || membership?.status === 'circle'),
  };
}
