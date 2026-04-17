import { getSearchableCityAliases } from '@/app/utils/searchLocationCatalog';

type SearchableExperienceText = {
  title?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  meeting_point?: string | null;
  category?: string | null;
  title_ko?: string | null;
  description_ko?: string | null;
  title_en?: string | null;
  description_en?: string | null;
  category_en?: string | null;
  title_ja?: string | null;
  description_ja?: string | null;
  category_ja?: string | null;
  title_zh?: string | null;
  description_zh?: string | null;
  category_zh?: string | null;
  tags?: string[] | null;
};

function asSearchableString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

export function normalizeSearchInput(value: string) {
  return value
    .replace(/[(),'"`]/g, ' ')
    .replace(/[·,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tokenizeSearchInput(value: string) {
  const normalized = normalizeSearchInput(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

export function buildSearchHaystack(item: SearchableExperienceText) {
  return [
    item.title,
    item.description,
    item.city,
    ...getSearchableCityAliases(item.city),
    item.country,
    item.meeting_point,
    item.category,
    item.title_ko,
    item.description_ko,
    item.title_en,
    item.description_en,
    item.category_en,
    item.title_ja,
    item.description_ja,
    item.category_ja,
    item.title_zh,
    item.description_zh,
    item.category_zh,
    ...(item.tags || []),
  ]
    .map(asSearchableString)
    .join(' ')
    .toLowerCase();
}

type SearchableExperienceTypeText = Pick<
  SearchableExperienceText,
  | 'title'
  | 'category'
  | 'title_ko'
  | 'title_en'
  | 'category_en'
  | 'title_ja'
  | 'category_ja'
  | 'title_zh'
  | 'category_zh'
>;

export function buildSearchTypeHaystack(item: SearchableExperienceTypeText) {
  return [
    item.title,
    item.category,
    item.title_ko,
    item.title_en,
    item.category_en,
    item.title_ja,
    item.category_ja,
    item.title_zh,
    item.category_zh,
  ]
    .map(asSearchableString)
    .join(' ')
    .toLowerCase();
}
