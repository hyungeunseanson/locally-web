'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type SplashContextType = {
  visible: boolean;
  showSplash: () => void;
  showHomeSplash: () => void;
  hideSplash: () => void;
};

const SplashContext = createContext<SplashContextType | null>(null);

export function SplashProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const homeSplashShown = useRef(false);
  const showSplash = useCallback(() => setVisible(true), []);
  const showHomeSplash = useCallback(() => {
    if (homeSplashShown.current) return;
    homeSplashShown.current = true;
    setVisible(true);
  }, []);
  const hideSplash = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!/^\/(?:ko|en|ja|zh)?\/?$/.test(pathname)) {
      homeSplashShown.current = false;
    }
  }, [pathname]);

  return (
    <SplashContext.Provider value={{ visible, showSplash, showHomeSplash, hideSplash }}>
      {children}
    </SplashContext.Provider>
  );
}

export function useSplash() {
  const ctx = useContext(SplashContext);
  if (!ctx) throw new Error('useSplash must be used within SplashProvider');
  return ctx;
}
