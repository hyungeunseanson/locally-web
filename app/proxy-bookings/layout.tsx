import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';

export const metadata = PRIVATE_NOINDEX_METADATA;

export default function ProxyBookingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
