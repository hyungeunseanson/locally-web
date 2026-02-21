import React from 'react';
import { Metadata } from 'next';
import HomePageClient from '@/app/components/HomePageClient';
import { getCurrentLocale } from '@/app/utils/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  const titles: Record<string, string> = {
    ko: 'Locally - 현지인과 함께하는 진짜 로컬 여행',
    en: 'Locally - Real Local Experiences with Locals',
    ja: 'Locally - 現地の人と楽しむリアルなローカル旅行',
    zh: 'Locally - 与当地人一起体验真正的在地旅行'
  };

  const descriptions: Record<string, string> = {
    ko: '단순한 관광이 아닌, 현지인 친구와 함께하는 특별한 경험을 예약하세요.',
    en: 'Book special experiences with local friends, not just simple sightseeing.',
    ja: '単なる観光ではなく、現地の友達と一緒に特別な体験を予約しましょう。',
    zh: '不仅仅是观光，预订与当地朋友一起的特别体验。'
  };

  return {
    title: titles[locale] || titles.ko,
    description: descriptions[locale] || descriptions.ko,
    openGraph: {
      title: titles[locale] || titles.ko,
      description: descriptions[locale] || descriptions.ko,
      type: 'website',
    },
    alternates: {
      canonical: 'https://locally.vercel.app',
      languages: {
        'ko': 'https://locally.vercel.app',
        'en': 'https://locally.vercel.app/en',
        'ja': 'https://locally.vercel.app/ja',
        'zh': 'https://locally.vercel.app/zh',
      },
    }
  };
}

export default function Page() {
  return <HomePageClient />;
}
