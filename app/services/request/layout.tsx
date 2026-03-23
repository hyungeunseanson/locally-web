import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';

export const metadata = PRIVATE_NOINDEX_METADATA;

export default function ServiceRequestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
