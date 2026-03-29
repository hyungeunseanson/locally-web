import { HOST_LANDING_FAQ } from "./hostLandingFaq";
import BecomeHostLandingContentClient, {
  type HostLandingContentByLocale,
} from "./BecomeHostLandingContentClient";
import {
  getHostLandingSections,
  type HostLandingLocale,
} from "./hostLandingAssets";

type BecomeHostLandingContentProps = {
  locale: HostLandingLocale;
};

const SUPPORTED_LOCALES: HostLandingLocale[] = ["ko", "en", "ja", "zh"];

export default function BecomeHostLandingContent({
  locale,
}: BecomeHostLandingContentProps) {
  const contentByLocale = Object.fromEntries(
    SUPPORTED_LOCALES.map((localizedLocale) => [
      localizedLocale,
      {
        sections: getHostLandingSections(localizedLocale),
        faq: HOST_LANDING_FAQ[localizedLocale],
      },
    ])
  ) as HostLandingContentByLocale;

  return (
    <BecomeHostLandingContentClient
      initialLocale={locale}
      contentByLocale={contentByLocale}
    />
  );
}
