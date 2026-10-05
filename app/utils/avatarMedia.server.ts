import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { ExperienceMediaSourceR2 } from './experienceMediaSource';
export type AvatarEnvironment = { CLOUDFLARE_DEPLOYMENT_ENV?: string; AVATAR_R2_SOURCE_ENABLED?: string; PUBLIC_AVATAR_R2?: ExperienceMediaSourceR2 };
export function loadAvatarRuntime(): AvatarEnvironment | null {
  try { return (getCloudflareContext() as { env?: AvatarEnvironment }).env ?? null; } catch { return null; }
}
