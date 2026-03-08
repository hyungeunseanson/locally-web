import {
  PRIVACY_POLICY,
  REFUND_POLICY,
  TERMS_OF_USE,
  TRAVEL_TERMS,
} from '@/app/constants/legalText';

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

const LEGAL_BODY_BY_TYPE: Record<LegalDocType, string> = {
  terms: TERMS_OF_USE,
  privacy: PRIVACY_POLICY,
  travel: TRAVEL_TERMS,
  refund: REFUND_POLICY,
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

const LEGAL_FALLBACK_NOTICE: Record<Exclude<LegalLocale, 'ko'>, string> = {
  en: 'The reviewed translation is not published yet. The Korean original below currently applies.',
  ja: '確認済みの翻訳はまだ公開されていません。現在は以下の韓国語原文が適用されます。',
  zh: '已审核译文尚未发布，目前以下韩文原文适用。',
};

export function getLegalDocument(locale: string, type: LegalDocType): LegalDocument {
  const normalizedLocale = normalizeLocale(locale);
  const isFallback = normalizedLocale !== 'ko';

  return {
    title: LEGAL_TITLE_BY_TYPE[type][normalizedLocale],
    body: LEGAL_BODY_BY_TYPE[type],
    isFallback,
    fallbackNotice: isFallback ? LEGAL_FALLBACK_NOTICE[normalizedLocale] : undefined,
  };
}
