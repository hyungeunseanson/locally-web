"use client";

import { useEffect, useRef, useState } from "react";

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const useCloudflare = Boolean(
    cloudflareImage && cloudflareImage.largeUrl !== failedCloudflareUrl,
  );

  useEffect(() => {
    if (!useCloudflare || !cloudflareImage) return;
    const frame = window.requestAnimationFrame(() => {
      const image = imageRef.current;
      if (image?.complete && image.naturalWidth === 0) {
        setFailedCloudflareUrl(cloudflareImage.largeUrl);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cloudflareImage, useCloudflare]);

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
    // Immutable public R2 variants bypass framework image transformation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
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
