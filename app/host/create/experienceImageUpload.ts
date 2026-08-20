export const MAX_EXPERIENCE_IMAGE_CLEANUP_PATHS = 50;

export class ExperienceImageUploadError extends Error {
  readonly code: 'empty_image' | 'unreadable_image' | 'upload_failed';

  constructor(code: 'empty_image' | 'unreadable_image' | 'upload_failed') {
    super(code);
    this.name = 'ExperienceImageUploadError';
    this.code = code;
  }
}
export async function materializeExperienceImage(file: File) {
  let bytes: ArrayBuffer;

  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new ExperienceImageUploadError('unreadable_image');
  }

  if (bytes.byteLength === 0) {
    throw new ExperienceImageUploadError('empty_image');
  }

  return {
    bytes,
    contentType: file.type || 'image/jpeg',
  };
}

export function isOwnedExperienceImagePath(path: string, userId: string) {
  if (!path || path.includes('..') || path.startsWith('/')) return false;

  const prefix = `experience/${userId}/`;
  if (!path.startsWith(prefix)) return false;

  const relativePath = path.slice(prefix.length);
  return /^(hero|itinerary)\/[A-Za-z0-9._-]+$/.test(relativePath);
}
