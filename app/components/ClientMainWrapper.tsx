'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import PageTransition from './ui/PageTransition';

export default function ClientMainWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const isImmersiveHostLanding = pathname?.startsWith('/become-a-host2');

  return (
    <main className={`flex-1 ${isAdmin || isImmersiveHostLanding ? '' : 'pb-20 md:pb-0'}`}>
      <PageTransition>
        {children}
      </PageTransition>
    </main>
  );
}
