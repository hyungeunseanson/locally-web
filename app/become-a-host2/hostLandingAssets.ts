export type HostLandingLocale = 'ko' | 'en' | 'ja' | 'zh';

type HostLandingDevice = 'desktop' | 'mobile';

type LocalizedAlt = Record<HostLandingLocale, string>;

type HostLandingSectionDefinition = {
  id: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  desktop: { width: number; height: number };
  mobile: { width: number; height: number };
  alt: LocalizedAlt;
};

type HostLandingSectionId = HostLandingSectionDefinition['id'];
type HostLandingExtension = '.webp' | '.png';

const DESKTOP_EXTENSIONS: Record<HostLandingSectionId, HostLandingExtension> = {
  '1': '.png',
  '2': '.webp',
  '3': '.png',
  '4': '.png',
  '5': '.webp',
  '6': '.png',
  '7': '.png',
};

const MOBILE_EXTENSIONS_WITH_WEBP_SECTION_FIVE: Record<HostLandingSectionId, HostLandingExtension> = {
  ...DESKTOP_EXTENSIONS,
};

const MOBILE_EXTENSIONS_WITH_PNG_SECTION_FIVE: Record<HostLandingSectionId, HostLandingExtension> = {
  ...DESKTOP_EXTENSIONS,
  '5': '.png',
};

// These paths are build artifacts, not runtime filesystem discoveries. The contract
// suite checks this manifest against public/ before either deployment path is used.
const HOST_LANDING_ASSET_EXTENSIONS: Record<
  HostLandingLocale,
  Record<HostLandingDevice, Record<HostLandingSectionId, HostLandingExtension>>
> = {
  ko: { desktop: DESKTOP_EXTENSIONS, mobile: MOBILE_EXTENSIONS_WITH_PNG_SECTION_FIVE },
  en: { desktop: DESKTOP_EXTENSIONS, mobile: MOBILE_EXTENSIONS_WITH_WEBP_SECTION_FIVE },
  ja: { desktop: DESKTOP_EXTENSIONS, mobile: MOBILE_EXTENSIONS_WITH_WEBP_SECTION_FIVE },
  zh: { desktop: DESKTOP_EXTENSIONS, mobile: MOBILE_EXTENSIONS_WITH_PNG_SECTION_FIVE },
};

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
  baseName: HostLandingSectionId
) {
  const extension = HOST_LANDING_ASSET_EXTENSIONS[locale][device][baseName];
  return `/images/become-a-host/${device}/${locale}/${baseName}${extension}`;
}

export function getHostLandingSections(locale: HostLandingLocale) {
  return HOST_LANDING_SECTION_DEFINITIONS.map((section) => ({
    alt: section.alt[locale],
    desktop: {
      ...section.desktop,
      src: getHostLandingAssetPath('desktop', locale, section.id),
    },
    mobile: {
      ...section.mobile,
      src: getHostLandingAssetPath('mobile', locale, section.id),
    },
  }));
}

export function getHostLandingOgImagePath(locale: HostLandingLocale) {
  return getHostLandingAssetPath('desktop', locale, '1');
}
