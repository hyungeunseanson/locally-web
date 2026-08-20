'use client';

import Image from 'next/image';
import { useState } from 'react';

import { getCloudflarePublicExperienceDetailImage } from '@/app/utils/cloudflarePublicExperienceDetailImages';

type PublicExperienceDetailImageProps = {
  experienceId: number | string;
  originImageUrl: string;
  alt: string;
  sizes: string;
  className: string;
  eager?: boolean;
};

export default function PublicExperienceDetailImage({
  experienceId,
  originImageUrl,
  alt,
  sizes,
  className,
  eager = false,
}: PublicExperienceDetailImageProps) {
  const cloudflareImage = getCloudflarePublicExperienceDetailImage(experienceId, originImageUrl);
  const [failedCloudflareUrl, setFailedCloudflareUrl] = useState<string | null>(null);
  const cloudflareFailed = cloudflareImage?.largeUrl === failedCloudflareUrl;

  if (cloudflareImage && !cloudflareFailed) {
    return (
      <picture>
        <source
          srcSet={`${cloudflareImage.smallUrl} 480w, ${cloudflareImage.mediumUrl} 960w, ${cloudflareImage.largeUrl} 1440w`}
          sizes={sizes}
          type="image/webp"
        />
        <img
          src={cloudflareImage.mediumUrl}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedCloudflareUrl(cloudflareImage.largeUrl)}
          className={`absolute inset-0 h-full w-full ${className}`}
          data-detail-image-delivery="cloudflare-r2"
        />
      </picture>
    );
  }

  return (
    <Image
      src={originImageUrl}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized
      loading={eager ? 'eager' : 'lazy'}
      className={className}
      data-detail-image-delivery={cloudflareImage ? 'supabase-fallback' : 'supabase'}
    />
  );
}
