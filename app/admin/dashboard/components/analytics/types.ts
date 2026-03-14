export type SearchTrendItem = {
  keyword: string;
  count: number;
  percent: number;
};

export type SearchIntentItem = {
  keyword: string;
  searches: number;
  recentSearches: number;
  previousSearches: number;
  surge: number;
  matchedActiveExperiences: number;
  trackedSearches: number;
  clickConvertedSearches: number;
  paymentInitConvertedSearches: number;
  clickConversionRate: number;
  paymentInitConversionRate: number;
};

export type AnalyticsSearchIntentSummary = {
  totalSearches: number;
  comparisonWindowDays: number;
  windowClamped?: boolean;
  topKeywords: SearchIntentItem[];
  risingKeywords: SearchIntentItem[];
  lowSupplyKeywords: SearchIntentItem[];
  clickConversionKeywords: SearchIntentItem[];
  paymentInitConversionKeywords: SearchIntentItem[];
  sourceDemand: {
    name: string;
    searches: number;
    uniqueKeywords: number;
    topKeyword: string | null;
    topKeywordSearches: number;
    lowSupplyKeyword: string | null;
    lowSupplySearches: number;
  }[];
  supplyReference: string;
  conversionAvailable: boolean;
  conversionCoverage?: {
    trackedSearches: number;
    clickConvertedSearches: number;
    paymentInitConvertedSearches: number;
  };
  sourceDemandAvailable?: boolean;
  sourceTrackedSearches?: number;
};

export type SearchIntentSource = 'server' | 'cached' | 'unavailable';

export type CompositionBucket = {
  name: string;
  customers: number;
  percent: number;
};

export type SourceFunnelBucket = {
  name: string;
  signups: number;
  payingCustomers: number;
  conversionRate: number;
  revenue: number;
  repeatCustomers: number;
  repeatRate: number;
  topNationality: string | null;
  topLanguage: string | null;
};

export type AnalyticsCustomerCompositionSummary = {
  totalPayingCustomers: number;
  nationalityMix: CompositionBucket[];
  languageMix: CompositionBucket[];
  loyaltyMix: CompositionBucket[];
  purchaseMix: CompositionBucket[];
  sourceAvailable: boolean;
  sourceStatus?: 'ready' | 'collecting' | 'unavailable';
  sourceTrackedCustomers?: number;
  sourceSignupTrackedUsers?: number;
  sourceMix?: CompositionBucket[];
  sourceFunnel?: SourceFunnelBucket[];
};

export type CustomerCompositionSource = 'server' | 'cached' | 'unavailable';
