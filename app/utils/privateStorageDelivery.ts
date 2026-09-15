const CHAT_IMAGE_DELIVERY_PREFIX = '/api/inquiries/messages/';
const ADMIN_FILE_DELIVERY_PREFIX = '/api/admin/files/';
const SAFE_INLINE_RASTER_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function encodeObjectPath(path: string) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function normalizeObjectPath(path: string) {
  const normalized = path.replace(/^\/+/, '');
  if (
    !normalized ||
    normalized.includes('\\') ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }

  return normalized;
}

export function getPrivateChatImageDeliveryUrl(messageId: string | number) {
  return `${CHAT_IMAGE_DELIVERY_PREFIX}${encodeURIComponent(String(messageId))}/image`;
}

export function isSafeInlineRasterImageType(value: string) {
  return SAFE_INLINE_RASTER_IMAGE_TYPES.has(value.trim().toLowerCase());
}

export function getAdminFileDeliveryUrl(path: string) {
  const normalized = normalizeObjectPath(path);
  return normalized ? `${ADMIN_FILE_DELIVERY_PREFIX}${encodeObjectPath(normalized)}` : null;
}

export function extractStorageObjectPath(value: string, bucket: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, 'https://locally.invalid');
    const decodedPathname = decodeURIComponent(parsed.pathname);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
    ];

    for (const marker of markers) {
      if (decodedPathname.startsWith(marker)) {
        return normalizeObjectPath(decodedPathname.slice(marker.length));
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveAdminFileDeliveryUrl(value?: string | Blob | null) {
  if (typeof value !== 'string') return value ?? undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith(ADMIN_FILE_DELIVERY_PREFIX)) {
    return trimmed;
  }

  const path = extractStorageObjectPath(trimmed, 'admin_files');
  return path ? (getAdminFileDeliveryUrl(path) ?? undefined) : trimmed;
}
