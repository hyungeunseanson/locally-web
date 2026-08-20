import detailImageManifest from '@/app/data/publicExperienceDetailImages.generated.json';

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
  originImageUrl: string
): CloudflarePublicExperienceDetailImage | null {
  const baseUrl = getBaseUrl();
  const image = manifest[String(experienceId)]?.[originImageUrl];

  if (!baseUrl || !image) return null;

  return {
    smallUrl: `${baseUrl}/${image.smallKey}`,
    mediumUrl: `${baseUrl}/${image.mediumKey}`,
    largeUrl: `${baseUrl}/${image.largeKey}`,
  };
}
