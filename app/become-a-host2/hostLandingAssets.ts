import fs from 'node:fs';
import path from 'node:path';

export type HostLandingLocale = 'ko' | 'en' | 'ja' | 'zh';

type HostLandingDevice = 'desktop' | 'mobile';

type LocalizedAlt = Record<HostLandingLocale, string>;

type HostLandingSectionDefinition = {
  id: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  desktop: { width: number; height: number };
  mobile: { width: number; height: number };
  alt: LocalizedAlt;
};

const DEFAULT_HOST_LANDING_LOCALE: HostLandingLocale = 'ko';

const HOST_LANDING_SECTION_DEFINITIONS: HostLandingSectionDefinition[] = [
  {
    id: '1',
    desktop: { width: 2880, height: 1260 },
    mobile: { width: 1740, height: 1688 },
    alt: {
      ko: '로컬리 호스트 랜딩 메인 소개 이미지',
      en: 'Locally host landing hero image',
      ja: 'Locally ホストランディングのメイン紹介画像',
      zh: 'Locally 房东页主视觉图片',
    },
  },
  {
    id: '2',
    desktop: { width: 2880, height: 1434 },
    mobile: { width: 1740, height: 2394 },
    alt: {
      ko: '로컬리 호스트 활동 가치 소개 이미지',
      en: 'Locally host value introduction image',
      ja: 'Locally ホスト活動の価値紹介画像',
      zh: 'Locally 房东价值介绍图片',
    },
  },
  {
    id: '3',
    desktop: { width: 2880, height: 1156 },
    mobile: { width: 1740, height: 1156 },
    alt: {
      ko: '로컬리 호스트 경험 예시 소개 이미지',
      en: 'Locally host experience example image',
      ja: 'Locally ホスト体験の事例紹介画像',
      zh: 'Locally 房东体验示例图片',
    },
  },
  {
    id: '4',
    desktop: { width: 2880, height: 1296 },
    mobile: { width: 1740, height: 1296 },
    alt: {
      ko: '로컬리 호스트 운영 방식 안내 이미지',
      en: 'Locally host operations guide image',
      ja: 'Locally ホスト運営方法の案内画像',
      zh: 'Locally 房东运营方式说明图片',
    },
  },
  {
    id: '5',
    desktop: { width: 2880, height: 1542 },
    mobile: { width: 1740, height: 1542 },
    alt: {
      ko: '로컬리 호스트 지원 절차 소개 이미지',
      en: 'Locally host application process image',
      ja: 'Locally ホスト応募手順の紹介画像',
      zh: 'Locally 房东申请流程图片',
    },
  },
  {
    id: '6',
    desktop: { width: 2880, height: 1502 },
    mobile: { width: 1740, height: 1502 },
    alt: {
      ko: '로컬리 호스트 정산과 운영 기준 이미지',
      en: 'Locally host payout and policy image',
      ja: 'Locally ホスト精算と運営基準の画像',
      zh: 'Locally 房东结算与运营标准图片',
    },
  },
  {
    id: '7',
    desktop: { width: 2880, height: 2264 },
    mobile: { width: 1740, height: 2264 },
    alt: {
      ko: '로컬리 호스트 랜딩 마무리 안내 이미지',
      en: 'Locally host landing closing image',
      ja: 'Locally ホストランディングの締めくくり画像',
      zh: 'Locally 房东页结尾说明图片',
    },
  },
] as const;

function getHostLandingAssetPath(
  device: HostLandingDevice,
  locale: HostLandingLocale,
  fileName: string
) {
  const localizedRelativePath = `/images/become-a-host/${device}/${locale}/${fileName}`;
  const localizedAbsolutePath = path.join(process.cwd(), 'public', localizedRelativePath);

  if (fs.existsSync(localizedAbsolutePath)) {
    return localizedRelativePath;
  }

  return `/images/become-a-host/${device}/${DEFAULT_HOST_LANDING_LOCALE}/${fileName}`;
}

export function getHostLandingSections(locale: HostLandingLocale) {
  return HOST_LANDING_SECTION_DEFINITIONS.map((section) => ({
    alt: section.alt[locale],
    desktop: {
      ...section.desktop,
      src: getHostLandingAssetPath('desktop', locale, `${section.id}.png`),
    },
    mobile: {
      ...section.mobile,
      src: getHostLandingAssetPath('mobile', locale, `${section.id}.png`),
    },
  }));
}

export function getHostLandingOgImagePath(locale: HostLandingLocale) {
  return getHostLandingAssetPath('desktop', locale, '1.png');
}
