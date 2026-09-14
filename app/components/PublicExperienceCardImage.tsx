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
  r2Eligible?: boolean;
};

export default function PublicExperienceCardImage({
  experienceId,
  originImageUrl,
  alt,
  sizes,
  className,
  eager = false,
  r2Eligible = false,
}: PublicExperienceCardImageProps) {
  const cloudflareImage = getCloudflareExperienceCardImage(
    experienceId,
    originImageUrl,
    r2Eligible
  );
  const targetIdentity = `${String(experienceId)}\u0000${originImageUrl}`;
  const [failedCloudflareTarget, setFailedCloudflareTarget] = useState<{
    identity: string;
    url: string;
  } | null>(null);
  const cloudflareFailed =
    failedCloudflareTarget?.identity === targetIdentity &&
    cloudflareImage?.largeUrl === failedCloudflareTarget.url;

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
          onError={() => setFailedCloudflareTarget({
            identity: targetIdentity,
            url: cloudflareImage.largeUrl,
          })}
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
