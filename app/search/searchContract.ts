export interface SearchExperience {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  city?: string;
  country?: string;
  languages?: string[];
  image_url?: string;
  photos?: string[];
  rating?: number;
  price?: number | string;
  review_count?: number | null;
  available_dates?: string[];
  available_times?: string[];
  [key: string]: unknown;
}

export type SearchExperiencesResponse = {
  data: SearchExperience[];
};

export type SearchTimeId = 'morning' | 'afternoon' | 'evening';
export type SearchTypeId =
  | 'food_tour'
  | 'cafe_dessert'
  | 'walking_healing'
  | 'shopping'
  | 'culture'
  | 'activity'
  | 'nightlife'
  | 'architecture'
  | 'show_sports'
  | 'landmark'
  | 'one_day_class';

export const SEARCH_TIME_RANGES: Record<SearchTimeId, { startHour: number; endHour: number | null }> = {
  morning: { startHour: 0, endHour: 12 },
  afternoon: { startHour: 12, endHour: 17 },
  evening: { startHour: 17, endHour: null },
};

export const SEARCH_TYPE_KEYWORDS: Record<SearchTypeId, string[]> = {
  food_tour: ['맛집 탐방', '맛집', '음식', 'food'],
  cafe_dessert: ['카페/디저트', '카페', '디저트', 'cafe', 'dessert'],
  walking_healing: ['산책/힐링', '산책', '힐링', 'walk', 'healing'],
  shopping: ['쇼핑', 'shopping'],
  culture: ['문화 체험', '문화', 'culture'],
  activity: ['액티비티', 'activity'],
  nightlife: ['나이트라이프', 'nightlife'],
  architecture: ['건축', 'architecture'],
  show_sports: ['공연/경기', '공연', '경기', 'show', 'sports'],
  landmark: ['랜드마크', '명소', 'landmark'],
  one_day_class: ['원데이 클래스', '클래스', 'class'],
};

export const SEARCH_EXPERIENCE_SELECT = [
  'id',
  'title',
  'description',
  'city',
  'country',
  'category',
  'title_ko',
  'description_ko',
  'title_en',
  'description_en',
  'category_en',
  'title_ja',
  'description_ja',
  'category_ja',
  'title_zh',
  'description_zh',
  'category_zh',
  'languages',
  'image_url',
  'photos',
  'rating',
  'review_count',
  'price',
  'location',
].join(', ');
