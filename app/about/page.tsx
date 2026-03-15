import AboutEditorialContent from './AboutEditorialContent';
import AboutImageLandingContent from './AboutImageLandingContent';
import { getAboutLandingSections } from './aboutLandingAssets';

import { getCurrentLocale } from '@/app/utils/locale';

export default async function AboutPage() {
  const locale = await getCurrentLocale();
  const sections = getAboutLandingSections(locale);

  if (sections.length > 0) {
    return <AboutImageLandingContent locale={locale} />;
  }

  return <AboutEditorialContent />;
}
