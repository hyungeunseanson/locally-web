'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { isAbortError } from '@/app/utils/errors';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isHost: boolean;
  applicationStatus: string | null;
  isLoading: boolean;
  hostStatusResolved: boolean;
  refreshAuth: () => Promise<void>;
  refreshHostStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_LOCAL_STORAGE_KEYS = [
  'admin_active_tab',
  'global_chat_last_viewed',
  'host_checked_reservations',
  'last_active_update',
  'locally_recent_searches',
] as const;

function normalizeApplicationStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  return normalized || null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialSessionResolved = false,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
  initialSessionResolved?: boolean;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isHost, setIsHost] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [hostStatusResolved, setHostStatusResolved] = useState(Boolean(initialSessionResolved && !initialUser));
  const supabase = useMemo(() => createClient(), []);

  const resolveHostStatus = useCallback(async (userId: string, options?: { indicateLoading?: boolean }) => {
    if (options?.indicateLoading ?? true) {
      setHostStatusResolved(false);
    }

    try {
      const { data: app } = await supabase
        .from('host_applications')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (app) {
        setApplicationStatus(app.status);
      } else {
        setApplicationStatus(null);
      }

      const normalizedStatus = normalizeApplicationStatus(app?.status);

      setIsHost(normalizedStatus === 'approved' || normalizedStatus === 'active');
    } finally {
      setHostStatusResolved(true);
    }
  }, [supabase]);

  const refreshHostStatus = useCallback(async () => {
    if (!user?.id) {
      setIsHost(false);
      setApplicationStatus(null);
      setHostStatusResolved(true);
      return;
    }

    try {
      await resolveHostStatus(user.id, { indicateLoading: false });
    } catch (error) {
      console.error('Host status refresh failed:', error);
      setHostStatusResolved(true);
    }
  }, [resolveHostStatus, user?.id]);

  const loadUser = useCallback(async () => {
    try {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', authUser.id)
          .maybeSingle();

        const updatedUser = {
          ...authUser,
          user_metadata: {
            ...authUser.user_metadata,
            avatar_url: profile?.avatar_url || authUser.user_metadata.avatar_url
          }
        };
        setUser(updatedUser as User);
        await resolveHostStatus(authUser.id, { indicateLoading: true });
      } else {
        setUser(null);
        setIsHost(false);
        setApplicationStatus(null);
        setHostStatusResolved(true);
      }
    } catch (error) {
      const isMissingSessionError =
        error instanceof Error &&
        (error.name === 'AuthSessionMissingError' || error.message.toLowerCase().includes('auth session missing'));

      if (isMissingSessionError) {
        setUser(null);
        setIsHost(false);
        setApplicationStatus(null);
        setHostStatusResolved(true);
      } else if (isAbortError(error)) {
        setHostStatusResolved(true);
      } else {
        console.error('Auth Load Error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [resolveHostStatus, supabase]);

  const signOut = async () => {
    try {
      setUser(null);
      setIsHost(false);
      setApplicationStatus(null);
      setHostStatusResolved(true);
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      AUTH_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      window.location.assign('/');
    }
  };

  useEffect(() => {
    if (initialUser) {
      void resolveHostStatus(initialUser.id, { indicateLoading: true });
    } else if (initialSessionResolved) {
      setUser(null);
      setIsHost(false);
      setApplicationStatus(null);
      setHostStatusResolved(true);
      setIsLoading(false);
    } else {
      setHostStatusResolved(true);
      void loadUser();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsHost(false);
        setApplicationStatus(null);
        setHostStatusResolved(true);
        setIsLoading(false);
      } else if (session?.user) {
        setUser(session.user as User);
        setIsLoading(true);
        setHostStatusResolved(false);
        void loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [initialSessionResolved, initialUser, loadUser, resolveHostStatus, supabase]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshHostStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshHostStatus, user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isHost,
        applicationStatus,
        isLoading,
        hostStatusResolved,
        refreshAuth: loadUser,
        refreshHostStatus,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
