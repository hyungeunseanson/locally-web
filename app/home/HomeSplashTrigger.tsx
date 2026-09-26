'use client';

import { useEffect } from 'react';
import { useSplash } from '@/app/context/SplashContext';

// Mounts with the streamed Home shell, before its public data has finished loading.
export default function HomeSplashTrigger() {
  const { showHomeSplash } = useSplash();

  useEffect(() => {
    showHomeSplash();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
