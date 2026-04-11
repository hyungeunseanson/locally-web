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

test.describe.serial('Guest wishlist/account continuity', () => {
  test('keeps mobile account entry points connected to inbox and wishlist', async ({ page }) => {
    test.setTimeout(90000);

    await prepareEnglishLocale(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const user = createTestUser('guest.account.continuity');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await seedWishlist(userId);

    await login(page, user);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByTestId('account-mobile-profile-card')).toBeVisible({ timeout: 15000 });

    const accountMain = page.getByRole('main');

    await accountMain.getByRole('button', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/\/guest\/inbox/);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('account-mobile-profile-card')).toBeVisible({ timeout: 15000 });

    await accountMain.getByRole('button', { name: 'Wishlist' }).click();
    await expect(page).toHaveURL(/\/guest\/wishlists/);
    await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible();
    await expect(page.locator(`a[href="/experiences/${experience.experienceId}"]`).first()).toBeVisible();
  });

  test('renders seeded wishlist entries and removes them inline without leaving the page', async ({ page }) => {
    test.setTimeout(90000);

    await prepareEnglishLocale(page);

    const user = createTestUser('guest.wishlist.page');
    const userId = await createAuthUser(user, createdAuthUserIds);
    const experience = await seedWishlist(userId);

    await login(page, user);
    await page.goto('/guest/wishlists', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const experienceCard = page.locator(`a[href="/experiences/${experience.experienceId}"]`).first();
    await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible();
    await expect(experienceCard).toBeVisible({ timeout: 15000 });

    await experienceCard.getByRole('button', { name: 'Save to wishlist' }).click();

    await expect(page.getByText('No saved experiences yet')).toBeVisible({ timeout: 15000 });
    await expect(experienceCard).toHaveCount(0);
    await expect
      .poll(async () => {
        const { count, error } = await getAdminClient()
          .from('wishlists')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('experience_id', experience.experienceId);

        if (error) throw error;
        return count ?? 0;
      })
      .toBe(0);
  });
});
