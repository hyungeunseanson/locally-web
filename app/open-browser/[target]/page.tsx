import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import ExternalBrowserHandoff from './ExternalBrowserHandoff';
import {
  buildAndroidChromeIntentUrl,
  buildExternalBrowserDestination,
  isAndroidUserAgent,
  isExternalBrowserTarget,
  isMetaInAppBrowser,
} from '@/app/utils/externalBrowserHandoff';
import { getCurrentLocale } from '@/app/utils/locale';
import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';
import { getSiteUrl } from '@/app/utils/siteUrl';

type Props = {
  params: Promise<{ target: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata = PRIVATE_NOINDEX_METADATA;

export default async function OpenBrowserPage({ params }: Props) {
  const { target } = await params;
  if (!isExternalBrowserTarget(target)) {
    notFound();
  }

  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') || '';
  const destinationUrl = buildExternalBrowserDestination(getSiteUrl(), target);

  if (!isMetaInAppBrowser(userAgent)) {
    redirect(destinationUrl);
  }

  const locale = await getCurrentLocale();
  const androidIntentUrl = isAndroidUserAgent(userAgent)
    ? buildAndroidChromeIntentUrl(destinationUrl)
    : null;

  return (
    <ExternalBrowserHandoff
      androidIntentUrl={androidIntentUrl}
      destinationUrl={destinationUrl}
      locale={locale}
    />
  );
}
