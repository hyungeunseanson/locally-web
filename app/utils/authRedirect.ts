type AuthRedirectEnv = Record<string, string | undefined>;

const INTERNAL_PATH_ORIGIN = 'https://locally.internal';

export function normalizeInternalReturnPath(rawValue: string | null | undefined): string {
  if (typeof rawValue !== 'string') {
    return '/';
  }

  const value = rawValue.trim();
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return '/';
  }

  try {
    const parsed = new URL(value, INTERNAL_PATH_ORIGIN);
    if (parsed.origin !== INTERNAL_PATH_ORIGIN || !parsed.pathname.startsWith('/')) {
      return '/';
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function normalizeForwardedHost(rawValue: string | null): string | null {
  if (!rawValue) return null;

  const value = rawValue.split(',')[0]?.trim().toLowerCase() || '';
  if (!value) return null;
  if (value.includes('/') || value.includes('\\') || /[\u0000-\u001F\u007F\s]/.test(value)) {
    return null;
  }

  return value;
}

function normalizeForwardedProto(rawValue: string | null): 'http' | 'https' | null {
  if (!rawValue) return null;

  const value = rawValue.split(',')[0]?.trim().toLowerCase();
  return value === 'http' || value === 'https' ? value : null;
}

export function resolveAuthCallbackOrigin(
  requestUrl: string,
  requestHeaders: Headers,
  env: AuthRedirectEnv = process.env
): string {
  const requestOrigin = new URL(requestUrl).origin;
  if (env.NODE_ENV === 'development') {
    return requestOrigin;
  }

  const forwardedHost = normalizeForwardedHost(requestHeaders.get('x-forwarded-host'));
  if (!forwardedHost) {
    return requestOrigin;
  }

  const forwardedProto = normalizeForwardedProto(requestHeaders.get('x-forwarded-proto')) || 'https';
  return `${forwardedProto}://${forwardedHost}`;
}
