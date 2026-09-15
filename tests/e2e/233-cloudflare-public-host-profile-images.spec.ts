import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

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
const BASE_URL = "https://profiles-media.locally-travel.com";
const VALID_WEBP = Buffer.from("UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoCAAIAAUAmJQBOgC6gAP77LkvF3YjjJ4dVU9ffoAA=", "base64");
const fixtureDirectory = path.resolve("tests/fixtures/public-host-profile-reader");
const fixtureOutput = mkdtempSync(path.join(os.tmpdir(), "locally-profile-reader-"));
let clientBundlePath = "";
let renderProfileHarness: (configuration: { hostId: string; originImageUrl: string }) => string;

async function buildHarness() {
  const define = {
    "process.env.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL": JSON.stringify(BASE_URL),
  };
  const serverPath = path.join(fixtureOutput, "server.cjs");
  clientBundlePath = path.join(fixtureOutput, "client.js");
  await Promise.all([
    build({ entryPoints: [path.join(fixtureDirectory, "ProfileHarness.server.tsx")], outfile: serverPath, bundle: true, platform: "node", format: "cjs", define, logLevel: "silent" }),
    build({ entryPoints: [path.join(fixtureDirectory, "ProfileHarness.client.tsx")], outfile: clientBundlePath, bundle: true, platform: "browser", format: "iife", define, logLevel: "silent" }),
  ]);
  ({ renderProfileHarness } = await import(`${pathToFileURL(serverPath).href}?profile-reader`));
}

async function mount(page: Page, configuration: { hostId: string; originImageUrl: string }, hydrate = false) {
  await page.setContent(`<main id="root">${hydrate ? renderProfileHarness(configuration) : ""}</main>`);
  await page.addScriptTag({ path: clientBundlePath });
  await page.evaluate(({ configuration: next, hydrate: shouldHydrate }) => {
    if (shouldHydrate) window.publicHostProfileHarness.hydrate(next);
    else window.publicHostProfileHarness.mount(next);
  }, { configuration, hydrate });
}

test.describe("Cloudflare public host profile image boundary", () => {
  test.beforeAll(buildHarness);

  test.afterAll(() => rmSync(fixtureOutput, { recursive: true, force: true }));
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
        /^https:\/\/uhinvcydgzqlpnvieyal\.supabase\.co\/storage\/v1\/object\/public\/(?:images\/profile\/[A-Za-z0-9._-]+|avatars\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)$/,
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

  test("never includes OAuth or private storage origins", () => {
    const serialized = JSON.stringify(profileManifest);
    expect(serialized).not.toContain("googleusercontent.com");
    expect(serialized).not.toContain("kakaocdn.net");
    expect(serialized).not.toContain("verification-docs");
    expect(serialized).not.toContain("/chat/");
  });

  test("hydrates consistently and falls back on R2 404 or network failure", async ({ page }) => {
    const [hostId, entry] = entries[0]!;
    const hydrationErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error" && /hydration/i.test(message.text())) hydrationErrors.push(message.text()); });
    await page.route(/^https:\/\/profiles-media\.locally-travel\.com\//, (route) => route.fulfill({ status: 404 }));
    await page.route(entry.originUrl, (route) => route.fulfill({ status: 200, contentType: "image/webp", body: VALID_WEBP }));
    await mount(page, { hostId, originImageUrl: entry.originUrl }, true);
    const image = page.locator("img");
    await expect(image).toHaveAttribute("data-host-profile-image-delivery", "supabase-fallback");
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    expect(hydrationErrors).toEqual([]);

    await page.unrouteAll();
    await page.route(/^https:\/\/profiles-media\.locally-travel\.com\//, (route) => route.abort("connectionfailed"));
    await page.route(entry.originUrl, (route) => route.fulfill({ status: 200, contentType: "image/webp", body: VALID_WEBP }));
    await mount(page, { hostId, originImageUrl: entry.originUrl });
    await expect(page.locator("img")).toHaveAttribute("data-host-profile-image-delivery", "supabase-fallback");
  });

  test("clears an old R2 failure when the mounted subject/origin changes and does not loop when fallback fails", async ({ page }) => {
    const [first, second] = entries.slice(0, 2);
    if (!first || !second) return;
    let firstR2Requests = 0;
    let firstOriginRequests = 0;
    await page.route(/^https:\/\/profiles-media\.locally-travel\.com\//, async (route) => {
      if (route.request().url().includes(`hosts/${first[0]}/`)) {
        firstR2Requests += 1;
        await route.fulfill({ status: 404 });
      } else {
        await route.fulfill({ status: 200, contentType: "image/webp", body: VALID_WEBP });
      }
    });
    await page.route(first[1].originUrl, async (route) => {
      firstOriginRequests += 1;
      await route.fulfill({ status: 404 });
    });
    await mount(page, { hostId: first[0], originImageUrl: first[1].originUrl });
    await expect(page.locator("img")).toHaveAttribute("data-host-profile-image-delivery", "supabase-fallback");
    await page.waitForTimeout(100);
    expect(firstR2Requests).toBe(1);
    expect(firstOriginRequests).toBeLessThanOrEqual(1);

    await page.evaluate((configuration) => window.publicHostProfileHarness.update(configuration), {
      hostId: second[0], originImageUrl: second[1].originUrl,
    });
    await expect(page.locator("img")).toHaveAttribute("data-host-profile-image-delivery", "cloudflare-r2");
    await expect.poll(() => page.locator("img").evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  });
});
