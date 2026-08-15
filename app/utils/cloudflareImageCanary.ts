const CANARY_EXPERIENCE_ID = '4523';
const CANARY_ORIGIN_IMAGE_URL =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/0288da66-8322-447c-bf80-bff314ee7299/hero/1786530514581_1786530514581-xj0z0lli.png';

const CANARY_IMAGE_KEYS = {
  small: 'experience-4523-primary-w384-q65.webp',
  large: 'experience-4523-primary-w640-q65.webp',
} as const;

export type CloudflareImageCanary = {
  smallUrl: string;
  largeUrl: string;
};

function getCanaryBaseUrl() {
  return process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL?.trim().replace(/\/$/, '');
}

export function getCloudflareImageCanary(
  experienceId: number | string,
  originImageUrl: string
): CloudflareImageCanary | null {
  const baseUrl = getCanaryBaseUrl();

  if (
    !baseUrl ||
    String(experienceId) !== CANARY_EXPERIENCE_ID ||
    originImageUrl !== CANARY_ORIGIN_IMAGE_URL
  ) {
    return null;
  }

  return {
    smallUrl: `${baseUrl}/${CANARY_IMAGE_KEYS.small}`,
    largeUrl: `${baseUrl}/${CANARY_IMAGE_KEYS.large}`,
  };
}
