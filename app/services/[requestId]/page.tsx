import type { Metadata } from 'next';

import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';
import ServiceRequestClient from './ServiceRequestClient';

export const metadata: Metadata = {
  ...PRIVATE_NOINDEX_METADATA,
  title: '맞춤 동행·통역 신청 | Locally',
};

export default function ServiceRequestPage() {
  return <ServiceRequestClient />;
}
