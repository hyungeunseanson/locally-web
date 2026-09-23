import { build } from 'esbuild';
import { expect, test, type Page } from '@playwright/test';

import {
  findGuestReviewDeepLinkTrip,
  findHostGuestReviewDeepLinkBooking,
  getGuestReviewRequestHref,
  getHostGuestReviewRequestHref,
  getReviewRequestNotificationHref,
} from '@/app/utils/reviews/reviewRequestDeepLinks';
import { deliverHostGuestReviewRequestsForCompletedBookings } from '@/app/utils/reviews/hostGuestReviewRequestNotification';

const guestTrip = {
  id: 'owned-booking', expId: 'experience-1', title: '체험', status: 'completed',
  reviewEligible: true, hasReview: false, review: null,
};
const hostReservation = {
  id: 'owned-booking', experience_id: 'experience-1', status: 'completed', reviewEligible: true,
};

test('request email and notifications use the same booking-specific links, including legacy RPC rows', async () => {
  expect(getGuestReviewRequestHref('booking 1')).toBe('/guest/trips?reviewBookingId=booking%201');
  expect(getHostGuestReviewRequestHref('booking 1')).toBe(
    '/host/dashboard?tab=reservations&reservationTab=completed&reviewBookingId=booking%201'
  );
  expect(getReviewRequestNotificationHref({ type: 'review_request', booking_id: 'owned-booking', link: '/guest/trips' }))
    .toBe(getGuestReviewRequestHref('owned-booking'));
  expect(getReviewRequestNotificationHref({ type: 'guest_review_request', booking_id: 'owned-booking', link: '/host/dashboard?tab=reservations' }))
    .toBe(getHostGuestReviewRequestHref('owned-booking'));
  expect(getReviewRequestNotificationHref({ type: 'review_request', link: '/guest/trips' })).toBe('/guest/trips');

  const updatedLinks: string[] = [];
  const emailedLinks: string[] = [];
  const client = {
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { preferred_locale: 'ko' } } }, error: null }) } },
    from(table: string) {
      if (table === 'bookings') return { select: () => ({ in: async () => ({
        data: [{ id: 'owned-booking', user_id: 'guest-1', experiences: { host_id: 'host-1', title: '체험' } }], error: null,
      }) }) };
      return {
        select: () => ({ eq: () => ({ in: async () => ({
          data: [{ id: 1, user_id: 'host-1', booking_id: 'owned-booking' }], error: null,
        }) }) }),
        update: (row: { link: string }) => {
          updatedLinks.push(row.link);
          const query = { eq: () => query, then: (resolve: (value: { error: null }) => void) => resolve({ error: null }) };
          return query;
        },
      };
    },
  };
  const result = await deliverHostGuestReviewRequestsForCompletedBookings({
    supabaseAdmin: client as never,
    completedBookingIds: ['owned-booking'],
    sendEmail: async (request) => {
      emailedLinks.push(request.templatedEmail.payload.ctaUrl);
      return { sent: true } as never;
    },
  });
  expect(result).toEqual({ processedCount: 1, failedCount: 0 });
  expect(updatedLinks).toEqual([getHostGuestReviewRequestHref('owned-booking')]);
  expect(emailedLinks).toEqual(updatedLinks);
});

test('selectors fail closed for another user or host, reviewed, ineligible, and invalid bookings', () => {
  expect(findGuestReviewDeepLinkTrip([guestTrip], 'owned-booking')).toEqual(guestTrip);
  expect(findGuestReviewDeepLinkTrip([guestTrip], 'other-user-booking')).toBeNull();
  expect(findGuestReviewDeepLinkTrip([{ ...guestTrip, hasReview: true }], 'owned-booking')).toBeNull();
  expect(findGuestReviewDeepLinkTrip([{ ...guestTrip, reviewEligible: false }], 'owned-booking')).toBeNull();
  expect(findGuestReviewDeepLinkTrip([{ ...guestTrip, status: 'cancelled' }], 'owned-booking')).toBeNull();
  expect(findGuestReviewDeepLinkTrip([guestTrip], 'invalid-booking')).toBeNull();

  const ownedExperienceIds = new Set(['experience-1']);
  expect(findHostGuestReviewDeepLinkBooking([hostReservation], 'owned-booking', ownedExperienceIds, new Set()))
    .toEqual(hostReservation);
  expect(findHostGuestReviewDeepLinkBooking([hostReservation], 'other-host-booking', ownedExperienceIds, new Set()))
    .toBeNull();
  expect(findHostGuestReviewDeepLinkBooking([{ ...hostReservation, experience_id: 'foreign-experience' }], 'owned-booking', ownedExperienceIds, new Set()))
    .toBeNull();
  expect(findHostGuestReviewDeepLinkBooking([hostReservation], 'owned-booking', ownedExperienceIds, new Set(['owned-booking'])))
    .toBeNull();
  expect(findHostGuestReviewDeepLinkBooking([{ ...hostReservation, reviewEligible: false }], 'owned-booking', ownedExperienceIds, new Set()))
    .toBeNull();
  expect(findHostGuestReviewDeepLinkBooking([hostReservation], 'invalid-booking', ownedExperienceIds, new Set()))
    .toBeNull();
});

