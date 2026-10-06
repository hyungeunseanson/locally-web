import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CommunitySourceR2 } from './communityMedia';
import type { CommunityImageDecoder } from './communityRaster';
export type CommunityEnvironment = { CLOUDFLARE_DEPLOYMENT_ENV?: string; COMMUNITY_R2_SOURCE_ENABLED?: string; PUBLIC_COMMUNITY_SOURCE_R2?: CommunitySourceR2; IMAGES?: CommunityImageDecoder };
export function loadCommunityRuntime(): CommunityEnvironment | null {
  try { return (getCloudflareContext() as { env?: CommunityEnvironment }).env ?? null; } catch { return null; }
}
