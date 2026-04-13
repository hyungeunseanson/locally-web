import { existsSync, readFileSync } from 'fs';

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

export function resolveConfiguredSiteUrl(
  env: Record<string, string | undefined> = {
    ...loadEnvFile('.env.local'),
    ...process.env,
  },
) {
  const configuredSiteUrl = readTrimmedEnv(env, 'NEXT_PUBLIC_SITE_URL');
  if (!configuredSiteUrl) {
    throw new Error('Missing NEXT_PUBLIC_SITE_URL for domain-sensitive test expectations.');
  }

  return configuredSiteUrl.replace(/\/+$/, '');
}
