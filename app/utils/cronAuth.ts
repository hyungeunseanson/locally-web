const LOCAL_DEV_FALLBACK_CRON_SECRET = 'codex-cron-secret';

export function getExpectedCronSecret() {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === 'production') return null;
  return LOCAL_DEV_FALLBACK_CRON_SECRET;
}

export function hasValidCronAuthorization(authHeader: string | null) {
  const expectedSecret = getExpectedCronSecret();
  return Boolean(expectedSecret) && authHeader === `Bearer ${expectedSecret}`;
}
