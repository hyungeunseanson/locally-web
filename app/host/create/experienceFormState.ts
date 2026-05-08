import { DEFAULT_SOLO_GUARANTEE_PRICE } from '@/app/constants/soloGuarantee';
import type { ExperienceLocale, LocalizedField, ManualContent } from '@/app/utils/experienceTranslation';
import { mergeManualContent } from '@/app/utils/experienceTranslation';
import type { LanguageLevelEntry } from '@/app/utils/languageLevels';

export type ItineraryItem = {
  title: string;
  description: string;
  type: 'meet' | 'spot' | 'end';
  image_url?: string;
};

export type ExperienceFormState = {
  country: string;
  city: string;
  subCity: string;
  category: string;
  languages: string[];
  language_levels: LanguageLevelEntry[];
  source_locale: ExperienceLocale;
  manual_content: ManualContent;
  photos: string[];
  location: string;
  itinerary: ItineraryItem[];
  inclusions: string[];
  exclusions: string[];
  supplies: string;
  duration: number;
  maxGuests: number;
  meeting_point: string;
  rules: {
    age_limit: string;
    activity_level: string;
    refund_policy: string;
    host_notice?: string;
  };
  price: number;
  solo_guarantee_price?: number;
  is_private_enabled?: boolean;
  private_price?: number;
};

export function getManualFieldValue(
  manualContent: ManualContent,
  locale: ExperienceLocale,
  field: LocalizedField
): string {
  return manualContent[locale]?.[field] ?? '';
}

export function setManualFieldValue(
  manualContent: ManualContent,
  locale: ExperienceLocale,
  field: LocalizedField,
  value: string
): ManualContent {
  return {
    ...manualContent,
    [locale]: {
      title: manualContent[locale]?.title ?? '',
      description: manualContent[locale]?.description ?? '',
      [field]: value,
    },
  };
}

export function syncManualContentWithLocales(
  manualContent: ManualContent,
  locales: ExperienceLocale[],
  sourceLocale?: ExperienceLocale | null
): ManualContent {
  return mergeManualContent(manualContent, locales, sourceLocale);
}

export function buildExperienceWritePayload(formData: ExperienceFormState) {
  const hostNotice = String(formData.rules.host_notice || '').trim();

  return {
    country: formData.country,
    city: formData.city,
    category: formData.category,
    language_levels: formData.language_levels,
    source_locale: formData.source_locale,
    manual_content: formData.manual_content,
    photos: formData.photos,
    location: formData.location,
    itinerary: formData.itinerary,
    inclusions: formData.inclusions,
    exclusions: formData.exclusions,
    supplies: formData.supplies,
    duration: formData.duration,
    maxGuests: formData.maxGuests,
    meeting_point: formData.meeting_point,
    rules: {
      ...formData.rules,
      host_notice: hostNotice,
    },
    price: formData.price,
    solo_guarantee_price: formData.solo_guarantee_price ?? DEFAULT_SOLO_GUARANTEE_PRICE,
    is_private_enabled: Boolean(formData.is_private_enabled),
    private_price: formData.private_price ?? 0,
  };
}
