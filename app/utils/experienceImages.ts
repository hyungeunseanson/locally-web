type ExperienceImageLike = {
  card_image_url?: string | null;
  image_url?: string | null;
  photos?: string[] | null;
};

const FALLBACK_EXPERIENCE_IMAGE =
  'https://images.unsplash.com/photo-1542051841857-5f90071e7989';

function firstNonEmptyString(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;
}

export function getExperienceCardImageUrl(
  experience: ExperienceImageLike,
  fallbackImageUrl: string = FALLBACK_EXPERIENCE_IMAGE
) {
  return (
    firstNonEmptyString([
      experience.photos?.[0],
      experience.card_image_url,
      experience.image_url,
    ]) ?? fallbackImageUrl
  );
}
