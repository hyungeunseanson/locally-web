'use client';

import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";

import SiteHeader from "@/app/components/SiteHeader";
import { useLanguage } from "@/app/context/LanguageContext";

import HostLandingActionBar from "./HostLandingActionBar";

type HostLandingLocale = "ko" | "en" | "ja" | "zh";

type LandingImage = {
  src: string;
  width: number;
  height: number;
};

type LandingSection = {
  alt: string;
  desktop: LandingImage;
  mobile: LandingImage;
};

type FaqItem = {
  question: string;
  answer: string;
};

type FaqGroup = {
  title: string;
  items: FaqItem[];
};

type FaqContent = {
  sectionTitle: string;
  groups: FaqGroup[];
};

export type HostLandingContentByLocale = Record<
  HostLandingLocale,
  {
    sections: LandingSection[];
    faq: FaqContent;
  }
>;

type BecomeHostLandingContentClientProps = {
  initialLocale: HostLandingLocale;
  contentByLocale: HostLandingContentByLocale;
};

const TITLE_MAP: Record<HostLandingLocale, string> = {
  ko: "호스트 되기",
  en: "Become a Host",
  ja: "ホストになる",
  zh: "成为房东",
};

function isHostLandingLocale(value: string): value is HostLandingLocale {
  return value === "ko" || value === "en" || value === "ja" || value === "zh";
}

function LandingSectionImage({
  desktop,
  mobile,
  alt,
  priority = false,
}: {
  desktop: LandingImage;
  mobile: LandingImage;
  alt: string;
  priority?: boolean;
}) {
  return (
    <>
      <div className="md:hidden">
        <Image
          src={mobile.src}
          alt={alt}
          width={mobile.width}
          height={mobile.height}
          className="block h-auto w-full"
          priority={priority}
          sizes="100vw"
          unoptimized
        />
      </div>
      <div className="hidden md:block">
        <Image
          src={desktop.src}
          alt={alt}
          width={desktop.width}
          height={desktop.height}
          className="block h-auto w-full"
          priority={priority}
          sizes="(max-width: 1440px) 100vw, 1440px"
          unoptimized
        />
      </div>
    </>
  );
}

function renderSection(section: LandingSection, priority = false) {
  return (
    <LandingSectionImage
      key={section.alt}
      desktop={section.desktop}
      mobile={section.mobile}
      alt={section.alt}
      priority={priority}
    />
  );
}

export default function BecomeHostLandingContentClient({
  initialLocale,
  contentByLocale,
}: BecomeHostLandingContentClientProps) {
  const { lang } = useLanguage();
  const resolvedLocale = isHostLandingLocale(lang) ? lang : initialLocale;
  const localizedContent =
    contentByLocale[resolvedLocale] ?? contentByLocale[initialLocale];
  const [heroSection, secondSection, ...remainingSections] =
    localizedContent.sections;

  useEffect(() => {
    const nextTitle = `${TITLE_MAP[resolvedLocale]} | Locally`;
    const syncTitle = () => {
      if (document.title !== nextTitle) {
        document.title = nextTitle;
      }
    };

    syncTitle();
    const timeoutIds = [
      window.setTimeout(syncTitle, 0),
      window.setTimeout(syncTitle, 100),
      window.setTimeout(syncTitle, 400),
    ];

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [resolvedLocale]);

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans">
      <SiteHeader />

      <main>
        <div className="mx-auto w-full max-w-[1440px]">
          {renderSection(heroSection, true)}

          <HostLandingActionBar compact />

          {renderSection(secondSection, true)}

          {remainingSections.map((section) => renderSection(section))}
        </div>

        <HostLandingActionBar />

        <section className="bg-white px-[7px] py-12 md:px-6 md:py-24">
          <div className="mx-auto max-w-[1440px]">
            <div className="mx-auto max-w-[760px] md:max-w-[790px]">
              <h2 className="text-center text-[24px] font-semibold tracking-[-0.04em] text-[#2f2f2f] md:text-[54px]">
                {localizedContent.faq.sectionTitle}
              </h2>

              <div className="mt-7 border-t border-black/8 md:mt-14">
                {localizedContent.faq.groups.map((group, index) => (
                  <details
                    key={group.title}
                    className="group border-b border-black/8"
                    open={index === 0}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left md:gap-6 md:py-7 [&::-webkit-details-marker]:hidden">
                      <h3 className="text-[18px] font-medium tracking-[-0.03em] text-[#2f2f2f] md:text-[30px]">
                        {group.title}
                      </h3>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#4b4b4b] transition-transform duration-200 group-open:rotate-180 md:h-6 md:w-6" />
                    </summary>

                    <div className="space-y-5 pb-5 pr-0 text-[#757575] md:space-y-10 md:pb-9">
                      {group.items.map((item) => (
                        <div key={item.question}>
                          <h4 className="text-[14px] font-medium leading-snug text-[#4a4a4a] md:text-[21px]">
                            {item.question}
                          </h4>
                          <p className="mt-2 text-[12px] leading-6 md:mt-3 md:text-[16px] md:leading-[1.8]">
                            {item.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
