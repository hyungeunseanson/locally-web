import type { ExperienceLocale } from '@/app/utils/experienceTranslation';
import type { LanguageLevelEntry } from '@/app/utils/languageLevels';

export type ExperienceItineraryItem = {
  title: string;
  description: string;
  type: string;
  image_url: string;
};

export type ExperienceRules = {
  age_limit: string;
  activity_level: string;
  refund_policy: string;
  host_notice: string;
};

type LocalizedTextMap = Partial<Record<ExperienceLocale, string>>;
type LocalizedStringListMap = Partial<Record<ExperienceLocale, string[]>>;
type LocalizedItineraryMap = Partial<Record<ExperienceLocale, ExperienceItineraryItem[]>>;
type LocalizedRulesMap = Partial<Record<ExperienceLocale, ExperienceRules>>;

export type ExperienceDetail = {
  id: string;
  host_id: string | null;
  title: string;
  description: string;
  title_ko: string | null;
  description_ko: string | null;
  title_en: string | null;
  description_en: string | null;
  title_ja: string | null;
  description_ja: string | null;
  title_zh: string | null;
  description_zh: string | null;
  city: string | null;
  subCity: string | null;
  country: string | null;
  category: string | null;
  category_en: string | null;
  category_ja: string | null;
  category_zh: string | null;
  languages: string[];
  language_levels: LanguageLevelEntry[];
  meeting_point: string;
  meeting_point_i18n: LocalizedTextMap;
  location: string;
  rating: number;
  review_count: number;
  price: number;
  private_price: number | null;
  is_private_enabled: boolean;
  photos: string[];
  image_url: string | null;
  max_guests: number;
  duration: number | null;
  supplies: string;
  supplies_i18n: LocalizedTextMap;
  inclusions: string[];
  inclusions_i18n: LocalizedStringListMap;
  exclusions: string[];
  exclusions_i18n: LocalizedStringListMap;
  itinerary: ExperienceItineraryItem[];
  itinerary_i18n: LocalizedItineraryMap;
  rules: ExperienceRules;
  rules_i18n: LocalizedRulesMap;
  status: string | null;
  is_active: boolean | null;
};

export type HostProfileDetail = {
  id: string;
  name: string;
  avatar_url?: string;
  nationality?: string;
  languages: string[];
  introduction: string;
  job?: string;
  dream_destination?: string;
  favorite_song?: string;
  joined_year: number | null;
  review_count: number;
  rating: number | null;
} | null;

export type ExperienceSlotSummary = {
  remainingSeats: number;
  isBookable: boolean;
  soldOutReason?: ExperienceSlotSoldOutReason;
  soloGuaranteeEligible: boolean;
};

export type ExperienceCalendarDayStatus = 'available' | 'sold_out';

export type ExperienceSlotSoldOutReason = 'capacity_full' | 'private_booked';

export type ExperienceAvailabilitySummary = {
  availableDates: string[];
  dateToTimeMap: Record<string, string[]>;
  calendarDayStatusMap: Record<string, ExperienceCalendarDayStatus>;
  slotSummaryMap: Record<string, ExperienceSlotSummary>;
};
