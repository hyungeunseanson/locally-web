import { expect, test } from "@playwright/test";

import profileManifest from "../../app/data/publicHostProfileImages.generated.json";
import { getCloudflarePublicHostProfileImage } from "../../app/utils/cloudflarePublicHostProfileImages";

type ProfileManifestEntry = {
  originUrl: string;
  smallKey: string;
  largeKey: string;
};

const entries = Object.entries(
  profileManifest as Record<string, ProfileManifestEntry>,
);

test.describe("Cloudflare public host profile image boundary", () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL =
      "https://profiles-media.locally-travel.com/";
  });

  test.afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL;
  });

  test("contains only exact public Supabase host profile origins and host namespaces", () => {
    const allKeys: string[] = [];
    for (const [hostId, entry] of entries) {
      expect(hostId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(entry.originUrl).toMatch(
        /^https:\/\/uhinvcydgzqlpnvieyal\.supabase\.co\/storage\/v1\/object\/public\/images\/profile\/[A-Za-z0-9._-]+$/,
      );
      expect(entry.smallKey).toMatch(
        new RegExp(`^hosts/${hostId}/[a-f0-9]{12}/avatar-w128-q80\\.webp$`),
      );
      expect(entry.largeKey).toMatch(
        new RegExp(`^hosts/${hostId}/[a-f0-9]{12}/avatar-w256-q80\\.webp$`),
      );
      allKeys.push(entry.smallKey, entry.largeKey);
    }
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  test("requires exact host id and current origin URL and can be disabled globally", () => {
    const first = entries[0];
    if (!first) return;
    const [hostId, entry] = first;
    expect(
      getCloudflarePublicHostProfileImage(hostId, entry.originUrl),
    ).toEqual({
      smallUrl: `https://profiles-media.locally-travel.com/${entry.smallKey}`,
      largeUrl: `https://profiles-media.locally-travel.com/${entry.largeKey}`,
    });
    expect(
      getCloudflarePublicHostProfileImage(
        hostId,
        `${entry.originUrl}?changed=1`,
      ),
    ).toBeNull();
    expect(
      getCloudflarePublicHostProfileImage(
        "00000000-0000-4000-8000-000000000000",
        entry.originUrl,
      ),
    ).toBeNull();
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL;
    expect(
      getCloudflarePublicHostProfileImage(hostId, entry.originUrl),
    ).toBeNull();
  });

  test("never includes OAuth, generic avatar, or private storage origins", () => {
    const serialized = JSON.stringify(profileManifest);
    expect(serialized).not.toContain("googleusercontent.com");
    expect(serialized).not.toContain("kakaocdn.net");
    expect(serialized).not.toContain("/object/public/avatars/");
    expect(serialized).not.toContain("verification-docs");
    expect(serialized).not.toContain("/chat/");
  });
});
