'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function ClientMainWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  return (
    <main className={`flex-1 ${isAdmin ? '' : 'pb-20 md:pb-0'}`}>
      {children}
    </main>
  );
}
