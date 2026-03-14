import type { Metadata } from 'next';

import BecomeHostLandingContent from '@/app/become-a-host2/BecomeHostLandingContent';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

const TITLE_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '호스트 되기',
  en: 'Become a Host',
  ja: 'ホストになる',
  zh: '成为房东',
};

const DESCRIPTION_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '당신의 동네와 취향을 여행으로 연결하세요. Locally 호스트 지원 절차와 운영 기준을 확인해보세요.',
  en: 'Turn your neighborhood and personal taste into a travel experience. Explore how to become a Locally host.',
  ja: 'あなたの街と感性を旅の体験に変えてみませんか。Locallyホストの応募手順と運営基準をご確認ください。',
  zh: '把你的街区与个人品味变成旅行体验。了解如何成为 Locally 房东以及运营标准。',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const pageUrl = buildLocalizedAbsoluteUrl(locale, '/become-a-host');
  const title = TITLE_MAP[locale];
  const description = DESCRIPTION_MAP[locale];
  const ogImage = buildAbsoluteUrl('/images/become-a-host/desktop/ko/1.png');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      images: [{ url: ogImage, width: 2880, height: 1260, alt: 'Locally host landing hero image' }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', '/become-a-host'),
        en: buildLocalizedAbsoluteUrl('en', '/become-a-host'),
        ja: buildLocalizedAbsoluteUrl('ja', '/become-a-host'),
        zh: buildLocalizedAbsoluteUrl('zh', '/become-a-host'),
      },
    },
  };
}

export default function BecomeHostPage() {
  return <BecomeHostLandingContent />;
}
