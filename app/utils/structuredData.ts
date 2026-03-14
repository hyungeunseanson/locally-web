import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

type ExperienceStructuredDataArgs = {
  id: string | number;
  locale: Locale;
  title: string;
  description?: string | null;
  imageUrl: string;
  price?: number | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  providerName?: string | null;
};

type ArticleStructuredDataArgs = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  authorName: string;
  datePublished: string;
  dateModified?: string | null;
  section?: string | null;
};

export function buildOrganizationJsonLd(locale: Locale) {
  const descriptions: Record<Locale, string> = {
    ko: '현지인 호스트와 여행자를 연결하는 로컬 체험 여행 플랫폼',
    en: 'A local travel platform that connects travelers with local hosts',
    ja: '現地ホストと旅行者をつなぐローカル体験旅行プラットフォーム',
    zh: '连接当地房东与旅行者的在地体验旅行平台',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Locally',
    url: buildAbsoluteUrl('/'),
    logo: buildAbsoluteUrl('/images/logo.png'),
    description: descriptions[locale],
  };
}

export function buildWebsiteJsonLd(locale: Locale) {
  const siteUrl = buildLocalizedAbsoluteUrl(locale);
  const searchUrl = buildLocalizedAbsoluteUrl(locale, '/search');

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Locally',
    url: siteUrl,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${searchUrl}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildExperienceProductJsonLd({
  id,
  locale,
  title,
  description,
  imageUrl,
  price,
  category,
  city,
  country,
  providerName,
}: ExperienceStructuredDataArgs) {
  const url = buildLocalizedAbsoluteUrl(locale, `/experiences/${id}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: description || undefined,
    image: [imageUrl],
    url,
    sku: `experience-${id}`,
    category: category || undefined,
    brand: {
      '@type': 'Brand',
      name: 'Locally',
    },
    provider: providerName
      ? {
          '@type': 'Person',
          name: providerName,
        }
      : undefined,
    areaServed: city
      ? {
          '@type': 'Place',
          name: country ? `${city}, ${country}` : city,
        }
      : undefined,
    offers:
      typeof price === 'number'
        ? {
            '@type': 'Offer',
            price: String(price),
            priceCurrency: 'KRW',
            availability: 'https://schema.org/InStock',
            url,
          }
        : undefined,
  };
}

export function buildCommunityArticleJsonLd({
  title,
  description,
  url,
  imageUrl,
  authorName,
  datePublished,
  dateModified,
  section,
}: ArticleStructuredDataArgs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: [imageUrl],
    url,
    mainEntityOfPage: url,
    articleSection: section || undefined,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Locally',
      logo: {
        '@type': 'ImageObject',
        url: buildAbsoluteUrl('/images/logo.png'),
      },
    },
  };
}
