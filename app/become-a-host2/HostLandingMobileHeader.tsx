'use client';

import Image from 'next/image';
import Link from 'next/link';

import MobileLanguageSwitcher from '@/app/components/mobile/MobileLanguageSwitcher';
import { useLanguage } from '@/app/context/LanguageContext';

export default function HostLandingMobileHeader() {
  const { lang, t } = useLanguage();
  const homeHref = lang === 'ko' ? '/' : `/${lang}`;

  return (
    <header
      data-testid="host-landing-mobile-header"
      className="sticky top-0 z-[90] border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)] md:hidden"
    >
      <div className="grid h-14 grid-cols-[40px_minmax(0,1fr)_40px] items-center px-3">
        <Link
          data-testid="host-landing-mobile-home-link"
          href={homeHref}
          aria-label="Locally"
          className="flex h-10 w-10 items-center justify-center"
        >
          <Image
            src="/images/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-contain grayscale contrast-200 mix-blend-multiply"
          />
        </Link>

        <span
          aria-current="page"
          className="truncate px-2 text-center text-[13px] font-semibold text-slate-900"
        >
          {t('home_mobile_host_support_link')}
        </span>

        <div className="flex h-10 w-10 items-center justify-end">
          <MobileLanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
