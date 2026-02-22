'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isHost: boolean;
  applicationStatus: string | null;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const supabase = createClient();

  const loadUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();

        const updatedUser = {
          ...session.user,
          user_metadata: {
            ...session.user.user_metadata,
            avatar_url: profile?.avatar_url || session.user.user_metadata.avatar_url
          }
        };
        setUser(updatedUser as User);
        await checkHostStatus(session.user.id);
      } else {
        setUser(null);
        setIsHost(false);
        setApplicationStatus(null);
      }
    } catch (error) {
      console.error('Auth Load Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkHostStatus = async (userId: string) => {
    const { data: app } = await supabase
      .from('host_applications')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (app) setApplicationStatus(app.status);

    const { count } = await supabase.from('experiences').select('*', { count: 'exact', head: true }).eq('host_id', userId);

    if ((app && (app.status === 'approved' || app.status === 'active')) || (count && count > 0)) {
      setIsHost(true);
    } else {
      setIsHost(false);
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setIsHost(false);
      setApplicationStatus(null);
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (error) {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    if (initialUser) {
      checkHostStatus(initialUser.id);
    } else {
      loadUser();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser();
      } else {
        setUser(null);
        setIsHost(false);
        setApplicationStatus(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, isHost, applicationStatus, isLoading, refreshAuth: loadUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
