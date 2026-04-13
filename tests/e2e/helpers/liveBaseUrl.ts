import { existsSync, readFileSync } from 'fs';

const LEGACY_LIVE_BASE_URL = 'https://locally-web.vercel.app';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return {};

  return readFileSync(path, 'utf8')
    .split(/\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return acc;

      acc[match[1]] = match[2];
      return acc;
    }, {});
}

function readTrimmedEnv(env: Record<string, string | undefined>, key: string) {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

export function resolveLiveBaseUrl(
  env: Record<string, string | undefined> = {
    ...loadEnvFile('.env.local'),
    ...process.env,
  },
) {
  return (
    readTrimmedEnv(env, 'PLAYWRIGHT_LIVE_BASE_URL') ||
    readTrimmedEnv(env, 'NEXT_PUBLIC_SITE_URL') ||
    LEGACY_LIVE_BASE_URL
  );
}

export const LIVE_BASE_URL = resolveLiveBaseUrl();
