import { expect, test } from '@playwright/test';

import {
  cleanupAuthUsers,
  cleanupAvailability,
  cleanupBookings,
  createAuthUser,
  createTestUser,
  getVisibleReservationByTestId,
  getVisibleReservationCard,
  getAdminClient,
  login,
  prepareBookableExperience,
  selectReservationDate,
  selectReservationTime,
  type AvailabilityKey,
} from './helpers/experienceBooking';

const createdAuthUserIds: string[] = [];
const createdBookingIds: string[] = [];
const createdAvailabilityKeys: AvailabilityKey[] = [];

test.afterAll(async () => {
  await cleanupBookings(createdBookingIds);
  await cleanupAvailability(createdAvailabilityKeys);
  await cleanupAuthUsers(createdAuthUserIds);
});

test.describe.serial('Experience detail availability summary', () => {
  test('keeps the host date inquiry available with and without open dates', async ({ page }) => {
    const experience = await prepareBookableExperience(createdAvailabilityKeys);
    await page.setViewportSize({ width: 1440, height: 900 });
    let availabilitySummary = {
      availableDates: [] as string[],
      dateToTimeMap: {} as Record<string, string[]>,
      calendarDayStatusMap: {} as Record<string, 'available' | 'sold_out'>,
      slotSummaryMap: {} as Record<string, {
        remainingSeats: number;
        isBookable: boolean;
        soloGuaranteeEligible: boolean;
      }>,
    };

    await page.route(`**/api/experiences/${experience.experienceId}/availability-summary`, async (route) => {
      await route.fulfill({ json: availabilitySummary });
    });

    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    const reservationCard = getVisibleReservationCard(page);
    const inquiry = reservationCard.getByTestId('reservation-date-inquiry');
    const enabledDays = reservationCard.locator('button[data-testid^="reservation-day-"]:enabled');

    await expect(enabledDays).toHaveCount(0);
    await expect(inquiry).toContainText(
      /원하는 날짜가 없나요\?|Can't find the date you want\?|ご希望の日程がありませんか|没有您想要的日期吗/
    );
    await expect(inquiry).toBeVisible();
    await expect(reservationCard.getByTestId('reservation-date-inquiry-cta')).toHaveCount(0);
    await expect(reservationCard.getByTestId('reservation-date-inquiry-pointer')).toHaveCount(0);
    await page.waitForTimeout(750);
    const desktopLayout = await inquiry.evaluate((element) => {
      const inquiryRect = element.getBoundingClientRect();
      const priceRowRect = element.parentElement?.getBoundingClientRect();
      const styles = window.getComputedStyle(element);

      return {
        inquiryLeft: inquiryRect.left,
        inquiryRight: inquiryRect.right,
        inquiryTop: inquiryRect.top,
        inquiryBottom: inquiryRect.bottom,
        inquiryWidth: inquiryRect.width,
        inquiryHeight: inquiryRect.height,
        inquiryCenterY: inquiryRect.top + inquiryRect.height / 2,
        priceRowRight: priceRowRect?.right ?? 0,
        priceRowHeight: priceRowRect?.height ?? 0,
        priceRowCenterY: priceRowRect ? priceRowRect.top + priceRowRect.height / 2 : 0,
        viewportWidth: window.innerWidth,
        animationDuration: styles.animationDuration,
        animationIterationCount: styles.animationIterationCount,
      };
    });
    expect(desktopLayout.inquiryLeft).toBeGreaterThanOrEqual(0);
    expect(desktopLayout.inquiryRight).toBeLessThanOrEqual(desktopLayout.viewportWidth);
    expect(desktopLayout.inquiryWidth).toBeLessThanOrEqual(113);
    expect(desktopLayout.inquiryHeight).toBeLessThanOrEqual(60);
    expect(Math.abs(desktopLayout.priceRowRight - desktopLayout.inquiryRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktopLayout.priceRowCenterY - desktopLayout.inquiryCenterY)).toBeLessThanOrEqual(1);
    expect(desktopLayout.priceRowHeight).toBeLessThanOrEqual(36);
    expect(desktopLayout.animationDuration).toBe('0.7s');
    expect(desktopLayout.animationIterationCount).toBe('1');
    await inquiry.click();
    await expect(page.getByTestId('exp-message-modal-textarea')).toBeVisible();
    await page.getByRole('button', { name: /닫기|Close|閉じる|关闭/ }).click();

    availabilitySummary = {
      availableDates: [experience.date],
      dateToTimeMap: { [experience.date]: [experience.time] },
      calendarDayStatusMap: { [experience.date]: 'available' },
      slotSummaryMap: {
        [`${experience.date}_${experience.time}`]: {
          remainingSeats: experience.maxGuests,
          isBookable: true,
          soloGuaranteeEligible: true,
        },
      },
    };
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));

    await expect(getVisibleReservationByTestId(page, `reservation-day-${experience.date}`)).toBeEnabled();
    await expect(inquiry).toBeVisible();
    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);
    await expect(inquiry).toBeVisible();
    await expect(reservationCard.getByTestId('reservation-submit')).toBeEnabled();
  });

  test('keeps the date inquiry usable on a small screen and honors reduced motion', async ({ page }) => {
    const experience = await prepareBookableExperience(createdAvailabilityKeys);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    const reservationCard = getVisibleReservationCard(page);
    const inquiry = reservationCard.getByTestId('reservation-date-inquiry');
    await inquiry.scrollIntoViewIfNeeded();
    await expect(inquiry).toBeVisible();

    const layout = await inquiry.evaluate((button) => {
      const inquiryRect = button.getBoundingClientRect();
      const cardRect = button.closest('#reservation-card')?.getBoundingClientRect();
      const priceRowRect = button.parentElement?.getBoundingClientRect();

      return {
        inquiryHeight: inquiryRect.height,
        inquiryLeft: inquiryRect.left,
        inquiryRight: inquiryRect.right,
        inquiryWidth: inquiryRect.width,
        inquiryCenterY: inquiryRect.top + inquiryRect.height / 2,
        priceRowCenterY: priceRowRect ? priceRowRect.top + priceRowRect.height / 2 : 0,
        cardLeft: cardRect?.left ?? 0,
        cardRight: cardRect?.right ?? 0,
        animationName: window.getComputedStyle(button).animationName,
      };
    });

    expect(layout.inquiryHeight).toBeGreaterThanOrEqual(44);
    expect(layout.inquiryHeight).toBeLessThanOrEqual(60);
    expect(layout.inquiryLeft).toBeGreaterThanOrEqual(layout.cardLeft);
    expect(layout.inquiryRight).toBeLessThanOrEqual(layout.cardRight);
    expect(layout.inquiryWidth).toBeLessThanOrEqual(113);
    expect(Math.abs(layout.priceRowCenterY - layout.inquiryCenterY)).toBeLessThanOrEqual(1);
    expect(layout.animationName).toBe('none');
    await expect(page.getByTestId('experience-mobile-sticky-action')).toHaveCount(0);
  });

  test('reduces selectable guest count and hides solo option when confirmed shared bookings exist', async ({ page }) => {
    const viewer = createTestUser('exp.detail.availability.viewer');
    const existingGuest = createTestUser('exp.detail.availability.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys);

    const expectedRemainingSeats = Math.min(2, Math.max(1, experience.maxGuests - 1));
    const occupiedGuests = Math.max(1, experience.maxGuests - expectedRemainingSeats);
    const bookingId = `TEST-DETAIL-SHARED-${Date.now()}`;

    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'PAID',
      guests: occupiedGuests,
      date: experience.date,
      time: experience.time,
      type: 'group',
      contact_name: existingGuest.fullName,
      contact_phone: existingGuest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payment_method: 'card',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

    if (bookingError) throw bookingError;
    createdBookingIds.push(bookingId);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);
    await selectReservationTime(page, experience.time);

    const reservationCard = getVisibleReservationCard(page);
    await expect(reservationCard.locator('[data-testid="reservation-solo-option"]:visible')).toHaveCount(0);

    const guestOptions = reservationCard
      .locator('[data-testid="reservation-guest-select"]:visible')
      .locator('option:not([value="private"])');

    await expect(guestOptions).toHaveCount(Math.min(expectedRemainingSeats, 6));
  });

  test('keeps a private-booked sold-out date visible and explains why it is closed', async ({ page }) => {
    const viewer = createTestUser('exp.detail.private.viewer');
    const privateGuest = createTestUser('exp.detail.private.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const privateGuestId = await createAuthUser(privateGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, { time: '10:00' });

    const bookingId = `TEST-DETAIL-PRIVATE-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: privateGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'confirmed',
      guests: 1,
      date: experience.date,
      time: experience.time,
      type: 'private',
      contact_name: privateGuest.fullName,
      contact_phone: privateGuest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payment_method: 'bank',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

    if (bookingError) throw bookingError;
    createdBookingIds.push(bookingId);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);

    const privateTimeSlot = getVisibleReservationByTestId(page, `reservation-time-${experience.time}`);
    await expect(privateTimeSlot).toBeVisible();
    await expect(privateTimeSlot).toBeDisabled();
    await expect(privateTimeSlot).toContainText(/프라이빗 예약 마감|Private booking sold out|貸切予約締切|私人团已售罄/);
    await expect(
      page.getByText(
        /선택한 날짜는 현재 예약이 마감되었습니다\. 다른 날짜를 선택해 주세요\.|This date is fully booked\. Please select another date\.|選択した日は満席です。別の日付を選択してください。|该日期已满，请选择其他日期。/
      )
    ).toBeVisible();
  });

  test('keeps a capacity-full date visible and marks the time as sold out', async ({ page }) => {
    const viewer = createTestUser('exp.detail.full.viewer');
    const existingGuest = createTestUser('exp.detail.full.existing');
    await createAuthUser(viewer, createdAuthUserIds);
    const existingGuestId = await createAuthUser(existingGuest, createdAuthUserIds);
    const experience = await prepareBookableExperience(createdAvailabilityKeys, { time: '12:00' });

    const bookingId = `TEST-DETAIL-FULL-${Date.now()}`;
    const { error: bookingError } = await getAdminClient().from('bookings').insert({
      id: bookingId,
      order_id: bookingId,
      user_id: existingGuestId,
      experience_id: experience.experienceId,
      amount: 10000,
      total_price: 10000,
      status: 'PAID',
      guests: experience.maxGuests,
      date: experience.date,
      time: experience.time,
      type: 'group',
      contact_name: existingGuest.fullName,
      contact_phone: existingGuest.phone,
      message: '',
      created_at: new Date().toISOString(),
      payment_method: 'card',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
    });

    if (bookingError) throw bookingError;
    createdBookingIds.push(bookingId);

    await login(page, viewer);
    await page.goto(`/experiences/${experience.experienceId}`, { waitUntil: 'domcontentloaded' });

    await selectReservationDate(page, experience.date);

    const soldOutTimeSlot = getVisibleReservationByTestId(page, `reservation-time-${experience.time}`);
    await expect(soldOutTimeSlot).toBeVisible();
    await expect(soldOutTimeSlot).toBeDisabled();
    await expect(soldOutTimeSlot).toContainText(/매진|Sold out|満席|售罄/);
  });
});
