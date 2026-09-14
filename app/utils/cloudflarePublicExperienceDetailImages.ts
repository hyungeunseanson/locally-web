import detailImageManifest from '@/app/data/publicExperienceDetailImages.generated.json';
import {
  getDeterministicPublicExperienceDetailKeys,
  isPublicExperienceDeterministicReaderTarget,
} from '@/app/utils/publicExperienceMediaReader';

type DetailImageManifestEntry = {
  smallKey: string;
  mediumKey: string;
  largeKey: string;
};

export type CloudflarePublicExperienceDetailImage = {
  smallUrl: string;
  mediumUrl: string;
  largeUrl: string;
};

const manifest = detailImageManifest as Record<string, Record<string, DetailImageManifestEntry>>;

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL?.trim().replace(/\/$/, '');
}

export function getCloudflarePublicExperienceDetailImage(
  experienceId: number | string,
  originImageUrl: string,
  r2Eligible = false
): CloudflarePublicExperienceDetailImage | null {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  if (isPublicExperienceDeterministicReaderTarget(experienceId)) {
    const keys = getDeterministicPublicExperienceDetailKeys(
      experienceId,
      originImageUrl,
      r2Eligible
    );
    return keys
      ? {
          smallUrl: `${baseUrl}/${keys.smallKey}`,
          mediumUrl: `${baseUrl}/${keys.mediumKey}`,
          largeUrl: `${baseUrl}/${keys.largeKey}`,
        }
      : null;
  }

  const image = manifest[String(experienceId)]?.[originImageUrl];

  if (!image) return null;

  return {
    smallUrl: `${baseUrl}/${image.smallKey}`,
    mediumUrl: `${baseUrl}/${image.mediumKey}`,
    largeUrl: `${baseUrl}/${image.largeKey}`,
  };
}
