/* eslint-disable @next/next/no-img-element */
import SiteHeader from '@/app/components/SiteHeader';

import { type AboutLandingLocale, getAboutLandingSections } from './aboutLandingAssets';

type AboutImageLandingContentProps = {
  locale: AboutLandingLocale;
};

export default function AboutImageLandingContent({
  locale,
}: AboutImageLandingContentProps) {
  const sections = getAboutLandingSections(locale);

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans">
      <SiteHeader />

      <main>
        <div className="mx-auto w-full max-w-[1440px]">
          {sections.map((section, index) => (
            <div key={section.id}>
              <div className="md:hidden">
                <img
                  src={section.mobile.src}
                  alt={section.alt}
                  className="block h-auto w-full"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
              <div className="hidden md:block">
                <img
                  src={section.desktop.src}
                  alt={section.alt}
                  className="block h-auto w-full"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
