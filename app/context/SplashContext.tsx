'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type SplashContextType = {
  visible: boolean;
  showSplash: () => void;
  hideSplash: () => void;
};

const SplashContext = createContext<SplashContextType | null>(null);

export function SplashProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const showSplash = useCallback(() => setVisible(true), []);
  const hideSplash = useCallback(() => setVisible(false), []);

  return (
    <SplashContext.Provider value={{ visible, showSplash, hideSplash }}>
      {children}
    </SplashContext.Provider>
  );
}

export function useSplash() {
  const ctx = useContext(SplashContext);
  if (!ctx) throw new Error('useSplash must be used within SplashProvider');
  return ctx;
}
