export type PublicReviewLocale = 'ko' | 'en' | 'ja' | 'zh';

export type PublicReviewProfileRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
};

export type PublicReviewRow = {
  id: number;
  user_id: string | null;
  rating: number;
  content: string | null;
  created_at: string;
  reply?: string | null;
  reply_at?: string | null;
};

export type PublicReviewItem = {
  id: number;
  rating: number;
  content: string | null;
  created_at: string;
  reply: string | null;
  reply_at: string | null;
  reviewer: {
    display_name: string;
    avatar_url: string | null;
  };
};

export type PublicReviewSummary = {
  average_rating: number | null;
  review_count: number;
};

const PUBLIC_REVIEW_GUEST_LABELS: Record<PublicReviewLocale, string> = {
  ko: '게스트',
  en: 'Guest',
  ja: 'ゲスト',
  zh: '游客',
};

export function resolvePublicReviewLocale(value: string | null | undefined): PublicReviewLocale | null {
  if (!value) return null;

  const normalized = value.toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return null;
}

export function getPublicReviewGuestLabel(locale: PublicReviewLocale): string {
  return PUBLIC_REVIEW_GUEST_LABELS[locale];
}

export function maskPublicReviewerName(
  name: string | null | undefined,
  fallbackLabel: string
): string {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return fallbackLabel;

  const characters = Array.from(trimmedName);
  if (characters.length <= 2) {
    return `${characters[0]}*`;
  }

  return `${characters.slice(0, 2).join('')}*`;
}

function getPublicReviewerSourceName(profile: PublicReviewProfileRow | undefined) {
  if (!profile) return '';

  const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
  if (fullName) return fullName;

  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  return name;
}

function normalizePublicReviewAverageRating(value: unknown) {
  if (value == null) return null;

  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return null;
  }

  return Number(normalized.toFixed(2));
}

function normalizePublicReviewCount(value: unknown) {
  if (value == null) return null;

  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return null;
  }

  return Math.trunc(normalized);
}

function calculateAverageRatingFromPublicReviews(reviews: PublicReviewRow[]) {
  if (reviews.length === 0) return null;

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Number((total / reviews.length).toFixed(2));
}

export function buildPublicReviewSummary(params: {
  reviews: PublicReviewRow[] | null | undefined;
  averageRating?: unknown;
  reviewCount?: unknown;
}): PublicReviewSummary {
  const reviews = params.reviews || [];
  const storedReviewCount = normalizePublicReviewCount(params.reviewCount);
  const shouldUseStoredCount =
    storedReviewCount !== null && !(storedReviewCount === 0 && reviews.length > 0);
  const reviewCount = shouldUseStoredCount ? storedReviewCount : reviews.length;

  if (reviewCount === 0) {
    return {
      average_rating: null,
      review_count: 0,
    };
  }

  const storedAverageRating = normalizePublicReviewAverageRating(params.averageRating);
  const fallbackAverageRating = calculateAverageRatingFromPublicReviews(reviews);
  const shouldUseStoredAverage =
    shouldUseStoredCount && storedAverageRating !== null && storedAverageRating > 0;

  return {
    average_rating: shouldUseStoredAverage ? storedAverageRating : fallbackAverageRating,
    review_count: reviewCount,
  };
}

export function buildPublicReviewItems(params: {
  reviews: PublicReviewRow[] | null | undefined;
  profiles: PublicReviewProfileRow[] | null | undefined;
  locale: PublicReviewLocale;
}): PublicReviewItem[] {
  const fallbackLabel = getPublicReviewGuestLabel(params.locale);
  const profileMap = new Map<string, PublicReviewProfileRow>(
    (params.profiles || []).map((profile) => [profile.id, profile])
  );

  return (params.reviews || []).map((review) => {
    const profile = review.user_id ? profileMap.get(review.user_id) : undefined;

    return {
      id: review.id,
      rating: review.rating,
      content: review.content,
      created_at: review.created_at,
      reply: review.reply || null,
      reply_at: review.reply_at || null,
      reviewer: {
        display_name: maskPublicReviewerName(getPublicReviewerSourceName(profile), fallbackLabel),
        avatar_url: profile?.avatar_url || null,
      },
    };
  });
}
