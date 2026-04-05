type StorageUploadFailureContext = {
  route: string;
  bucket: string;
  fileKind: string;
  filePath: string;
  boundary?: string;
  locale?: string;
};

type StorageErrorLike = {
  name?: unknown;
  message?: unknown;
  error?: unknown;
  details?: unknown;
  statusCode?: unknown;
  status?: unknown;
};

export type StorageUploadFailureDiagnostic = {
  route: string;
  boundary: string;
  bucket: string;
  fileKind: string;
  filePathPattern: string;
  pathPrefix: string | null;
  locale: string | null;
  errorName: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  errorDetails: string | null;
  statusCode: string | number | null;
};

function asStorageErrorLike(error: unknown): StorageErrorLike | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  return error as StorageErrorLike;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStatusCode(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

export function redactStorageObjectPath(filePath: string) {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return '<redacted>';
  }

  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return '<redacted>';
  }

  return `${segments.slice(0, -1).join('/')}/<redacted>`;
}

export function buildStorageUploadFailureDiagnostic(
  error: unknown,
  context: StorageUploadFailureContext
): StorageUploadFailureDiagnostic {
  const errorLike = asStorageErrorLike(error);
  const trimmedPath = context.filePath.trim();
  const pathSegments = trimmedPath.split('/').filter(Boolean);

  return {
    route: context.route,
    boundary: context.boundary || 'storage_upload',
    bucket: context.bucket,
    fileKind: context.fileKind,
    filePathPattern: redactStorageObjectPath(context.filePath),
    pathPrefix: pathSegments[0] || null,
    locale: asText(context.locale),
    errorName: asText(errorLike?.name),
    errorMessage: asText(errorLike?.message),
    errorCode: asText(errorLike?.error),
    errorDetails: asText(errorLike?.details),
    statusCode: asStatusCode(errorLike?.statusCode) ?? asStatusCode(errorLike?.status),
  };
}
