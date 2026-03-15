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
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isHost: boolean;
  applicationStatus: string | null;
  isLoading: boolean;
  hostStatusResolved: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_LOCAL_STORAGE_KEYS = [
  'admin_active_tab',
  'global_chat_last_viewed',
  'host_checked_reservations',
  'last_active_update',
  'last_viewed_team',
  'locally_recent_searches',
  'viewed_booking_ids',
] as const;

export function AuthProvider({
  children,
  initialUser = null
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isHost, setIsHost] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialUser); // 🟢 만약 initialUser가 있으면 로딩 없이 즉시 렌더링
  const [hostStatusResolved, setHostStatusResolved] = useState(!initialUser);
  const supabase = useMemo(() => createClient(), []);

  const checkHostStatus = useCallback(async (userId: string) => {
    setHostStatusResolved(false);
    try {
      const { data: app } = await supabase
        .from('host_applications')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (app) setApplicationStatus(app.status);
      else setApplicationStatus(null);

      const { count } = await supabase
        .from('experiences')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', userId);

      if ((app && (app.status === 'approved' || app.status === 'active')) || (count && count > 0)) {
        setIsHost(true);
      } else {
        setIsHost(false);
      }
    } finally {
      setHostStatusResolved(true);
    }
  }, [supabase]);

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
        await checkHostStatus(authUser.id);
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
      } else {
        console.error('Auth Load Error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkHostStatus, supabase]);

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
        checkHostStatus(initialUser.id);
      } else {
        setHostStatusResolved(true);
        loadUser();
      }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser();
      } else {
        setUser(null);
        setIsHost(false);
        setApplicationStatus(null);
        setHostStatusResolved(true);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkHostStatus, initialUser, loadUser, supabase]);

  return (
    <AuthContext.Provider value={{ user, isHost, applicationStatus, isLoading, hostStatusResolved, refreshAuth: loadUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
