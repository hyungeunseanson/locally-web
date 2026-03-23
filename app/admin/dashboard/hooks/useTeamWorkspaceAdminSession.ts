'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchAdminAccess } from '@/app/utils/adminAccessClient';
import { createClient } from '@/app/utils/supabase/client';

type TeamWorkspaceCurrentUser = {
  id: string;
  name: string;
};

export type TeamWorkspaceSessionState =
  | { status: 'loading'; currentUser: null }
  | { status: 'ready'; currentUser: TeamWorkspaceCurrentUser }
  | { status: 'unauthorized'; currentUser: null; reason: 'no-session' | 'forbidden' | 'error' };

const SESSION_RETRY_DELAYS_MS = [0, 500, 1500] as const;

const LOADING_SESSION_STATE: TeamWorkspaceSessionState = {
  status: 'loading',
  currentUser: null,
};

export function useTeamWorkspaceAdminSession(): TeamWorkspaceSessionState {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<TeamWorkspaceSessionState>(LOADING_SESSION_STATE);
  const resolveTokenRef = useRef(0);

  useEffect(() => {
    let isActive = true;
    let retryTimers: ReturnType<typeof setTimeout>[] = [];

    const clearRetryTimers = () => {
      retryTimers.forEach((timer) => clearTimeout(timer));
      retryTimers = [];
    };

    const complete = (token: number, nextState: TeamWorkspaceSessionState) => {
      if (!isActive || token !== resolveTokenRef.current) return;
      clearRetryTimers();
      resolveTokenRef.current += 1;
      setState(nextState);
    };

    const attemptResolve = async (token: number, attemptIndex: number, totalAttempts: number) => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!isActive || token !== resolveTokenRef.current) return;

        if (authError) {
          console.error('[useTeamWorkspaceAdminSession] auth.getUser failed:', authError);
          if (attemptIndex === totalAttempts - 1) {
            complete(token, { status: 'unauthorized', currentUser: null, reason: 'error' });
          }
          return;
        }

        if (!user) {
          if (attemptIndex === totalAttempts - 1) {
            complete(token, { status: 'unauthorized', currentUser: null, reason: 'no-session' });
          }
          return;
        }

        const access = await fetchAdminAccess();

        if (!isActive || token !== resolveTokenRef.current) return;

        if (access.isAdmin) {
          complete(token, {
            status: 'ready',
            currentUser: {
              id: access.userId || user.id,
              name: access.displayName || user.email?.split('@')[0] || 'Admin',
            },
          });
          return;
        }

        if (attemptIndex === totalAttempts - 1) {
          complete(token, { status: 'unauthorized', currentUser: null, reason: 'forbidden' });
        }
      } catch (error) {
        console.error('[useTeamWorkspaceAdminSession] session bootstrap failed:', error);
        if (attemptIndex === totalAttempts - 1) {
          complete(token, { status: 'unauthorized', currentUser: null, reason: 'error' });
        }
      }
    };

    const startResolution = (delays: readonly number[]) => {
      clearRetryTimers();
      const token = ++resolveTokenRef.current;
      setState(LOADING_SESSION_STATE);

      delays.forEach((delay, index) => {
        const runAttempt = () => {
          void attemptResolve(token, index, delays.length);
        };

        if (delay === 0) {
          runAttempt();
          return;
        }

        retryTimers.push(setTimeout(runAttempt, delay));
      });
    };

    startResolution(SESSION_RETRY_DELAYS_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;

      if (session?.user) {
        startResolution([0]);
        return;
      }

      if (event === 'SIGNED_OUT') {
        clearRetryTimers();
        resolveTokenRef.current += 1;
        setState({ status: 'unauthorized', currentUser: null, reason: 'no-session' });
      }
    });

    return () => {
      isActive = false;
      clearRetryTimers();
      subscription.unsubscribe();
    };
  }, [supabase]);

  return state;
}
