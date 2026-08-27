import profileImageManifest from "@/app/data/publicHostProfileImages.generated.json";

type PublicHostProfileManifestEntry = {
  originUrl: string;
  smallKey: string;
  largeKey: string;
};

export type CloudflarePublicHostProfileImage = {
  smallUrl: string;
  largeUrl: string;
};

const manifest = profileImageManifest as Record<
  string,
  PublicHostProfileManifestEntry
>;

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL?.trim().replace(
    /\/$/,
    "",
  );
}

export function getCloudflarePublicHostProfileImage(
  hostId: string | null | undefined,
  originImageUrl: string | null | undefined,
): CloudflarePublicHostProfileImage | null {
  const baseUrl = getBaseUrl();
  if (!baseUrl || !hostId || !originImageUrl) return null;

  const image = manifest[hostId];
  if (!image || image.originUrl !== originImageUrl) return null;

  return {
    smallUrl: `${baseUrl}/${image.smallKey}`,
    largeUrl: `${baseUrl}/${image.largeKey}`,
  };
}
