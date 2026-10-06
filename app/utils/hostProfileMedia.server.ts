import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { HostProfileSourceR2 } from './hostProfileMedia';
export type HostProfileEnvironment = { CLOUDFLARE_DEPLOYMENT_ENV?: string; HOST_PROFILE_R2_SOURCE_ENABLED?: string; PUBLIC_HOST_PROFILE_SOURCE_R2?: HostProfileSourceR2 };
export function loadHostProfileRuntime(): HostProfileEnvironment | null {
  try { return (getCloudflareContext() as { env?: HostProfileEnvironment }).env ?? null; } catch { return null; }
}
