import { readFileSync } from 'fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type EnvMap = Record<string, string>;
type TestUser = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};
type BookableExperience = {
  experienceId: number;
  title: string;
  date: string;
  time: string;
};

type PendingBookingRow = {
  id: string;
  order_id: string | null;
};

const TEST_PASSWORD = 'LocallyTest!2026';

let adminClient: SupabaseClient | null = null;

function loadEnv(): EnvMap {
  return readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<EnvMap>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

function getAdminClient() {
  if (adminClient) return adminClient;

  const env = loadEnv();
  adminClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return adminClient;
}

function createGuestUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.ledger.guest.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Ledger Guest ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function createAdminUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `codex.ledger.admin.${timestamp}@example.com`,
    password: TEST_PASSWORD,
    fullName: `Ledger Admin ${timestamp}`,
    phone: `010${String(timestamp).slice(-8)}`,
  };
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function waitForProfile(userId: string) {
  const supabase = getAdminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Profile was not created for auth user ${userId}.`);
}

async function createAuthUser(user: TestUser, isAdmin = false) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
    },
  });

  if (error || !data.user?.id) {
    throw error || new Error(`Failed to create auth user for ${user.email}`);
  }

  await waitForProfile(data.user.id);

  if (isAdmin) {
    const { error: whitelistError } = await supabase
      .from('admin_whitelist')
      .upsert({ email: user.email }, { onConflict: 'email' });

    if (whitelistError) throw whitelistError;
  }

  return data.user.id;
}

async function prepareBookableExperience(): Promise<BookableExperience> {
  const supabase = getAdminClient();

  const { data: experiences, error: experienceError } = await supabase
    .from('experiences')
    .select('id, title, status, host_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (experienceError) throw experienceError;
  if (!experiences || experiences.length === 0) {
    throw new Error('No experiences found for the ledger test.');
  }

  const pickedExperience = experiences.find((experience) =>
    experience.status === 'approved' || experience.status === 'active'
  ) || experiences[0];

  if (pickedExperience.status !== 'approved' && pickedExperience.status !== 'active') {
    const { error: updateError } = await supabase
      .from('experiences')
      .update({ status: 'approved' })
      .eq('id', pickedExperience.id);

    if (updateError) throw updateError;
  }

  let date = '';
  const time = '10:00';

  for (let offset = 14; offset <= 45; offset += 1) {
    const candidateDate = new Date();
    candidateDate.setDate(candidateDate.getDate() + offset);
    const candidate = formatDate(candidateDate);

    const { count, error: bookingCountError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('experience_id', pickedExperience.id)
      .eq('date', candidate)
      .eq('time', time)
      .in('status', ['PENDING', 'PAID', 'confirmed', 'pending', 'paid']);

    if (bookingCountError) throw bookingCountError;

    if (!count || count === 0) {
      date = candidate;
      break;
    }
  }

  if (!date) {
    throw new Error('Could not find an empty future slot for the ledger test.');
  }

  const { data: existingSlots, error: slotFetchError } = await supabase
    .from('experience_availability')
    .select('experience_id')
    .eq('experience_id', pickedExperience.id)
    .eq('date', date)
    .eq('start_time', time)
    .limit(1);

  if (slotFetchError) throw slotFetchError;

  if (!existingSlots || existingSlots.length === 0) {
    const { error: slotInsertError } = await supabase
      .from('experience_availability')
      .insert({
        experience_id: pickedExperience.id,
        date,
        start_time: time,
        is_booked: false,
      });

    if (slotInsertError) throw slotInsertError;
  }

  return {
    experienceId: Number(pickedExperience.id),
    title: String(pickedExperience.title),
    date,
    time,
  };
}

async function getPendingBookingIdByOrderId(orderId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error(`Pending booking not found for order ${orderId}`);

  return data.id;
}

async function getAllPendingBookingIds() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, order_id')
    .eq('status', 'PENDING');

  if (error) throw error;

  return (data || []).map((row: PendingBookingRow) => row.id);
}

async function login(page: Page, user: TestUser) {
  await page.goto('/login', { waitUntil: 'networkidle' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      return;
    } catch {
      if (attempt === 2) {
        throw new Error(`Login failed for ${user.email}`);
      }

      await page.goto('/login', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }
  }
}

async function createBankTransferBooking(page: Page, guest: TestUser, experience: BookableExperience) {
  await login(page, guest);
  await page.goto(
    `/experiences/${experience.experienceId}/payment?date=${experience.date}&time=${experience.time}&guests=1`,
    { waitUntil: 'networkidle' }
  );

  await page.locator('input[placeholder="예약자 성함"]').fill(guest.fullName);
  await page.locator('input[placeholder="010-0000-0000"]').fill(guest.phone);

  await page.getByRole('button', { name: /무통장 입금/ }).click();
  await page.getByText(/호스트와의 직접 연락 및 플랫폼 외부 결제/).click();
  await page.getByText(/게스트 안전 가이드라인/).click();
  await page.getByText(/구매 조건, 취소\/환불 규정/).click();
  await page.getByRole('button', { name: /결제하기/ }).click();

  await page.waitForURL(/\/payment\/complete\?orderId=/, { timeout: 30000 });

  const orderId = new URL(page.url()).searchParams.get('orderId');
  expect(orderId).toBeTruthy();
  await expect(page.getByText(orderId as string).first()).toBeVisible({ timeout: 15000 });

  return orderId as string;
}

async function openMasterLedger(page: Page, adminUser: TestUser) {
  await login(page, adminUser);
  await page.goto('/admin/dashboard?tab=LEDGER', { waitUntil: 'networkidle' });
  await expect(page.getByText('Total Sales')).toBeVisible({ timeout: 20000 });
  await expect(page.getByPlaceholder('검색 (이름, 예약번호)')).toBeVisible();
}

async function searchByOrderId(page: Page, orderId: string) {
  const searchInput = page.getByPlaceholder('검색 (이름, 예약번호)');
  await searchInput.fill(orderId);
  await expect(page.getByText('데이터가 없습니다.')).toHaveCount(0);
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible({ timeout: 10000 });
  return row;
}

async function openLedgerRow(page: Page, row: ReturnType<Page['locator']>) {
  await row.click();

  const actionButton = page.getByRole('button', { name: /입금 확인|강제 취소/ }).first();
  try {
    await expect(actionButton).toBeVisible({ timeout: 5000 });
  } catch {
    await row.click();
    await expect(actionButton).toBeVisible({ timeout: 10000 });
  }
}

async function setOutOfRangeDateFilter(page: Page) {
  await page.getByRole('button', { name: /전체 기간 선택|^\d{4}\.\d{2}\.\d{2} - \d{4}\.\d{2}\.\d{2}$/ }).first().click();
  await page.locator('.rdrCalendarWrapper').waitFor({ state: 'visible', timeout: 10000 });
  const activeDays = page.locator('.rdrMonth').first().locator('button.rdrDay:not(.rdrDayPassive):not(.rdrDayDisabled)');
  expect(await activeDays.count()).toBeGreaterThan(2);

  await activeDays.nth(0).click();
  await activeDays.nth(1).click();

  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('button', { name: /^\d{4}\.\d{2}\.\d{2} - \d{4}\.\d{2}\.\d{2}$/ })).toBeVisible({ timeout: 10000 });
}

async function resetDateFilter(page: Page) {
  await page.getByRole('button', { name: /전체 기간 선택|^\d{4}\.\d{2}\.\d{2} - \d{4}\.\d{2}\.\d{2}$/ }).first().click();
  await page.getByRole('button', { name: '초기화' }).click();
  await page.getByRole('button', { name: '적용' }).click();
}

function parseNumber(text: string | null) {
  return Number((text ?? '').replace(/[^\d.-]/g, ''));
}

function parseTrailingCount(text: string | null) {
  const matches = (text ?? '').match(/\d+/g);
  if (!matches || matches.length === 0) return 0;
  return Number(matches[matches.length - 1]);
}

test.describe.serial('Scenario 6: Admin Master Ledger Smoke', () => {
  test.setTimeout(240000);

  test('creates a fresh booking and validates master ledger filters and admin actions', async ({ browser }) => {
    const guest = createGuestUser();
    const adminUser = createAdminUser();
    const experience = await prepareBookableExperience();

    await createAuthUser(guest);
    await createAuthUser(adminUser, true);

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    const orderId = await createBankTransferBooking(guestPage, guest, experience);
    await guestContext.close();

    const targetPendingBookingId = await getPendingBookingIdByOrderId(orderId);
    const allPendingBookingIds = await getAllPendingBookingIds();
    const preViewedBookingIds = allPendingBookingIds.filter((bookingId) => bookingId !== targetPendingBookingId);

    const adminContext = await browser.newContext();
    await adminContext.addInitScript((viewedBookingIds: string[]) => {
      window.localStorage.setItem('viewed_booking_ids', JSON.stringify(viewedBookingIds));
    }, preViewedBookingIds);
    const adminPage = await adminContext.newPage();
    await openMasterLedger(adminPage, adminUser);

    const masterLedgerButton = adminPage.getByRole('button', { name: /Master Ledger/i });
    await expect
      .poll(async () => parseTrailingCount(await masterLedgerButton.textContent()))
      .toBe(1);

    let row = await searchByOrderId(adminPage, orderId);
    const basePriceText = await row.locator('td').nth(6).textContent();
    const salesText = await row.locator('td').nth(8).textContent();
    const basePrice = parseNumber(basePriceText);
    const sales = parseNumber(salesText);

    expect(basePrice).toBeGreaterThanOrEqual(0);
    expect(basePrice).toBeLessThanOrEqual(sales);

    await setOutOfRangeDateFilter(adminPage);
    await expect(adminPage.getByText('데이터가 없습니다.')).toBeVisible({ timeout: 10000 });

    await resetDateFilter(adminPage);
    row = await searchByOrderId(adminPage, orderId);

    await openLedgerRow(adminPage, row);
    await expect
      .poll(async () => parseTrailingCount(await masterLedgerButton.textContent()))
      .toBe(0);
    await expect(adminPage.getByRole('button', { name: /입금 확인/ })).toBeVisible({ timeout: 10000 });

    const confirmPaymentResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/bookings/confirm-payment') &&
        response.request().method() === 'POST',
      { timeout: 60000 }
    );
    adminPage.once('dialog', (dialog) => dialog.accept());
    await adminPage.getByRole('button', { name: /입금 확인/ }).click();
    const confirmPaymentResult = await confirmPaymentResponse;
    expect(confirmPaymentResult.ok()).toBeTruthy();
    await expect(row.locator('td').first()).toContainText(/확정/, { timeout: 30000 });

    await openLedgerRow(adminPage, row);
    await expect(adminPage.getByRole('button', { name: /강제 취소/ })).toBeVisible({ timeout: 10000 });
    const forceCancelResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/bookings/force-cancel') &&
        response.request().method() === 'POST',
      { timeout: 60000 }
    );
    adminPage.once('dialog', (dialog) => dialog.accept());
    await adminPage.getByRole('button', { name: /강제 취소/ }).click();
    const forceCancelResult = await forceCancelResponse;
    expect(forceCancelResult.ok()).toBeTruthy();
    await expect(row.locator('td').first()).toContainText(/취소/, { timeout: 30000 });

    await adminContext.close();
  });
});
