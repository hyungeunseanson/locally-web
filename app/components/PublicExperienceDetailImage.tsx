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
  r2Eligible?: boolean;
};

export default function PublicExperienceDetailImage({
  experienceId,
  originImageUrl,
  alt,
  sizes,
  className,
  eager = false,
  r2Eligible = false,
}: PublicExperienceDetailImageProps) {
  const cloudflareImage = getCloudflarePublicExperienceDetailImage(
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
          srcSet={`${cloudflareImage.smallUrl} 480w, ${cloudflareImage.mediumUrl} 960w, ${cloudflareImage.largeUrl} 1440w`}
          sizes={sizes}
          type="image/webp"
        />
        <img
          src={cloudflareImage.mediumUrl}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedCloudflareTarget({
            identity: targetIdentity,
            url: cloudflareImage.largeUrl,
          })}
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
