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

const uploadKeys = new WeakMap<File, Map<string, string>>();

export async function uploadExperienceImage(input: {
  file: File;
  folder: ExperienceImageUploadFolder;
  experienceId?: string | number;
  idempotencyKey?: string;
}) {
  const { bytes, contentType } = await materializeExperienceImage(input.file);
  const body = new FormData();
  body.set('file', new File([bytes], input.file.name, { type: contentType }));
  body.set('folder', input.folder);
  if (input.experienceId !== undefined) {
    body.set('experienceId', String(input.experienceId));
  }

  const scope = input.folder + ':' + String(input.experienceId ?? 'new');
  const keys = uploadKeys.get(input.file) ?? new Map<string, string>();
  const idempotencyKey = input.idempotencyKey ?? keys.get(scope) ?? crypto.randomUUID();
  keys.set(scope, idempotencyKey);
  uploadKeys.set(input.file, keys);

  const response = await fetch('/api/host/experience-images/upload', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
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
    assetId: typeof payload.assetId === 'string' ? payload.assetId : null,
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
