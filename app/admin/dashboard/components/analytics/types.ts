export type SummarySource = 'server' | 'cached' | 'fallback';
export type AnalyticsMainTab = 'business' | 'host' | 'reviews' | 'logs';

export type AnalyticsBookingInput = {
  created_at?: string | null;
  status?: string | null;
  amount?: number | string | null;
  user_id?: string | null;
  experience_id?: string | null;
};

export type AnalyticsUserInput = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  nationality?: string | null;
  age?: number | string | null;
  birth_year?: number | string | null;
  gender?: string | null;
};

export type AnalyticsExperienceInput = {
  id?: string | null;
  host_id?: string | null;
  title?: string | null;
  image_url?: string | null;
  status?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type AnalyticsApplicationInput = {
  created_at?: string | null;
  status?: string | null;
  source?: string | null;
  host_nationality?: string | null;
  languages?: string[] | string | null;
};

export type AnalyticsReviewInput = {
  created_at?: string | null;
  experience_id?: string | null;
  rating?: number | null;
};

export type AnalyticsSearchLogInput = {
  created_at?: string | null;
  keyword?: string | null;
};

export type AnalyticsEventInput = {
  created_at?: string | null;
  event_type?: string | null;
};

export type AnalyticsInquiryInput = {
  id?: string | null;
  host_id?: string | null;
  created_at?: string | null;
};

export type AnalyticsInquiryMessageInput = {
  inquiry_id?: string | null;
  sender_id?: string | null;
  created_at?: string | null;
};

export type AnalyticsBucket = {
  name: string;
  count: number;
  percent: number;
};

export type AnalyticsHostCandidate = {
  id: string;
  name: string;
  email?: string | null;
  bookings: number;
  cancelCount: number;
  rating: string;
};

export type AnalyticsResponseHost = {
  id: string;
  name: string;
  rate: number;
  timeMins: number;
  total: number;
};

export type AnalyticsTimeSeriesPoint = {
  dateStr: string;
  amount: number;
  height: number;
};

export type AnalyticsExperienceSummary = AnalyticsExperienceInput & {
  bookingCount: number;
  totalRevenue: number;
  rating: string;
  reviewCount: number;
};

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
export type AnalyticsSummarySources = {
  business: SummarySource;
  host: SummarySource;
};

export type CompositionBucket = {
  name: string;
  customers: number;
  percent: number;
};

export type AnalyticsHostEcosystem = {
  sources: AnalyticsBucket[];
  languages: AnalyticsBucket[];
  nationalities: AnalyticsBucket[];
  allSources: AnalyticsBucket[];
  allLanguages: AnalyticsBucket[];
  allNationalities: AnalyticsBucket[];
  funnel: { applied: number; approved: number; active: number; booked: number };
};

export type AnalyticsBusinessSummary = {
  totalUsers: number;
  activeExpsCount: number;
  gmv: number;
  netRevenue: number;
  hostPayout: number;
  conversionRate: string;
  retentionRate: string;
  aov: number;
  cancellationRate: number;
  topExperiences: AnalyticsExperienceSummary[];
  allExperiences: AnalyticsExperienceSummary[];
  funnel: { views: number; clicks: number; paymentInit: number; completed: number };
  cancelBreakdown: { user: number; host: number };
  priceDistribution: { low: number; mid: number; high: number };
  demographics: {
    nationalities: AnalyticsBucket[];
    ages: AnalyticsBucket[];
    genders: AnalyticsBucket[];
    allNationalities: AnalyticsBucket[];
  };
  searchTrends: SearchTrendItem[];
  allSearchTrends: SearchTrendItem[];
  timeSeries: AnalyticsTimeSeriesPoint[];
  newUsersList: AnalyticsUserInput[];
  topRevenueDate: { dateStr: string; amount: number };
  expsBreakdown: { new: number; active: number; pending: number; rejected: number };
  retentionBreakdown: { once: number; twice: number; threeOrMore: number };
};

export type AnalyticsHostSummary = {
  superHostCandidates: AnalyticsHostCandidate[];
  riskHosts: AnalyticsHostCandidate[];
  hostEcosystem: AnalyticsHostEcosystem;
  avgResponseTime: number;
  responseRate: number;
  topRespHosts: AnalyticsResponseHost[];
  bottomRespHosts: AnalyticsResponseHost[];
};

export type AnalyticsStats = AnalyticsBusinessSummary & AnalyticsHostSummary;

export type AnalyticsMetricKey =
  | 'aov'
  | 'users'
  | 'gmv'
  | 'cancel'
  | 'response'
  | 'exps'
  | 'demographics'
  | 'searchTrends'
  | 'topExps'
  | 'hostDemographics'
  | 'revenue'
  | 'conversion'
  | 'retention';

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

export type AnalyticsTabProps = {
  bookings?: AnalyticsBookingInput[];
  users?: AnalyticsUserInput[];
  exps?: AnalyticsExperienceInput[];
  apps?: AnalyticsApplicationInput[];
  reviews?: AnalyticsReviewInput[];
  searchLogs?: AnalyticsSearchLogInput[];
  analyticsEvents?: AnalyticsEventInput[];
  inquiries?: AnalyticsInquiryInput[];
  inquiryMessages?: AnalyticsInquiryMessageInput[];
};

export type AnalyticsSummaryDataArgs = Required<AnalyticsTabProps> & {
  dateRange: import('react-date-range').Range[];
};

export type AnalyticsSummaryDataResult = {
  loading: boolean;
  stats: AnalyticsStats;
  summarySource: AnalyticsSummarySources;
  searchIntent: AnalyticsSearchIntentSummary | null;
  searchIntentSource: SearchIntentSource;
  customerComposition: AnalyticsCustomerCompositionSummary | null;
  customerCompositionSource: CustomerCompositionSource;
};

export type AnalyticsMetricSelectHandler = (metric: AnalyticsMetricKey) => void;

export type AnalyticsBusinessSectionProps = {
  stats: AnalyticsStats;
  summarySource: SummarySource;
  onSelectMetric: AnalyticsMetricSelectHandler;
  searchIntent: AnalyticsSearchIntentSummary | null;
  searchIntentSource: SearchIntentSource;
  searchTrends: SearchTrendItem[];
  customerComposition: AnalyticsCustomerCompositionSummary | null;
  customerCompositionSource: CustomerCompositionSource;
};

export type AnalyticsHostSectionProps = {
  stats: AnalyticsStats;
  summarySource: SummarySource;
  onSelectMetric: AnalyticsMetricSelectHandler;
};

export type AnalyticsSearchDemandSectionProps = {
  searchIntent: AnalyticsSearchIntentSummary | null;
  searchIntentSource: SearchIntentSource;
  searchTrends: SearchTrendItem[];
  onSelectMetric: AnalyticsMetricSelectHandler;
};

export type AnalyticsMetricModalProps = {
  selectedMetric: AnalyticsMetricKey | null;
  stats: AnalyticsStats;
  onClose: () => void;
};
