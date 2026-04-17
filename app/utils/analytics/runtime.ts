type AnalyticsRuntimeEnv = Record<string, string | undefined>;

function readTrimmedEnv(env: AnalyticsRuntimeEnv, key: string) {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

export function shouldRenderVercelAnalytics(env: AnalyticsRuntimeEnv = process.env): boolean {
  const explicitToggle = readTrimmedEnv(env, 'NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED');

  if (explicitToggle === 'true') {
    return true;
  }

  if (explicitToggle === 'false') {
    return false;
  }

  return Boolean(readTrimmedEnv(env, 'VERCEL') || readTrimmedEnv(env, 'VERCEL_ENV'));
}
