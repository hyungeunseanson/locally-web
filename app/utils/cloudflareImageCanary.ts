import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '@/app/data/publicExperienceCardImages';

export type CloudflareExperienceCardImage = {
  smallUrl: string;
  largeUrl: string;
};

function getCanaryBaseUrl() {
  return process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL?.trim().replace(/\/$/, '');
}

export function getCloudflareExperienceCardImage(
  experienceId: number | string,
  originImageUrl: string
): CloudflareExperienceCardImage | null {
  const baseUrl = getCanaryBaseUrl();
  const image = PUBLIC_EXPERIENCE_CARD_IMAGES[
    String(experienceId) as keyof typeof PUBLIC_EXPERIENCE_CARD_IMAGES
  ];

  if (!baseUrl || !image || originImageUrl !== image.originUrl) {
    return null;
  }

  return {
    smallUrl: `${baseUrl}/${image.smallKey}`,
    largeUrl: `${baseUrl}/${image.largeKey}`,
  };
}

export const getCloudflareImageCanary = getCloudflareExperienceCardImage;
