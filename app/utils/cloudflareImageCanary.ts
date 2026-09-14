import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '@/app/data/publicExperienceCardImages';
import {
  getDeterministicPublicExperienceCardKeys,
  isPublicExperienceDeterministicReaderTarget,
} from '@/app/utils/publicExperienceMediaReader';

export type CloudflareExperienceCardImage = {
  smallUrl: string;
  largeUrl: string;
};

function getCanaryBaseUrl() {
  return process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL?.trim().replace(/\/$/, '');
}

export function getCloudflareExperienceCardImage(
  experienceId: number | string,
  originImageUrl: string,
  r2Eligible = false
): CloudflareExperienceCardImage | null {
  const baseUrl = getCanaryBaseUrl();
  if (!baseUrl) return null;

  if (isPublicExperienceDeterministicReaderTarget(experienceId)) {
    const keys = getDeterministicPublicExperienceCardKeys(
      experienceId,
      originImageUrl,
      r2Eligible
    );
    return keys
      ? {
          smallUrl: `${baseUrl}/${keys.smallKey}`,
          largeUrl: `${baseUrl}/${keys.largeKey}`,
        }
      : null;
  }

  const image = PUBLIC_EXPERIENCE_CARD_IMAGES[
    String(experienceId) as keyof typeof PUBLIC_EXPERIENCE_CARD_IMAGES
  ];

  if (!image || originImageUrl !== image.originUrl) {
    return null;
  }

  return {
    smallUrl: `${baseUrl}/${image.smallKey}`,
    largeUrl: `${baseUrl}/${image.largeKey}`,
  };
}

export const getCloudflareImageCanary = getCloudflareExperienceCardImage;
