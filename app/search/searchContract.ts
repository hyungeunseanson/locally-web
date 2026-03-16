export interface SearchExperience {
  id: string;
  title?: string;
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