async function bundleComponent(component: 'guest' | 'host') {
  const entry = component === 'guest' ? './app/guest/trips/page' : './app/host/dashboard/components/ReservationManager';
  const mocked = new Set([
    'next/navigation', 'next/link', 'next/image',
    '@/app/context/LanguageContext', '@/app/context/NotificationContext', '@/app/context/ToastContext',
    '@/app/utils/supabase/client', '@/app/components/SiteHeader', '@/app/components/ReviewModal',
    '@/app/components/ui/Spinner', '@/app/components/ui/Skeleton', '@/app/components/EmptyState',
    '@/app/components/ui/ConfirmModal', '@/app/utils/services/concierge', '@/app/constants/serviceStatus',
    './hooks/useGuestTrips', './components/TripCard', './components/ReceiptModal',
    './ReservationCard', './GuestProfileModal', './GuestReviewModal',
  ]);
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import Component from '${entry}'; window.mountDeepLinkPage = () => createRoot(document.getElementById('fixture')).render(React.createElement(Component));`,
      resolveDir: process.cwd(), loader: 'js',
    },
    bundle: true, format: 'iife', platform: 'browser', write: false,
    plugins: [{ name: 'deep-link-ui-fixtures', setup(api) {
      api.onResolve({ filter: /.*/ }, (args) => mocked.has(args.path) ? { path: args.path, namespace: 'deep-link-fixture' } : null);
      api.onLoad({ filter: /.*/, namespace: 'deep-link-fixture' }, (args) => {
        const path = args.path;
        if (path === 'next/navigation') return { contents: `export const useRouter = () => ({ push: (href) => window.deepLinkFixture.routePushes.push(href), back: () => {} }); export const useSearchParams = () => new URLSearchParams(window.location.search);`, loader: 'js' };
        if (path === 'next/link') return { contents: `import React from 'react'; export default function Link({ children, href, ...props }) { return React.createElement('a', { href, ...props }, children); }`, loader: 'js', resolveDir: process.cwd() };
        if (path === 'next/image') return { contents: `export default function Image() { return null; }`, loader: 'js' };
        if (path.endsWith('LanguageContext')) return { contents: `const t = (key, vars) => vars?.count === undefined ? key : key + ' ' + vars.count; export const useLanguage = () => ({ t, lang: 'ko' });`, loader: 'js' };
        if (path.endsWith('NotificationContext')) return { contents: `export const useNotification = () => ({ notifications: [] });`, loader: 'js' };
        if (path.endsWith('ToastContext')) return { contents: `const showToast = () => {}; export const useToast = () => ({ showToast });`, loader: 'js' };
        if (path.endsWith('supabase/client')) return { contents: `export const createClient = () => window.deepLinkFixture.supabase;`, loader: 'js' };
        if (path.endsWith('useGuestTrips')) return { contents: `export const useGuestTrips = () => window.deepLinkFixture.tripsHook;`, loader: 'js' };
        if (path.endsWith('GuestReviewModal')) return { contents: `import React from 'react'; export default function Modal({ booking }) { return React.createElement('div', { 'data-testid': 'guest-review-modal' }, String(booking.id)); }`, loader: 'js', resolveDir: process.cwd() };
        if (path.endsWith('ReviewModal')) return { contents: `import React from 'react'; export default function Modal({ trip }) { return React.createElement('div', { 'data-testid': 'review-modal' }, String(trip.id)); }`, loader: 'js', resolveDir: process.cwd() };
        if (path.endsWith('ReservationCard')) return { contents: `import React from 'react'; export default function Card({ res }) { return React.createElement('div', { 'data-testid': 'reservation-card' }, String(res.id)); }`, loader: 'js', resolveDir: process.cwd() };
        if (path.endsWith('Skeleton')) return { contents: `export default function Skeleton() { return null; }`, loader: 'js' };
        if (path.endsWith('EmptyState')) return { contents: `export default function EmptyState() { return 'empty state'; }`, loader: 'js' };
        if (path.endsWith('concierge')) return { contents: `export const getServiceTypeLabel = () => 'service';`, loader: 'js' };
        if (path.endsWith('serviceStatus')) return { contents: `export const getServiceRequestStatusLabel = () => 'status';`, loader: 'js' };
        return { contents: `export default function Placeholder() { return null; }`, loader: 'js' };
      });
    }}],
  });
  return bundle.outputFiles[0].text;
}

async function openFixture(page: Page, query: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLLinkElement).href)
  );
  await page.route('**/review-deep-link-fixture*', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<html><head>${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><main id="fixture"></main></body></html>`,
  }));
  await page.goto(`/review-deep-link-fixture${query}`);
}

