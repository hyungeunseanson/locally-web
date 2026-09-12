export type AboutLandingLocale = 'ko' | 'en' | 'ja' | 'zh';

type AboutLandingDevice = 'desktop' | 'mobile';

type AboutLandingSection = {
  id: string;
  alt: string;
  desktop: { src: string };
  mobile: { src: string };
};

type AboutLandingAssetManifest = Partial<
  Record<AboutLandingLocale, Record<AboutLandingDevice, readonly string[]>>
>;

// Keep the runtime Worker independent from a writable/readable project filesystem.
// A contract test verifies that every committed manifest entry exists in public/.
const ABOUT_LANDING_ASSETS: AboutLandingAssetManifest = {
  ko: {
    desktop: ['1.png', '2.webp', '3.png', '4.png', '5.png', '6.webp', '7.png', '8.png'],
    mobile: ['1.png', '2.webp', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png'],
  },
  ja: {
    desktop: ['1.png', '2.webp', '3.png', '4.png', '5.png', '6.webp', '7.png', '8.png'],
    mobile: ['1.png', '2.webp', '3.png', '4.png', '5.png', '6.webp', '7.png', '8.png'],
  },
};

const ALT_PREFIX: Record<AboutLandingLocale, string> = {
  ko: '로컬리 소개 랜딩 이미지',
  en: 'About Locally landing image',
  ja: 'Locally紹介ランディング画像',
  zh: 'Locally 介绍页图片',
};

function toPublicPath(device: AboutLandingDevice, locale: AboutLandingLocale, fileName: string) {
  return `/images/about/${device}/${locale}/${fileName}`;
}

function getSortKey(baseName: string) {
  const match = baseName.match(/^(\d+)/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number.parseInt(match[1], 10);
}

function readImageFileMap(device: AboutLandingDevice, locale: AboutLandingLocale) {
  const files = ABOUT_LANDING_ASSETS[locale]?.[device] ?? [];
  return new Map(files.map((fileName) => [fileName.replace(/\.[^.]+$/, ''), fileName]));
}

function getSortedBaseNames(fileMap: Map<string, string>) {
  return Array.from(fileMap.keys()).sort(
    (left, right) => getSortKey(left) - getSortKey(right) || left.localeCompare(right)
  );
}

function haveSameBaseNameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((baseName, index) => baseName === right[index]);
}

function getRequiredBaseNames() {
  const defaultDesktopBaseNames = getSortedBaseNames(readImageFileMap('desktop', 'ko'));
  const defaultMobileBaseNames = getSortedBaseNames(readImageFileMap('mobile', 'ko'));

  if (!haveSameBaseNameSet(defaultDesktopBaseNames, defaultMobileBaseNames)) {
    return [];
  }

  return defaultDesktopBaseNames;
}

function getLocalizedImagePath(
  device: AboutLandingDevice,
  locale: AboutLandingLocale,
  baseName: string
) {
  const localized = readImageFileMap(device, locale).get(baseName);
  if (localized) {
    return toPublicPath(device, locale, localized);
  }

  return null;
}

export function hasCompleteAboutLandingLocale(locale: AboutLandingLocale) {
  const requiredBaseNames = getRequiredBaseNames();

  if (requiredBaseNames.length === 0) {
    return false;
  }

  const localizedDesktopBaseNames = getSortedBaseNames(readImageFileMap('desktop', locale));
  const localizedMobileBaseNames = getSortedBaseNames(readImageFileMap('mobile', locale));

  return (
    haveSameBaseNameSet(localizedDesktopBaseNames, requiredBaseNames) &&
    haveSameBaseNameSet(localizedMobileBaseNames, requiredBaseNames)
  );
}

export function getAboutLandingSections(locale: AboutLandingLocale): AboutLandingSection[] {
  if (!hasCompleteAboutLandingLocale(locale)) {
    return [];
  }

  const requiredBaseNames = getRequiredBaseNames();

  return requiredBaseNames
    .map((baseName) => {
      const desktopSrc = getLocalizedImagePath('desktop', locale, baseName);
      const mobileSrc = getLocalizedImagePath('mobile', locale, baseName);

      if (!desktopSrc || !mobileSrc) {
        return null;
      }

      return {
        id: baseName,
        alt: `${ALT_PREFIX[locale]} ${baseName}`,
        desktop: { src: desktopSrc },
        mobile: { src: mobileSrc },
      };
    })
    .filter((section): section is AboutLandingSection => Boolean(section));
}

export function getAboutLandingOgImagePath(locale: AboutLandingLocale) {
  const sections = getAboutLandingSections(locale);
  return sections[0]?.desktop.src ?? null;
}
