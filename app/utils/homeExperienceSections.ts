type RankedHomeExperience = {
  created_at?: string | null;
  review_count?: number | null;
  wishlist_count?: number | null;
};

function getComparableTimestamp(value?: string | null) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getComparableNumber(value?: number | null) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function sortLatestExperiences<T extends RankedHomeExperience>(experiences: T[]) {
  return [...experiences].sort(
    (a, b) => getComparableTimestamp(b.created_at) - getComparableTimestamp(a.created_at)
  );
}

export function sortPopularExperiences<T extends RankedHomeExperience>(experiences: T[]) {
  return [...experiences].sort((a, b) => {
    const wishlistDelta = getComparableNumber(b.wishlist_count) - getComparableNumber(a.wishlist_count);
    if (wishlistDelta !== 0) {
      return wishlistDelta;
    }

    const reviewDelta = getComparableNumber(b.review_count) - getComparableNumber(a.review_count);
    if (reviewDelta !== 0) {
      return reviewDelta;
    }

    return getComparableTimestamp(b.created_at) - getComparableTimestamp(a.created_at);
  });
}

export function buildHomeExperienceSections<T extends RankedHomeExperience>(experiences: T[]) {
  return {
    popularExperiences: sortPopularExperiences(experiences),
    allExperiencesLatest: sortLatestExperiences(experiences),
  };
}
