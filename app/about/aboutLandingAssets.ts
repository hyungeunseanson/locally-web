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

function getSortKey(fileName: string) {
  const match = fileName.match(/^(\d+)/);
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

function buildResolvedImageMap(device: AboutLandingDevice, locale: AboutLandingLocale) {
  const localized = readImageFileMap(device, locale);
  if (locale === DEFAULT_LOCALE) {
    return localized;
  }

  const fallback = readImageFileMap(device, DEFAULT_LOCALE);
  const resolved = new Map(fallback);
  for (const [baseName, fileName] of localized.entries()) {
    resolved.set(baseName, fileName);
  }
  return resolved;
}

function getResolvedImagePath(
  device: AboutLandingDevice,
  locale: AboutLandingLocale,
  baseName: string
) {
  const localized = readImageFileMap(device, locale).get(baseName);
  if (localized) {
    return toPublicPath(device, locale, localized);
  }

  const fallback = readImageFileMap(device, DEFAULT_LOCALE).get(baseName);
  if (fallback) {
    return toPublicPath(device, DEFAULT_LOCALE, fallback);
  }

  return null;
}

export function getAboutLandingSections(locale: AboutLandingLocale): AboutLandingSection[] {
  const desktopMap = buildResolvedImageMap('desktop', locale);
  const mobileMap = buildResolvedImageMap('mobile', locale);

  const commonBaseNames = Array.from(desktopMap.keys())
    .filter((baseName) => mobileMap.has(baseName))
    .sort((left, right) => getSortKey(left) - getSortKey(right) || left.localeCompare(right));

  return commonBaseNames
    .map((baseName) => {
      const desktopSrc = getResolvedImagePath('desktop', locale, baseName);
      const mobileSrc = getResolvedImagePath('mobile', locale, baseName);

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
