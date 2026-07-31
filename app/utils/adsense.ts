export type AdSenseEnv = Record<string, string | undefined>;

export type CommunityAdPlacement =
  | 'community-list-sidebar'
  | 'community-list-bottom'
  | 'community-detail-sidebar'
  | 'community-detail-bottom';

export interface AdSenseSlotConfig {
  clientId: string | null;
  slotId: string | null;
  globallyEnabled: boolean;
  enabled: boolean;
}

const COMMUNITY_SLOT_ENV_KEY: Record<CommunityAdPlacement, keyof AdSenseEnv> = {
  'community-list-sidebar': 'NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_SIDEBAR_SLOT',
  'community-list-bottom': 'NEXT_PUBLIC_ADSENSE_COMMUNITY_LIST_BOTTOM_SLOT',
  'community-detail-sidebar': 'NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_SIDEBAR_SLOT',
  'community-detail-bottom': 'NEXT_PUBLIC_ADSENSE_COMMUNITY_DETAIL_BOTTOM_SLOT',
};

const ADSENSE_CLIENT_ID_PATTERN = /^ca-pub-\d+$/;
const ADSENSE_SLOT_ID_PATTERN = /^\d+$/;

function readTrimmedEnvValue(env: AdSenseEnv, key: keyof AdSenseEnv): string | null {
  const rawValue = env[key];
  if (typeof rawValue !== 'string') return null;

  const value = rawValue.trim();
  return value.length > 0 ? value : null;
}

export function normalizeAdSenseClientId(value?: string | null): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('pub-') ? `ca-${trimmed}` : trimmed;
  return ADSENSE_CLIENT_ID_PATTERN.test(normalized) ? normalized : null;
}

function readAdSenseSlotId(env: AdSenseEnv, key: keyof AdSenseEnv): string | null {
  const slotId = readTrimmedEnvValue(env, key);
  return slotId && ADSENSE_SLOT_ID_PATTERN.test(slotId) ? slotId : null;
}

export function getAdSenseClientId(env: AdSenseEnv = process.env): string | null {
  return normalizeAdSenseClientId(readTrimmedEnvValue(env, 'NEXT_PUBLIC_ADSENSE_CLIENT_ID'));
}

export function getAdSensePublisherId(value?: string | null): string | null {
  const clientId = normalizeAdSenseClientId(value);
  if (!clientId) return null;
  return clientId.replace(/^ca-/, '');
}

export function isAdSenseEnabled(env: AdSenseEnv = process.env): boolean {
  return readTrimmedEnvValue(env, 'NEXT_PUBLIC_ADSENSE_ENABLED') === 'true' && Boolean(getAdSenseClientId(env));
}

export function buildAdSenseScriptUrl(value?: string | null): string | null {
  const clientId = normalizeAdSenseClientId(value);
  if (!clientId) return null;
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}

export function resolveCommunityAdSlotConfig(
  placement: CommunityAdPlacement,
  env: AdSenseEnv = process.env,
): AdSenseSlotConfig {
  const clientId = getAdSenseClientId(env);
  const slotId = readAdSenseSlotId(env, COMMUNITY_SLOT_ENV_KEY[placement]);
  const globallyEnabled = isAdSenseEnabled(env);

  return {
    clientId,
    slotId,
    globallyEnabled,
    enabled: globallyEnabled && Boolean(slotId),
  };
}

export function resolveDesktopFooterAdSlotConfig(
  env: AdSenseEnv = process.env,
): AdSenseSlotConfig {
  const clientId = getAdSenseClientId(env);
  const slotId = readAdSenseSlotId(env, 'NEXT_PUBLIC_ADSENSE_DESKTOP_FOOTER_SLOT');
  const globallyEnabled = isAdSenseEnabled(env);

  return {
    clientId,
    slotId,
    globallyEnabled,
    enabled: globallyEnabled && Boolean(slotId),
  };
}

export function resolveDesktopRightRailAdSlotConfig(
  env: AdSenseEnv = process.env,
): AdSenseSlotConfig {
  const clientId = getAdSenseClientId(env);
  const slotId = readAdSenseSlotId(env, 'NEXT_PUBLIC_ADSENSE_DESKTOP_RIGHT_RAIL_SLOT');
  const globallyEnabled = isAdSenseEnabled(env);

  return {
    clientId,
    slotId,
    globallyEnabled,
    enabled: globallyEnabled && Boolean(slotId),
  };
}

export function buildAdsTxtEntry(env: AdSenseEnv = process.env): string | null {
  const publisherId = getAdSensePublisherId(getAdSenseClientId(env));
  if (!publisherId) return null;
  return `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`;
}
