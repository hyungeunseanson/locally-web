import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAuthUsers,
  createAuthUser,
  createTestUser,
  getAdminClient,
  getLatestHostExperienceWithOptions,
  login,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdWishlistIds: number[] = [];

type ShareStubMode = 'missing' | 'resolve' | 'abort';
type ClipboardStubMode = 'resolve' | 'reject';

declare global {
  interface Window {
    __copiedText?: string | null;
    __sharePayload?: { title?: string; text?: string; url?: string } | null;
  }
}

test.afterAll(async () => {
  const supabase = getAdminClient();

  for (const wishlistId of createdWishlistIds) {
    await supabase.from('wishlists').delete().eq('id', wishlistId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('wishlists').delete().eq('user_id', userId);
  }

  await cleanupAuthUsers(createdAuthUserIds);
});

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click({ force: true });
    await expect(announcement).toHaveCount(0);
  }
}

async function prepareEnglishLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('app_lang', 'en');
    document.cookie = 'app_lang=en; path=/';
  });
}

async function installShareStubs(page: Page, shareMode: ShareStubMode, clipboardMode: ClipboardStubMode) {
  await page.addInitScript(
    ({ nextShareMode, nextClipboardMode }) => {
      window.__copiedText = null;
      window.__sharePayload = null;

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            if (nextClipboardMode === 'reject') {
              throw new Error('clipboard-denied');
            }

            window.__copiedText = text;
          },
        },
      });

      const shareImpl =
        nextShareMode === 'missing'
          ? undefined
          : async (payload: { title?: string; text?: string; url?: string }) => {
              window.__sharePayload = payload;

              if (nextShareMode === 'abort') {
                throw new DOMException('Share aborted', 'AbortError');
              }
            };

      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: shareImpl,
      });
    },
    { nextShareMode: shareMode, nextClipboardMode: clipboardMode }
  );
}

async function seedWishlist(userId: string) {
  const supabase = getAdminClient();
  const experience = await getLatestHostExperienceWithOptions({ searchAnyHost: true });
  const { data, error } = await supabase
    .from('wishlists')
    .insert({
      user_id: userId,
      experience_id: experience.experienceId,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to seed wishlist fixture.');
  }

  createdWishlistIds.push(Number(data.id));
  return experience;
}

test.describe.serial('Prebooking share guardrails', () => {
  test('falls back to clipboard on experience detail when Web Share is unavailable', async ({ page }) => {
    await prepareEnglishLocale(page);
    await installShareStubs(page, 'missing', 'resolve');
    await page.setViewportSize({ width: 1440, height: 960 });

    const experience = await getLatestHostExperienceWithOptions({ searchAnyHost: true });

    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(page.getByText('Link copied.')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => window.__copiedText ?? null), { timeout: 15000 })
      .toBe(page.url());
  });

  test('ignores an aborted share sheet on experience detail without showing a failure toast', async ({ page }) => {
    await prepareEnglishLocale(page);
    await installShareStubs(page, 'abort', 'resolve');
    await page.setViewportSize({ width: 1440, height: 960 });

    const experience = await getLatestHostExperienceWithOptions({ searchAnyHost: true });

    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await page.getByRole('button', { name: 'Share' }).click();

    await expect
      .poll(() => page.evaluate(() => window.__copiedText ?? null), { timeout: 15000 })
      .toBe(null);
    await expect(page.getByText('Share failed. Please try again.')).toHaveCount(0);
    await expect(page.getByText('Link copied.')).toHaveCount(0);
  });

  test('shows a localized failure toast on experience detail when clipboard fallback also fails', async ({ page }) => {
    await prepareEnglishLocale(page);
    await installShareStubs(page, 'missing', 'reject');
    await page.setViewportSize({ width: 1440, height: 960 });

    const experience = await getLatestHostExperienceWithOptions({ searchAnyHost: true });

    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await page.getByRole('button', { name: 'Share' }).click();

    await expect(page.getByText('Share failed. Please try again.')).toBeVisible({ timeout: 15000 });
  });

  test('uses Web Share on wishlist cards when available', async ({ page }) => {
    await prepareEnglishLocale(page);
    await installShareStubs(page, 'resolve', 'resolve');
    await page.setViewportSize({ width: 1440, height: 960 });

    const user = createTestUser('guest.wishlist.share.web');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await seedWishlist(userId);

    await login(page, user);
    await page.goto('/guest/wishlists', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const experienceCard = page.locator(`a[href="/experiences/${experience.experienceId}"]`).first();
    await expect(experienceCard).toBeVisible({ timeout: 15000 });

    await experienceCard.getByRole('button', { name: 'Share' }).click();

    const expectedUrl = `${new URL(page.url()).origin}/experiences/${experience.experienceId}`;
    await expect
      .poll(async () => {
        const payload = await page.evaluate(() => window.__sharePayload ?? null);
        return payload?.url ?? null;
      }, { timeout: 15000 })
      .toBe(expectedUrl);
    await expect
      .poll(() => page.evaluate(() => window.__copiedText ?? null), { timeout: 15000 })
      .toBe(null);
    await expect(page.getByText('Share is ready.')).toBeVisible({ timeout: 15000 });
  });

  test('falls back to clipboard on wishlist cards when Web Share is unavailable', async ({ page }) => {
    await prepareEnglishLocale(page);
    await installShareStubs(page, 'missing', 'resolve');
    await page.setViewportSize({ width: 1440, height: 960 });

    const user = createTestUser('guest.wishlist.share.clipboard');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await seedWishlist(userId);

    await login(page, user);
    await page.goto('/guest/wishlists', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const experienceCard = page.locator(`a[href="/experiences/${experience.experienceId}"]`).first();
    await expect(experienceCard).toBeVisible({ timeout: 15000 });

    await experienceCard.getByRole('button', { name: 'Share' }).click();

    await expect
      .poll(() => page.evaluate(() => window.__copiedText ?? null), { timeout: 15000 })
      .toContain(`/experiences/${experience.experienceId}`);
    await expect(page.getByText('Share is ready.')).toBeVisible({ timeout: 15000 });
  });

  test('ignores an aborted share sheet on wishlist cards without surfacing an error toast', async ({ page }) => {
    await prepareEnglishLocale(page);
    await installShareStubs(page, 'abort', 'resolve');
    await page.setViewportSize({ width: 1440, height: 960 });

    const user = createTestUser('guest.wishlist.share.abort');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await seedWishlist(userId);

    await login(page, user);
    await page.goto('/guest/wishlists', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const experienceCard = page.locator(`a[href="/experiences/${experience.experienceId}"]`).first();
    await expect(experienceCard).toBeVisible({ timeout: 15000 });

    await experienceCard.getByRole('button', { name: 'Share' }).click();

    await expect
      .poll(() => page.evaluate(() => window.__copiedText ?? null), { timeout: 15000 })
      .toBe(null);
    await expect(page.getByText('Share failed. Please try again.')).toHaveCount(0);
    await expect(page.getByText('Share is ready.')).toHaveCount(0);
  });
});
