export const MAX_EXPERIENCE_IMAGE_CLEANUP_PATHS = 50;

export class ExperienceImageUploadError extends Error {
  readonly code: 'empty_image' | 'unreadable_image' | 'upload_failed';

  constructor(code: 'empty_image' | 'unreadable_image' | 'upload_failed') {
    super(code);
    this.name = 'ExperienceImageUploadError';
    this.code = code;
  }
}

export type ExperienceImageUploadFolder = 'hero' | 'itinerary';

export async function uploadExperienceImage(input: {
  file: File;
  folder: ExperienceImageUploadFolder;
  experienceId?: string | number;
}) {
  const { bytes, contentType } = await materializeExperienceImage(input.file);
  const body = new FormData();
  body.set('file', new File([bytes], input.file.name, { type: contentType }));
  body.set('folder', input.folder);
  if (input.experienceId !== undefined) {
    body.set('experienceId', String(input.experienceId));
  }

  const response = await fetch('/api/host/experience-images/upload', {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true || typeof payload?.publicUrl !== 'string') {
    throw new ExperienceImageUploadError('upload_failed');
  }
  return {
    publicUrl: payload.publicUrl as string,
    cleanupPath: typeof payload.cleanupPath === 'string' ? payload.cleanupPath : null,
    authority: payload.authority === 'r2' ? 'r2' as const : 'supabase' as const,
  };
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
