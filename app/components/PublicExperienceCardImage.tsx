'use client';

import { useState } from 'react';
import Image from 'next/image';

import { getCloudflareExperienceCardImage } from '@/app/utils/cloudflareImageCanary';

type PublicExperienceCardImageProps = {
  experienceId: number | string;
  originImageUrl: string;
  alt: string;
  sizes: string;
  className: string;
  eager?: boolean;
};

export default function PublicExperienceCardImage({
  experienceId,
  originImageUrl,
  alt,
  sizes,
  className,
  eager = false,
}: PublicExperienceCardImageProps) {
  const cloudflareImage = getCloudflareExperienceCardImage(experienceId, originImageUrl);
  const [failedCloudflareUrl, setFailedCloudflareUrl] = useState<string | null>(null);
  const cloudflareFailed = cloudflareImage?.largeUrl === failedCloudflareUrl;

  if (cloudflareImage && !cloudflareFailed) {
    return (
      <picture>
        <source
          srcSet={`${cloudflareImage.smallUrl} 384w, ${cloudflareImage.largeUrl} 640w`}
          sizes={sizes}
          type="image/webp"
        />
        <img
          src={cloudflareImage.largeUrl}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedCloudflareUrl(cloudflareImage.largeUrl)}
          className={`absolute inset-0 h-full w-full ${className}`}
          data-image-delivery="cloudflare-r2"
        />
      </picture>
    );
  }

  return (
    <Image
      src={originImageUrl}
      alt={alt}
      fill
      quality={65}
      unoptimized
      loading={eager ? 'eager' : 'lazy'}
      className={className}
      sizes={sizes}
      data-image-delivery={cloudflareImage ? 'supabase-fallback' : 'supabase'}
    />
  );
}
