import fs from 'node:fs';
import path from 'node:path';

export type AboutLandingLocale = 'ko' | 'en' | 'ja' | 'zh';

type AboutLandingDevice = 'desktop' | 'mobile';

type AboutLandingSection = {
  id: string;
  alt: string;
  desktop: { src: string };
  mobile: { src: string };
};

const DEFAULT_LOCALE: AboutLandingLocale = 'ko';
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

const ALT_PREFIX: Record<AboutLandingLocale, string> = {
  ko: '로컬리 소개 랜딩 이미지',
  en: 'About Locally landing image',
  ja: 'Locally紹介ランディング画像',
  zh: 'Locally 介绍页图片',
};

function getPublicDir(device: AboutLandingDevice, locale: AboutLandingLocale) {
  return path.join(process.cwd(), 'public', 'images', 'about', device, locale);
}

function toPublicPath(device: AboutLandingDevice, locale: AboutLandingLocale, fileName: string) {
  return `/images/about/${device}/${locale}/${fileName}`;
}

function isSupportedImage(fileName: string) {
  return SUPPORTED_EXTENSIONS.includes(path.extname(fileName).toLowerCase() as (typeof SUPPORTED_EXTENSIONS)[number]);
}

function getSortKey(baseName: string) {
  const match = baseName.match(/^(\d+)/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number.parseInt(match[1], 10);
}

function readImageFileMap(device: AboutLandingDevice, locale: AboutLandingLocale) {
  const dir = getPublicDir(device, locale);
  const fileMap = new Map<string, string>();

  if (!fs.existsSync(dir)) {
    return fileMap;
  }

  for (const fileName of fs.readdirSync(dir)) {
    if (!isSupportedImage(fileName)) continue;
    const baseName = path.parse(fileName).name;
    fileMap.set(baseName, fileName);
  }

  return fileMap;
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
  const defaultDesktopBaseNames = getSortedBaseNames(readImageFileMap('desktop', DEFAULT_LOCALE));
  const defaultMobileBaseNames = getSortedBaseNames(readImageFileMap('mobile', DEFAULT_LOCALE));

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
