import {
  PRIVACY_POLICY,
  REFUND_POLICY,
  TERMS_OF_USE,
  TRAVEL_TERMS,
} from '@/app/constants/legalText';
import {
  PRIVACY_POLICY_EN,
  REFUND_POLICY_EN,
  TERMS_OF_USE_EN,
  TRAVEL_TERMS_EN,
} from '@/app/constants/legalText_en';
import {
  PRIVACY_POLICY_JA,
  REFUND_POLICY_JA,
  TERMS_OF_USE_JA,
  TRAVEL_TERMS_JA,
} from '@/app/constants/legalText_ja';
import {
  PRIVACY_POLICY_ZH,
  REFUND_POLICY_ZH,
  TERMS_OF_USE_ZH,
  TRAVEL_TERMS_ZH,
} from '@/app/constants/legalText_zh';

export type LegalLocale = 'ko' | 'en' | 'ja' | 'zh';
export type LegalDocType = 'terms' | 'privacy' | 'travel' | 'refund';

export type LegalDocument = {
  title: string;
  body: string;
  isFallback: boolean;
  fallbackNotice?: string;
};

const SUPPORTED_LOCALES: LegalLocale[] = ['ko', 'en', 'ja', 'zh'];

const normalizeLocale = (locale: string): LegalLocale => {
  return SUPPORTED_LOCALES.includes(locale as LegalLocale) ? (locale as LegalLocale) : 'ko';
};

const LEGAL_BODY_BY_TYPE: Record<LegalDocType, Record<LegalLocale, string>> = {
  terms: {
    ko: TERMS_OF_USE,
    en: TERMS_OF_USE_EN,
    ja: TERMS_OF_USE_JA,
    zh: TERMS_OF_USE_ZH,
  },
  privacy: {
    ko: PRIVACY_POLICY,
    en: PRIVACY_POLICY_EN,
    ja: PRIVACY_POLICY_JA,
    zh: PRIVACY_POLICY_ZH,
  },
  travel: {
    ko: TRAVEL_TERMS,
    en: TRAVEL_TERMS_EN,
    ja: TRAVEL_TERMS_JA,
    zh: TRAVEL_TERMS_ZH,
  },
  refund: {
    ko: REFUND_POLICY,
    en: REFUND_POLICY_EN,
    ja: REFUND_POLICY_JA,
    zh: REFUND_POLICY_ZH,
  },
};

const LEGAL_TITLE_BY_TYPE: Record<LegalDocType, Record<LegalLocale, string>> = {
  terms: {
    ko: '이용약관',
    en: 'Terms of Service',
    ja: '利用規約',
    zh: '服务条款',
  },
  privacy: {
    ko: '개인정보 처리방침',
    en: 'Privacy Policy',
    ja: 'プライバシーポリシー',
    zh: '隐私政策',
  },
  travel: {
    ko: '여행약관 (국내/국외)',
    en: 'Travel Terms (Domestic / International)',
    ja: '旅行約款（国内・海外）',
    zh: '旅游条款（国内/国际）',
  },
  refund: {
    ko: '취소 및 환불 정책',
    en: 'Cancellation and Refund Policy',
    ja: 'キャンセル・返金ポリシー',
    zh: '取消及退款政策',
  },
};

export function getLegalDocument(locale: string, type: LegalDocType): LegalDocument {
  const normalizedLocale = normalizeLocale(locale);

  return {
    title: LEGAL_TITLE_BY_TYPE[type][normalizedLocale],
    body: LEGAL_BODY_BY_TYPE[type][normalizedLocale],
    isFallback: false,
  };
}