async function mountFixture(page: Page, bundle: string) {
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => (window as typeof window & { mountDeepLinkPage: () => void }).mountDeepLinkPage());
}

async function installGuestFixture(page: Page, trips: Array<Record<string, unknown>>) {
  await page.evaluate((ownedTrips) => {
    const state = {
      refreshCount: 0,
      routePushes: [] as string[],
      supabase: { auth: { getUser: async () => ({ data: { user: { id: 'guest-1' } }, error: null }) } },
      tripsHook: {
        upcomingTrips: [], pastTrips: ownedTrips, isLoading: false, errorMsg: '', requestCancel: async () => false,
        isProcessing: false, refreshTrips: async () => {
          state.refreshCount += 1;
          return { data: { trips: ownedTrips }, isError: false };
        },
      },
    };
    (window as typeof window & { deepLinkFixture: unknown }).deepLinkFixture = state;
    window.fetch = async () => Response.json({ success: true, data: [] });
  }, trips);
}

async function installHostFixture(page: Page, options: { bookingExperienceId?: string; reviewed?: boolean } = {}) {
  await page.evaluate(({ bookingExperienceId, reviewed }) => {
    const booking = {
      id: 'owned-booking', order_id: 'ORDER-1', user_id: 'guest-1', experience_id: bookingExperienceId || 'experience-1',
      created_at: '2020-01-01T00:00:00Z', date: '2020-01-01', time: '10:00', status: 'completed',
      payment_method: 'bank', experiences: { title: '체험', duration: 2 },
    };
    const channel = { on: () => channel, subscribe: () => channel };
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'host-1' } }, error: null }) },
      channel: () => channel, removeChannel: () => {},
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => table === 'experiences'
            ? Promise.resolve({ data: [{ id: 'experience-1' }], error: null })
            : table === 'bookings'
              ? Promise.resolve({ data: booking.experience_id === 'experience-1' ? [booking] : [], error: null })
              : query,
          in: async () => table === 'guest_reviews'
            ? { data: reviewed ? [{ booking_id: 'owned-booking' }] : [], error: null }
            : { data: [{ id: 'guest-1', full_name: '게스트' }], error: null },
        };
        return query;
      },
    };
    (window as typeof window & { deepLinkFixture: unknown }).deepLinkFixture = { supabase };
    window.fetch = async () => Response.json({ success: true, memberships: {} });
  }, options);
}

test('guest deep link opens the requested modal and plain trips entry stays ordinary at 390px', async ({ page }) => {
  const bundle = await bundleComponent('guest');
  await openFixture(page, '?reviewBookingId=owned-booking');
  await installGuestFixture(page, [{ ...guestTrip, id: 'another-owned-booking' }, guestTrip]);
  await mountFixture(page, bundle);
  await expect(page.getByTestId('review-modal')).toHaveText('owned-booking');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await openFixture(page, '');
  await installGuestFixture(page, [guestTrip]);
  await mountFixture(page, bundle);
  await expect(page.getByRole('heading', { name: 'my_trips' })).toBeVisible();
  await expect(page.getByTestId('review-modal')).toHaveCount(0);
});

