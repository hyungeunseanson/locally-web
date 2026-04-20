import AboutEditorialContent from './AboutEditorialContent';
import AboutImageLandingContent from './AboutImageLandingContent';
import { hasCompleteAboutLandingLocale } from './aboutLandingAssets';

import { getCurrentLocale } from '@/app/utils/locale';

export default async function AboutPage() {
  const locale = await getCurrentLocale();

  if (hasCompleteAboutLandingLocale(locale)) {
    return <AboutImageLandingContent locale={locale} />;
  }

  return <AboutEditorialContent />;
}
