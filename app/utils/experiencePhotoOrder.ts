export type ExperiencePhotoOrderValidation =
  | { ok: true; currentPhotos: string[]; nextPhotos: string[] }
  | { ok: false; status: 400 | 409; error: string };

function asPhotoArray(value: unknown, maxPhotos: number): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxPhotos) {
    return null;
  }

  const photos = value.filter((photo): photo is string => typeof photo === 'string');
  if (photos.length !== value.length || photos.some((photo) => !photo.trim() || photo !== photo.trim())) {
    return null;
  }

  return photos;
}

export function arePhotoOrdersEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((photo, index) => photo === right[index]);
}

function haveSamePhotoCounts(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;

  const counts = new Map<string, number>();
  for (const photo of left) {
    counts.set(photo, (counts.get(photo) ?? 0) + 1);
  }

  for (const photo of right) {
    const remaining = counts.get(photo) ?? 0;
    if (remaining < 1) return false;
    if (remaining === 1) counts.delete(photo);
    else counts.set(photo, remaining - 1);
  }

  return counts.size === 0;
}

export function validateExperiencePhotoReorder(input: {
  currentPhotos: unknown;
  expectedPhotos: unknown;
  nextPhotos: unknown;
  maxPhotos: number;
}): ExperiencePhotoOrderValidation {
  const currentPhotos = asPhotoArray(input.currentPhotos, input.maxPhotos);
  const expectedPhotos = asPhotoArray(input.expectedPhotos, input.maxPhotos);
  const nextPhotos = asPhotoArray(input.nextPhotos, input.maxPhotos);

  if (!currentPhotos || !expectedPhotos || !nextPhotos) {
    return { ok: false, status: 400, error: 'Invalid photo order payload.' };
  }

  if (!arePhotoOrdersEqual(currentPhotos, expectedPhotos)) {
    return {
      ok: false,
      status: 409,
      error: 'Photos changed. Refresh and try again.',
    };
  }

  if (!haveSamePhotoCounts(currentPhotos, nextPhotos)) {
    return { ok: false, status: 400, error: 'Photo set must not change.' };
  }

  return { ok: true, currentPhotos, nextPhotos };
}

export function toPostgresTextArrayLiteral(photos: readonly string[]) {
  const values = photos.map((photo) => `"${photo.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `{${values.join(',')}}`;
}