test('eligible unfinished past trip shows a touch-sized CTA and count; CTA opens review without navigating', async ({ page }) => {
  const bundle = await bundleComponent('guest');
  await openFixture(page, '');
  await installGuestFixture(page, [guestTrip]);
  await mountFixture(page, bundle);

  const cta = page.locator('button:visible', { hasText: 'trip_review' });
  await expect(cta).toBeVisible();
  expect((await cta.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('p:visible', { hasText: 'trip_reviews_to_write 1' })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await cta.click();
  await expect(page.getByTestId('review-modal')).toHaveText('owned-booking');
  expect(await page.evaluate(() => (window as typeof window & { deepLinkFixture: { routePushes: string[] } }).deepLinkFixture.routePushes)).toEqual([]);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('button:visible', { hasText: 'trip_review' })).toBeVisible();
  await expect(page.locator('p:visible', { hasText: 'trip_reviews_to_write 1' })).toHaveCount(1);
});

test('reviewed, ineligible, and cancelled past trips have no new CTA or pending count', async ({ page }) => {
  const bundle = await bundleComponent('guest');
  for (const trip of [
    { ...guestTrip, hasReview: true, review: { id: 7 } },
    { ...guestTrip, reviewEligible: false },
    { ...guestTrip, status: 'cancelled' },
  ]) {
    await openFixture(page, '');
    await installGuestFixture(page, [trip]);
    await mountFixture(page, bundle);
    await expect(page.locator('button:visible', { hasText: 'trip_review' })).toHaveCount(0);
    await expect(page.locator('p:visible', { hasText: 'trip_reviews_to_write' })).toHaveCount(0);
    if (trip.hasReview) {
      await expect(page.getByText('status_review_done').filter({ visible: true })).toBeVisible();
      await expect(page.locator('button:visible', { hasText: 'action_edit' })).toBeVisible();
    }
  }
});

test('the past trip card still opens its experience detail when its body is clicked', async ({ page }) => {
  const bundle = await bundleComponent('guest');
  await openFixture(page, '');
  await installGuestFixture(page, [guestTrip]);
  await mountFixture(page, bundle);
  await page.getByText('체험', { exact: true }).filter({ visible: true }).first().click();
  expect(await page.evaluate(() => (window as typeof window & { deepLinkFixture: { routePushes: string[] } }).deepLinkFixture.routePushes))
    .toEqual(['/experiences/experience-1']);
});

test('guest UI keeps ordinary trips for a foreign, reviewed, or invalid booking link', async ({ page }) => {
  const bundle = await bundleComponent('guest');
  for (const trips of [[guestTrip], [{ ...guestTrip, hasReview: true }], []]) {
    await openFixture(page, `?reviewBookingId=${trips[0]?.hasReview ? 'owned-booking' : trips.length ? 'foreign-booking' : 'invalid-booking'}`);
    await installGuestFixture(page, trips);
    await mountFixture(page, bundle);
    await page.waitForFunction(() => (window as typeof window & { deepLinkFixture: { refreshCount: number } }).deepLinkFixture.refreshCount === 1);
    await expect(page.getByTestId('review-modal')).toHaveCount(0);
  }
});

test('host deep link selects completed and opens only its own unreviewed reservation at 390px', async ({ page }) => {
  const bundle = await bundleComponent('host');
  await openFixture(page, '?tab=reservations&reservationTab=completed&reviewBookingId=owned-booking');
  await installHostFixture(page);
  await mountFixture(page, bundle);
  await expect(page.getByTestId('guest-review-modal')).toHaveText('owned-booking');
  await expect(page.getByTestId('reservation-card')).toHaveText('owned-booking');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('host UI fails closed for another host, an already reviewed booking, and plain reservations', async ({ page }) => {
  const bundle = await bundleComponent('host');
  for (const scenario of [
    { query: '?tab=reservations&reservationTab=completed&reviewBookingId=owned-booking', options: { bookingExperienceId: 'foreign-experience' } },
    { query: '?tab=reservations&reservationTab=completed&reviewBookingId=owned-booking', options: { reviewed: true } },
    { query: '?tab=reservations&reservationTab=completed&reviewBookingId=invalid-booking', options: {} },
    { query: '?tab=reservations', options: {} },
  ]) {
    await openFixture(page, scenario.query);
    await installHostFixture(page, scenario.options);
    await mountFixture(page, bundle);
    await expect(page.getByRole('button', { name: 'res_tab_past' })).toBeVisible();
    if (scenario.options.reviewed || scenario.query.includes('invalid-booking')) {
      await expect(page.getByTestId('reservation-card')).toBeVisible();
    } else {
      await expect(page.getByText('empty state')).toBeVisible();
    }
    await expect(page.getByTestId('guest-review-modal')).toHaveCount(0);
    if (scenario.query === '?tab=reservations') {
      await expect(page.getByRole('button', { name: 'tab_upcoming' })).toHaveClass(/bg-white/);
    }
  }
});
