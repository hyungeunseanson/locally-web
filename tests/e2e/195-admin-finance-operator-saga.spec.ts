import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  formatDate,
  getTestAdminClient,
  type E2ETestUser,
} from './helpers/testSupabase';
import {
  createIsolatedPage,
  dismissAnnouncementIfVisible,
  setPreferredLocale,
  waitForAuditLog,
} from './helpers/releaseJourney';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdHostApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdBookingIds: string[] = [];
const createdServiceRequestIds: string[] = [];
const createdServiceApplicationIds: string[] = [];
const createdServiceBookingIds: string[] = [];

async function createApprovedHostApplication(userId: string, host: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1990-01-01',
      email: host.email,
      instagram: '@codex_release_finance',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'release finance operator saga 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: host.fullName,
      motivation: 'release finance operator saga 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function createExperienceFixture(hostId: string) {
  const supabase = getTestAdminClient();
  const title = `[Playwright] Release Finance Experience ${Date.now()}`;
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: '대한민국',
      city: '서울',
      title,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: 'release finance operator saga 검증용 체험입니다.',
      itinerary: [{ title: '서울역', description: 'finance saga 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울역 1번 출구',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 150000,
      inclusions: ['가이드'],
      exclusions: ['개인 경비'],
      supplies: '편한 복장',
      rules: {
        age_limit: '만 19세 이상',
        activity_level: '보통',
      },
      status: 'approved',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id, title')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create experience fixture.');
  }

  createdExperienceIds.push(Number(data.id));
  return {
    id: Number(data.id),
    title: String(data.title),
  };
}

