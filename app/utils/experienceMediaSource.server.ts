import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { ExperienceMediaSourceR2 } from './experienceMediaSource';
import migrationManifest from '@/config/cloudflare/migration-manifest.json';
export * from './experienceMediaSource';

type RuntimeEnvironment = {
  CLOUDFLARE_DEPLOYMENT_ENV?: string;
  EXPERIENCE_MEDIA_R2_SOURCE_ENABLED?: string;
  PUBLIC_EXPERIENCE_MEDIA_R2?: ExperienceMediaSourceR2;
};

export function loadExperienceMediaSourceRuntime() {
  try {
    return (getCloudflareContext() as { env?: RuntimeEnvironment }).env ?? null;
  } catch {
    return null;
  }
}

export function repositoryProductionR2SourceDefaultEnabled() {
  return migrationManifest.experienceMediaSourceReleasePolicy.defaultProductionProfile === 'on';
}
