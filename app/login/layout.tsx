import type { Metadata } from 'next';
import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';

export const metadata: Metadata = {
  title: '로그인',
  description: 'Locally 계정으로 로그인하세요.',
  robots: PRIVATE_NOINDEX_METADATA.robots,
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
