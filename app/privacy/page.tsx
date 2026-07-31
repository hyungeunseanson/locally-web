import type { Metadata } from 'next';

import SiteHeader from '@/app/components/SiteHeader';
import { getLegalDocument } from '@/app/constants/legalDocuments';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '개인정보 처리방침',
  en: 'Privacy Policy',
  ja: 'プライバシーポリシー',
  zh: '隐私政策',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally의 개인정보 처리와 쿠키 및 광고 설정에 관한 안내입니다.',
  en: 'Learn how Locally handles personal information, cookies, and advertising choices.',
  ja: 'Locallyの個人情報、Cookie、広告設定の取り扱いについてご案内します。',
  zh: '了解 Locally 如何处理个人信息、Cookie 和广告选择。',
} as const;

const CHOICE_LINK_COPY = {
  ko: {
    heading: '광고 및 개인정보 선택',
    ads: 'Google 광고 설정',
    privacy: 'Google 개인정보 보호 및 약관',
  },
  en: {
    heading: 'Advertising and privacy choices',
    ads: 'Google Ads Settings',
    privacy: 'Google Privacy & Terms',
  },
  ja: {
    heading: '広告とプライバシーの選択',
    ads: 'Google 広告設定',
    privacy: 'Google プライバシーと利用規約',
  },
  zh: {
    heading: '广告和隐私选择',
    ads: 'Google 广告设置',
    privacy: 'Google 隐私权与条款',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/privacy',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default async function PrivacyPage() {
  const locale = await getCurrentLocale();
  const document = getLegalDocument(locale, 'privacy');
  const linkCopy = CHOICE_LINK_COPY[locale];

  return (
    <div className="min-h-screen bg-white text-[#222222]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[960px] px-5 py-16 md:px-10 md:py-24">
        <h1 className="text-3xl font-bold md:text-4xl">{document.title}</h1>
        <div
          data-testid="privacy-policy-body"
          className="mt-10 whitespace-pre-wrap break-words text-sm font-light leading-7 text-[#484848] md:text-[15px]"
        >
          {document.body}
        </div>

        <section className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-bold">{linkCopy.heading}</h2>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm">
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              {linkCopy.ads}
            </a>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              {linkCopy.privacy}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