async function seedExperienceBooking(params: {
  customerId: string;
  customer: E2ETestUser;
  experienceId: number;
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const bookingId = `REL-FIN-EXP-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const { error } = await supabase.from('bookings').insert({
    id: bookingId,
    order_id: bookingId,
    user_id: params.customerId,
    experience_id: params.experienceId,
    amount: 150000,
    total_price: 150000,
    total_experience_price: 150000,
    status: 'confirmed',
    guests: 1,
    date: formatDate(params.createdAt),
    time: '10:00',
    type: 'group',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
    message: '',
    created_at: params.createdAt.toISOString(),
    payment_method: 'card',
    host_payout_amount: 120000,
    platform_revenue: 30000,
    payout_status: 'pending',
    is_solo_guarantee: false,
    solo_guarantee_price: 0,
  });

  if (error) throw error;
  createdBookingIds.push(bookingId);
  return bookingId;
}

async function seedServiceBooking(params: {
  customerId: string;
  customer: E2ETestUser;
  hostId: string;
  createdAt: Date;
}) {
  const supabase = getTestAdminClient();
  const timestamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const serviceTitle = `[Playwright] Release Finance Service ${timestamp}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title: serviceTitle,
      description: 'release finance operator saga 검증용 서비스 의뢰입니다.',
      city: 'Seoul',
      country: 'KR',
      service_date: formatDate(params.createdAt),
      start_time: '14:00',
      duration_hours: 4,
      languages: ['한국어'],
      guest_count: 2,
      status: 'matched',
      selected_host_id: params.hostId,
      contact_name: params.customer.fullName,
      contact_phone: params.customer.phone,
      created_at: params.createdAt.toISOString(),
      updated_at: params.createdAt.toISOString(),
    })
    .select('id, title')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create service request.');
  }
  createdServiceRequestIds.push(requestRow.id);

  const { data: applicationRow, error: applicationError } = await supabase
    .from('service_applications')
    .insert({
      request_id: requestRow.id,
      host_id: params.hostId,
      appeal_message: 'release finance operator saga 검증용 지원입니다.',
      status: 'selected',
      created_at: params.createdAt.toISOString(),
      updated_at: params.createdAt.toISOString(),
    })
    .select('id')
    .single();

  if (applicationError || !applicationRow?.id) {
    throw applicationError || new Error('Failed to create service application.');
  }
  createdServiceApplicationIds.push(applicationRow.id);

  const bookingId = `REL-FIN-SVC-${timestamp}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: bookingId,
    order_id: bookingId,
    request_id: requestRow.id,
    application_id: applicationRow.id,
    customer_id: params.customerId,
    host_id: params.hostId,
    amount: 180000,
    host_payout_amount: 110000,
    platform_revenue: 70000,
    status: 'PAID',
    payout_status: 'pending',
    payment_method: 'card',
    created_at: params.createdAt.toISOString(),
    updated_at: params.createdAt.toISOString(),
  });

  if (bookingError) throw bookingError;
  createdServiceBookingIds.push(bookingId);

  return {
    bookingId,
    orderId: bookingId,
    requestId: requestRow.id,
    title: String(requestRow.title),
  };
}

async function submitForceSyncForm(
  page: Page,
  domain: 'auto' | 'experience' | 'service',
  identifier: string
) {
  const details = page.getByTestId('settlement-sync-details');
  if (!(await details.isVisible())) {
    await page.getByTestId('settlement-sync-toggle').click();
  }

  await expect(details).toBeVisible();
  await page.getByTestId('settlement-sync-force-domain').selectOption(domain);
  await page.getByTestId('settlement-sync-force-identifier').fill(identifier);
  await page.getByTestId('settlement-sync-force-submit').click();
  await expect(page.getByTestId('settlement-sync-result-banner')).toBeVisible({
    timeout: 20000,
  });
}

async function confirmDialogAction(page: Page, title: string, confirmLabel: string) {
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: confirmLabel }).last().click();
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  const auditTargetIds = [
    ...createdBookingIds,
    ...createdServiceBookingIds,
    ...createdServiceRequestIds,
  ];
  if (auditTargetIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in('target_id', auditTargetIds);
  }

  for (const bookingId of createdServiceBookingIds) {
    await supabase.from('service_bookings').delete().eq('id', bookingId);
  }

  for (const applicationId of createdServiceApplicationIds) {
    await supabase.from('service_applications').delete().eq('id', applicationId);
  }

  for (const requestId of createdServiceRequestIds) {
    await supabase.from('service_requests').delete().eq('id', requestId);
  }

  for (const bookingId of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', bookingId);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Release journey 195: admin finance operator saga', () => {
  test('walks ledger inspection, manual completion sync, payout execution, and host earnings reflection', async ({
    browser,
  }) => {
    test.setTimeout(300000);
    const logStep = (message: string) => console.log(`[release-195] ${message}`);

    const adminUser = createTestUser('release.finance.admin');
    const hostUser = createTestUser('release.finance.host');
    const customerUser = createTestUser('release.finance.customer');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const hostId = await createAuthUser(hostUser);
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, hostId, customerId);
    createdWhitelistEmails.push(adminUser.email);

    await Promise.all([
      setPreferredLocale(adminId, 'ko'),
      setPreferredLocale(hostId, 'ko'),
      setPreferredLocale(customerId, 'ko'),
    ]);

    await createApprovedHostApplication(hostId, hostUser);
    const experience = await createExperienceFixture(hostId);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 4);

    const experienceBookingId = await seedExperienceBooking({
      customerId,
      customer: customerUser,
      experienceId: experience.id,
      createdAt: pastDate,
    });
    const serviceFixture = await seedServiceBooking({
      customerId,
      customer: customerUser,
      hostId,
      createdAt: pastDate,
    });

    const adminSession = await createIsolatedPage(browser, adminUser, 'ko');
    const hostSession = await createIsolatedPage(browser, hostUser, 'ko');

    try {
      const adminPage = adminSession.page;
      const hostPage = hostSession.page;
      const supabase = getTestAdminClient();

      await adminPage.goto('/admin/dashboard?tab=LEDGER', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(adminPage);

      const ledgerSearch = adminPage.getByPlaceholder('검색 (이름, 예약번호)');
      await ledgerSearch.fill(customerUser.fullName);
      await expect(adminPage.getByText(experience.title)).toBeVisible({ timeout: 20000 });
      await expect(adminPage.getByText(serviceFixture.title)).toBeVisible({ timeout: 20000 });
      logStep('ledger surfaces show seeded experience and service rows');

      await adminPage.getByText(experience.title).click();
      await expect(adminPage.getByText(`Order ID: ${experienceBookingId}`)).toBeVisible({
        timeout: 20000,
      });
      await expect(adminPage.getByText('₩120,000')).toBeVisible();
      logStep('ledger experience detail opened');

      await adminPage.getByText(serviceFixture.title).click();
      await expect(adminPage.getByText('서비스 의뢰 관리는 서비스 의뢰 탭에서 처리하세요.')).toBeVisible({
        timeout: 20000,
      });
      logStep('ledger service detail opened');

      await adminPage.goto('/admin/dashboard?tab=SALES', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(adminPage);

      await submitForceSyncForm(adminPage, 'experience', experienceBookingId);
      await expect(adminPage.getByTestId('settlement-sync-result-banner')).toContainText(
        '체험 완료 동기화를 1건 반영했습니다.'
      );
      await waitForAuditLog({
        actionType: 'ADMIN_SETTLEMENT_SYNC_FORCE_ONE',
        targetType: 'settlement_sync',
        targetId: experienceBookingId,
      });
      logStep('experience completion force-sync succeeded');

      await submitForceSyncForm(adminPage, 'auto', serviceFixture.orderId);
      await expect(adminPage.getByTestId('settlement-sync-result-banner')).toContainText(
        '서비스 완료 동기화를 1건 반영했습니다.'
      );
      await waitForAuditLog({
        actionType: 'ADMIN_SETTLEMENT_SYNC_FORCE_ONE',
        targetType: 'settlement_sync',
        targetId: serviceFixture.orderId,
      });
      logStep('service completion force-sync succeeded');

      await expect
        .poll(async () => {
          const [experienceBooking, serviceBooking, serviceRequest] = await Promise.all([
            supabase.from('bookings').select('status').eq('id', experienceBookingId).maybeSingle(),
            supabase
              .from('service_bookings')
              .select('status')
              .eq('id', serviceFixture.bookingId)
              .maybeSingle(),
            supabase
              .from('service_requests')
              .select('status')
              .eq('id', serviceFixture.requestId)
              .maybeSingle(),
          ]);

          return {
            experienceStatus: experienceBooking.data?.status ?? null,
            serviceBookingStatus: serviceBooking.data?.status ?? null,
            serviceRequestStatus: serviceRequest.data?.status ?? null,
          };
        }, { timeout: 20000 })
        .toEqual({
          experienceStatus: 'completed',
          serviceBookingStatus: 'completed',
          serviceRequestStatus: 'completed',
        });
      logStep('experience and service completion states converged');

      const settlementRow = adminPage.getByTestId(`sales-settlement-row-${hostId}`);
      await expect(settlementRow).toBeVisible({ timeout: 20000 });
      await settlementRow.click();
      await expect(adminPage.getByRole('heading', { name: '체험 예약' })).toBeVisible({
        timeout: 20000,
      });
      await expect(adminPage.getByRole('heading', { name: '맞춤 의뢰' })).toBeVisible({
        timeout: 20000,
      });
      logStep('sales settlement row expanded');

      let experienceSettleButton = adminPage.getByTestId(`sales-settle-experience-${hostId}`);
      if (!(await experienceSettleButton.isEnabled())) {
        await adminPage.getByTestId('settlement-sync-run-due-experience').click();
        await expect(adminPage.getByTestId('settlement-sync-result-banner')).toBeVisible({
          timeout: 20000,
        });
        logStep('experience run-due sync triggered before payout');
        const experienceHeading = adminPage.getByRole('heading', { name: '체험 예약' });
        if (!(await experienceHeading.isVisible())) {
          await settlementRow.click();
        }
        await expect(experienceHeading).toBeVisible({ timeout: 20000 });
        experienceSettleButton = adminPage.getByTestId(`sales-settle-experience-${hostId}`);
        await expect
          .poll(async () => experienceSettleButton.isEnabled(), { timeout: 30000 })
          .toBe(true);
      }

      await experienceSettleButton.click();
      await confirmDialogAction(adminPage, '체험 정산 완료 처리', '체험 정산 완료');
      await waitForAuditLog({
        actionType: 'SETTLE_HOST_PAYOUT',
        targetType: 'bookings',
        targetId: experienceBookingId,
      });
      logStep('experience payout marked paid');

      let serviceSettleButton = adminPage.getByTestId(`sales-settle-service-${hostId}`);
      if (!(await serviceSettleButton.isEnabled())) {
        await adminPage.getByTestId('settlement-sync-run-due-service').click();
        await expect(adminPage.getByTestId('settlement-sync-result-banner')).toBeVisible({
          timeout: 20000,
        });
        logStep('service run-due sync triggered before payout');
        const serviceHeading = adminPage.getByRole('heading', { name: '맞춤 의뢰' });
        if (!(await serviceHeading.isVisible())) {
          await settlementRow.click();
        }
        await expect(serviceHeading).toBeVisible({ timeout: 20000 });
        serviceSettleButton = adminPage.getByTestId(`sales-settle-service-${hostId}`);
        await expect
          .poll(async () => serviceSettleButton.isEnabled(), { timeout: 30000 })
          .toBe(true);
      }

      await serviceSettleButton.click();
      await confirmDialogAction(adminPage, '서비스 정산 완료 처리', '서비스 정산 완료');
      await waitForAuditLog({
        actionType: 'ADMIN_SERVICE_PAYOUT_MARK_PAID',
        targetType: 'service_bookings',
        targetId: serviceFixture.bookingId,
      });
      logStep('service payout marked paid');

      await expect
        .poll(async () => {
          const [experienceBooking, serviceBooking] = await Promise.all([
            supabase
              .from('bookings')
              .select('payout_status, payout_paid_at')
              .eq('id', experienceBookingId)
              .maybeSingle(),
            supabase
              .from('service_bookings')
              .select('payout_status, payout_paid_at')
              .eq('id', serviceFixture.bookingId)
              .maybeSingle(),
          ]);

          return {
            experiencePayoutStatus: experienceBooking.data?.payout_status ?? null,
            servicePayoutStatus: serviceBooking.data?.payout_status ?? null,
            experiencePaidAt: Boolean(experienceBooking.data?.payout_paid_at),
            servicePaidAt: Boolean(serviceBooking.data?.payout_paid_at),
          };
        }, { timeout: 20000 })
        .toEqual({
          experiencePayoutStatus: 'paid',
          servicePayoutStatus: 'paid',
          experiencePaidAt: true,
          servicePaidAt: true,
        });
      logStep('payout statuses converged in database');

      await hostPage.goto('/host/dashboard?tab=earnings', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(hostPage);
      logStep('host earnings page opened');

      await expect(hostPage.getByTestId('host-earnings-experience-pending')).toContainText('₩0');
      await hostPage.getByTestId('host-earnings-details-toggle').click();
      await expect(hostPage.getByTestId('host-earnings-details-panel')).toBeVisible({
        timeout: 20000,
      });
      await expect(hostPage.getByTestId('host-earnings-summary-paid-payout')).toContainText(
        '₩120,000'
      );
      await expect(hostPage.getByTestId('host-earnings-summary-net-payout')).toContainText(
        '₩120,000'
      );
      logStep('host experience earnings panel reflects paid payout');

      await hostPage.getByTestId('host-earnings-tab-service').click();
      await expect(hostPage.getByTestId('host-service-earnings-total-pending')).toContainText('₩0');
      await expect(hostPage.getByTestId('host-service-earnings-paid')).toContainText('₩110,000');
      await expect(
        hostPage.getByTestId(`host-service-earnings-stage-${serviceFixture.bookingId}`)
      ).toContainText(/지급 완료|Paid|支払い完了|已完成支付/);
      logStep('host service earnings tab reflects paid stage');

      const summaryResponse = await hostPage.request.get('/api/host/earnings/summary');
      expect(summaryResponse.ok()).toBeTruthy();
      const summaryPayload = await summaryResponse.json();
      expect(summaryPayload.summary).toMatchObject({
        total_pending_payout_amount: 0,
        total_paid_amount: 230000,
        experience: {
          paid_payout_amount: 120000,
        },
        service: {
          paid_payout_amount: 110000,
        },
      });
      logStep('host earnings summary api reflects paid totals');
    } finally {
      await Promise.all([adminSession.context.close(), hostSession.context.close()]);
    }
  });
});
