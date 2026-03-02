import { LanguageLevelEntry } from '@/app/utils/languageLevels';

export type ExperienceItineraryItem = {
  title?: string;
  description?: string;
  image_url?: string;
};

export type ExperienceRules = {
  age_limit?: string;
  activity_level?: string;
  preparation_level?: string;
  refund_policy?: string;
};

export type ExperienceDetail = {
  id: string | number;
  host_id?: string;
  title?: string;
  description?: string;
  city?: string;
  subCity?: string;
  category?: string;
  languages?: string[];
  language_levels?: LanguageLevelEntry[];
  meeting_point?: string;
  location?: string;
  rating?: number;
  review_count?: number;
  price?: number;
  private_price?: number;
  is_private_enabled?: boolean;
  photos?: string[];
  image_url?: string;
  max_guests?: number;
  duration?: number;
  supplies?: string;
  inclusions?: string[];
  exclusions?: string[];
  itinerary?: ExperienceItineraryItem[];
  rules?: ExperienceRules;
  [key: string]: unknown;
};

export type HostProfileDetail = {
  id?: string;
  name?: string;
  avatar_url?: string;
  languages?: string[];
  introduction?: string;
  job?: string;
  dream_destination?: string;
  favorite_song?: string;
  joined_year?: number | null;
  review_count?: number;
  rating?: number | null;
  bio?: string;
  [key: string]: unknown;
} | null;
