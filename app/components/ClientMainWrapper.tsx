'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import PageTransition from './ui/PageTransition';
import { useViewMode } from '@/app/context/ViewModeContext';
import { shouldHideMobileBottomTab } from '@/app/components/mobile/bottomTabVisibility';

export default function ClientMainWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isHostView } = useViewMode();
  const reserveBottomTabSpace = !shouldHideMobileBottomTab(pathname, isHostView);

  return (
    <main className={`flex-1 ${reserveBottomTabSpace ? 'pb-20 md:pb-0' : ''}`}>
      <PageTransition>
        {children}
      </PageTransition>
    </main>
  );
}
