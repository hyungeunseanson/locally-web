import { expect, test, type Route } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdHostApplicationIds: number[] = [];

async function createApprovedHostApplication(userId: string, user: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1991-01-01',
      email: user.email,
      instagram: '@codex_host_service_dead_link_guard',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 서비스 수익 dead link guard 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '호스트 서비스 수익 dead link guard 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function fulfillJson(route: Route, json: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(json),
  });
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Host service earnings null request guard', () => {
  test('renders legacy service payout rows without dead detail links', async ({ page }) => {
    test.setTimeout(90000);

    const hostUser = createTestUser('host.service.dead-link-guard');
    const hostId = await createAuthUser(hostUser);
    createdAuthUserIds.push(hostId);

    await createApprovedHostApplication(hostId, hostUser);

    await page.route('**/api/host/earnings/summary**', async (route) => {
      await fulfillJson(route, {
        success: true,
        summary: {
          total_pending_payout_amount: 100000,
          total_in_progress_amount: 0,
          total_paid_amount: 0,
          latest_paid_at: null,
          experience: {
            pending_payout_amount: 0,
            in_progress_amount: 0,
            paid_payout_amount: 0,
            payout_item_count: 0,
            completed_booking_count: 0,
            latest_paid_at: null,
            total_payout_amount: 0,
          },
          service: {
            pending_payout_amount: 100000,
            in_progress_amount: 0,
            paid_payout_amount: 0,
            completed_service_count: 2,
            payout_item_count: 2,
            latest_paid_at: null,
            total_payout_amount: 100000,
          },
        },
      });
    });

    await page.route('**/api/host/earnings/services**', async (route) => {
      await fulfillJson(route, {
        success: true,
        summary: {
          pending_payout_amount: 100000,
          in_progress_amount: 0,
          paid_payout_amount: 0,
          completed_service_count: 2,
          payout_item_count: 2,
          latest_paid_at: null,
          total_payout_amount: 100000,
        },
        items: [
          {
            id: 'host-service-legacy-item',
            order_id: 'host-service-legacy-item',
            request_id: null,
            title: 'Legacy service payout row',
            service_date: '2026-04-10',
            start_time: '14:00',
            status: 'completed',
            payout_status: 'pending',
            host_payout_amount: 45000,
            payout_paid_at: null,
            created_at: '2026-04-10T09:00:00.000Z',
            settlement_stage: 'pending',
          },
          {
            id: 'host-service-live-item',
            order_id: 'host-service-live-item',
            request_id: 'service-request-live-item',
            title: 'Live service payout row',
            service_date: '2026-04-11',
            start_time: '16:00',
            status: 'completed',
            payout_status: 'pending',
            host_payout_amount: 55000,
            payout_paid_at: null,
            created_at: '2026-04-11T09:00:00.000Z',
            settlement_stage: 'pending',
          },
        ],
      });
    });

    await login(page, hostUser);
    await page.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('host-earnings-unified-total')).toContainText('₩100,000');

    await page.getByTestId('host-earnings-tab-service').click();

    await expect(page.getByTestId('host-service-earnings-item-host-service-legacy-item')).toBeVisible();
    await expect(page.getByTestId('host-service-earnings-item-host-service-live-item')).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(
      page.locator('a:has([data-testid="host-service-earnings-item-host-service-legacy-item"])')
    ).toHaveCount(0);
    await expect(
      page.locator('a[href="/services/service-request-live-item"]:has([data-testid="host-service-earnings-item-host-service-live-item"])')
    ).toHaveCount(1);
  });
});
