import type { ReactNode } from 'react';

import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';

export const metadata = PRIVATE_NOINDEX_METADATA;

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return children;
}
