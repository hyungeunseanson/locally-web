"use client";

import { useState } from "react";

import { getCloudflarePublicHostProfileImage } from "@/app/utils/cloudflarePublicHostProfileImages";

type PublicHostProfileImageProps = {
  hostId: string | null | undefined;
  originImageUrl: string;
  alt: string;
  sizes: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export default function PublicHostProfileImage({
  hostId,
  originImageUrl,
  alt,
  sizes,
  className = "object-cover",
  loading = "lazy",
}: PublicHostProfileImageProps) {
  const cloudflareImage = getCloudflarePublicHostProfileImage(
    hostId,
    originImageUrl,
  );
  const [failedCloudflareUrl, setFailedCloudflareUrl] = useState<string | null>(
    null,
  );
  const useCloudflare = Boolean(
    cloudflareImage && cloudflareImage.largeUrl !== failedCloudflareUrl,
  );

  if (!useCloudflare || !cloudflareImage) {
    return (
      // Public host profile origins remain the canonical fallback and are intentionally unoptimized.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={originImageUrl}
        alt={alt}
        sizes={sizes}
        loading={loading}
        className={`h-full w-full ${className}`}
        data-host-profile-image-delivery="supabase-fallback"
      />
    );
  }

  return (
    // The immutable R2 variants bypass Vercel Image Optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cloudflareImage.largeUrl}
      srcSet={`${cloudflareImage.smallUrl} 128w, ${cloudflareImage.largeUrl} 256w`}
      sizes={sizes}
      alt={alt}
      loading={loading}
      className={`h-full w-full ${className}`}
      data-host-profile-image-delivery="cloudflare-r2"
      onError={() => setFailedCloudflareUrl(cloudflareImage.largeUrl)}
    />
  );
}
