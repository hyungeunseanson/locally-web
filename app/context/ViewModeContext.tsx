'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export type ViewMode = 'guest' | 'host';

interface ViewModeContextType {
  viewMode: ViewMode;
  isHostView: boolean;
  canUseHostView: boolean;
  setGuestView: () => void;
  setHostView: () => void;
}

const VIEW_MODE_STORAGE_KEY = 'locally_view_mode';
const VIEW_MODE_COOKIE_NAME = 'locally_view_mode';

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

function normalizeViewMode(value: string | null | undefined): ViewMode | null {
  if (value === 'guest' || value === 'host') {
    return value;
  }
  return null;
}

function persistViewMode(mode: ViewMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  document.cookie = `${VIEW_MODE_COOKIE_NAME}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

export function ViewModeProvider({
  children,
  initialViewMode = null,
}: {
  children: React.ReactNode;
  initialViewMode?: ViewMode | null;
}) {
  const pathname = usePathname();
  const { user, isHost, applicationStatus, hostStatusResolved } = useAuth();
  const [preferredViewMode, setPreferredViewMode] = useState<ViewMode>(() => {
    if (initialViewMode) {
      return initialViewMode;
    }

    if (typeof window !== 'undefined') {
      const storedViewMode = normalizeViewMode(localStorage.getItem(VIEW_MODE_STORAGE_KEY));
      if (storedViewMode) {
        return storedViewMode;
      }
    }

    return pathname?.startsWith('/host') ? 'host' : 'guest';
  });

  const canUseHostView = Boolean(user && hostStatusResolved && (isHost || applicationStatus));
  const viewMode = useMemo<ViewMode>(() => {
    if (!user) {
      return 'guest';
    }

    if (pathname?.startsWith('/host')) {
      if (!hostStatusResolved) {
        return 'host';
      }
      return canUseHostView ? 'host' : 'guest';
    }

    if (!hostStatusResolved) {
      return preferredViewMode;
    }

    return canUseHostView ? preferredViewMode : 'guest';
  }, [canUseHostView, hostStatusResolved, pathname, preferredViewMode, user]);

  useEffect(() => {
    persistViewMode(viewMode);
  }, [viewMode]);

  const setGuestView = useCallback(() => {
    setPreferredViewMode('guest');
    persistViewMode('guest');
  }, []);

  const setHostView = useCallback(() => {
    if (!canUseHostView) {
      return;
    }
    setPreferredViewMode('host');
    persistViewMode('host');
  }, [canUseHostView]);

  const value = useMemo<ViewModeContextType>(
    () => ({
      viewMode,
      isHostView: viewMode === 'host',
      canUseHostView,
      setGuestView,
      setHostView,
    }),
    [canUseHostView, setGuestView, setHostView, viewMode]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
