import { expect, test, type Page } from '@playwright/test';

import {
  createAuthUser,
  cleanupTestUsers,
  createTestUser,
  formatDate,
  getTestAdminClient,
  type E2ETestUser,
} from './helpers/testSupabase';
import {
  createIsolatedPage,
  dismissAnnouncementIfVisible,
  setPreferredLocale,
  supportsServiceRequestId,
  waitForAuditLog,
  waitForNotification,
} from './helpers/releaseJourney';

const createdAuthUserIds: string[] = [];
const createdHostApplicationIds: number[] = [];
const createdExperienceIds: number[] = [];
const createdServiceRequestIds: string[] = [];
const createdInquiryIds: Array<string | number> = [];
const createdAuditTargetIds: string[] = [];

async function createApprovedHostApplication(userId: string, user: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어', 'English'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
      ],
      name: user.fullName,
      phone: user.phone,
      dob: '1991-01-01',
      email: user.email,
      instagram: '@codex_release_service',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: 'release full journey 서비스 의뢰 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '서비스 release journey 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdHostApplicationIds.push(Number(data.id));
}

async function createActiveExperience(hostId: string) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('experiences')
    .insert({
      host_id: hostId,
      country: 'Korea',
      city: 'Seoul',
      title: `[Playwright] Release Service Host ${Date.now()}`,
      category: '맛집 탐방',
      languages: ['한국어', 'English'],
      language_levels: [
        { language: '한국어', level: 5 },
        { language: 'English', level: 4 },
      ],
      duration: 2,
      max_guests: 4,
      description: '서비스 관리자 직접 배정 여정 검증용 활성 체험입니다.',
      itinerary: [{ title: '서울역', description: '서비스 여정 검증 코스입니다.' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      meeting_point_i18n: {
        ko: '서울역 1번 출구',
        en: 'Seoul Station Exit 1',
      },
      location: '서울역 1번 출구',
      photos: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200'],
      price: 55000,
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
      manual_locales: ['ko', 'en'],
      translation_version: 1,
      translation_meta: {},
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create active experience.');
  }

  createdExperienceIds.push(Number(data.id));
  return Number(data.id);
}

async function createPendingBankServiceFixture(params: {
  customerId: string;
  customer: E2ETestUser;
}) {
  const supabase = getTestAdminClient();
  const timestamp = Date.now();
  const serviceDate = new Date();
  serviceDate.setDate(serviceDate.getDate() + 9);
  const clientRequestKey = `release-service-${timestamp}-${Math.random().toString(16).slice(2, 8)}`;
  const { data: rpcRow, error: requestError } = await supabase
    .rpc('create_service_concierge_request_atomic', {
      p_user_id: params.customerId,
      p_service_type: 'general',
      p_description:
        'release full journey 맞춤 서비스 의뢰입니다. 결제 확인 후 현지 담당자 1:1 문의와 직접 호스트 배정, 전용 대화방까지 검증합니다.',
      p_city: 'Tokyo',
      p_schedule: [
        {
          serviceDate: formatDate(serviceDate),
          startTime: '10:00',
          durationHours: 4,
        },
      ],
      p_languages: ['한국어', 'English'],
      p_guest_count: 2,
      p_contact_name: params.customer.fullName,
      p_contact_phone: params.customer.phone,
      p_client_request_key: clientRequestKey,
    })
    .single();

  const created = rpcRow as
    | { request_id: string; booking_id: string; order_id: string; amount: number }
    | null;
  if (requestError || !created?.request_id || !created.order_id) {
    throw requestError || new Error('Failed to create concierge service request fixture.');
  }

  const { error: bookingError } = await supabase
    .from('service_bookings')
    .update({ payment_method: 'bank' })
    .eq('id', created.booking_id);
  if (bookingError) throw bookingError;

  const { data: requestRow, error: requestReadError } = await supabase
    .from('service_requests')
    .select('id, title')
    .eq('id', created.request_id)
    .single();
  if (requestReadError || !requestRow?.id) {
    throw requestReadError || new Error('Failed to read concierge service request fixture.');
  }

  createdServiceRequestIds.push(requestRow.id);
  const orderId = created.order_id;

  createdAuditTargetIds.push(orderId);

  return {
    requestId: requestRow.id,
    orderId,
    title: String(requestRow.title || `Tokyo · ${formatDate(serviceDate)}`),
  };
}

async function confirmDialogAction(page: Page, title: string, confirmLabel: string) {
  const heading = page.getByRole('heading', { name: title });
  if ((await heading.count()) > 0) {
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15000 });
  }
  await page.getByRole('button', { name: confirmLabel }).last().click();
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  if (createdAuditTargetIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in('target_id', createdAuditTargetIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase
      .from('notifications')
      .delete()
      .eq('type', 'admin_alert')
      .in(
        'link',
        createdInquiryIds.map((inquiryId) => `/admin/dashboard?tab=CHATS&inquiryId=${inquiryId}`)
      );
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
  }

  if (createdServiceRequestIds.length > 0) {
    await supabase.from('service_bookings').delete().in('request_id', createdServiceRequestIds);
    await supabase.from('service_applications').delete().in('request_id', createdServiceRequestIds);
    await supabase.from('service_requests').delete().in('id', createdServiceRequestIds);
  }

  for (const experienceId of createdExperienceIds) {
    await supabase.from('experience_availability').delete().eq('experience_id', experienceId);
    await supabase.from('experiences').delete().eq('id', experienceId);
  }

  for (const applicationId of createdHostApplicationIds) {
    await supabase.from('host_applications').delete().eq('id', applicationId);
  }

  await cleanupTestUsers(createdAuthUserIds);
});

test.describe.serial('Release journey 191: service bank -> manager inquiry -> admin assignment -> chat', () => {
  test('covers admin confirm, manager inquiry, direct host assignment, and dedicated chat', async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const logStep = (message: string) => console.log(`[release-191] ${message}`);

    const adminUser = createTestUser('release.service.admin');
    const customerUser = createTestUser('release.service.customer');
    const hostUser = createTestUser('release.service.host');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const customerId = await createAuthUser(customerUser);
    const hostId = await createAuthUser(hostUser);
    createdAuthUserIds.push(adminId, customerId, hostId);

    await Promise.all([
      setPreferredLocale(adminId, 'ko'),
      setPreferredLocale(customerId, 'ko'),
      setPreferredLocale(hostId, 'ko'),
    ]);

    await createApprovedHostApplication(hostId, hostUser);
    await createActiveExperience(hostId);
    const fixture = await createPendingBankServiceFixture({
      customerId,
      customer: customerUser,
    });

    const adminSession = await createIsolatedPage(browser, adminUser, 'ko');
    const hostSession = await createIsolatedPage(browser, hostUser, 'ko');
    const customerSession = await createIsolatedPage(browser, customerUser, 'ko');

    try {
      const adminPage = adminSession.page;
      const hostPage = hostSession.page;
      const customerPage = customerSession.page;

      await adminPage.goto('/admin/dashboard?tab=SERVICE_REQUESTS', { waitUntil: 'networkidle' });
      await expect(adminPage.getByRole('heading', { name: '맞춤 의뢰 관리' })).toBeVisible({
        timeout: 20000,
      });
      await expect(adminPage.getByText(fixture.title, { exact: true })).toBeVisible({
        timeout: 20000,
      });

      const confirmPaymentResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/service-confirm-payment') &&
          response.request().method() === 'POST',
        { timeout: 60000 }
      );
      await adminPage.getByRole('button', { name: /💰 입금 확인/ }).click();
      await confirmDialogAction(adminPage, '입금 확인', '입금 확인');
      const confirmPaymentResponse = await confirmPaymentResponsePromise;
      expect(confirmPaymentResponse.ok()).toBeTruthy();
      await expect(adminPage.getByText('입금 확인 완료. 현지 담당자 1:1 문의가 생성되었습니다.')).toBeVisible({
        timeout: 20000,
      });
      logStep('admin confirmed bank payment');

      await waitForAuditLog({
        actionType: 'ADMIN_SERVICE_CONFIRM_BANK',
        targetType: 'service_booking',
        targetId: fixture.orderId,
      });

      await expect
        .poll(async () => {
          const { data, error } = await getTestAdminClient()
            .from('service_requests')
            .select('status')
            .eq('id', fixture.requestId)
            .maybeSingle<{ status: string | null }>();

          if (error) throw error;
          return data?.status ?? null;
        })
        .toBe('assigning');

      const { data: supportInquiry, error: supportInquiryError } = await getTestAdminClient()
        .from('inquiries')
        .select('id, user_id, host_id, service_request_id, type')
        .eq('service_request_id', fixture.requestId)
        .eq('type', 'admin_support')
        .maybeSingle();
      if (supportInquiryError || !supportInquiry?.id) {
        throw supportInquiryError || new Error('Payment confirmation did not create manager inquiry.');
      }
      expect(supportInquiry).toMatchObject({ user_id: customerId, host_id: null });
      createdInquiryIds.push(supportInquiry.id);

      await customerPage.goto(`/services/${fixture.requestId}`, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(customerPage);
      await expect(customerPage.getByRole('button', { name: '현지 담당자에게 1:1 문의' })).toBeVisible({
        timeout: 20000,
      });
      await customerPage.getByRole('button', { name: '현지 담당자에게 1:1 문의' }).click();
      await customerPage.waitForURL(
        new RegExp(`/guest/inbox\\?inquiryId=${supportInquiry.id}`),
        { timeout: 20000 }
      );
      await expect(customerPage.getByText('맞춤 동행·통역 신청서')).toBeVisible({ timeout: 20000 });
      logStep('customer opened auto-submitted manager inquiry');

      const serviceRow = adminPage.locator('tbody tr').filter({ hasText: fixture.title });
      await expect(serviceRow.getByRole('button', { name: '호스트 배정' })).toBeVisible({
        timeout: 20000,
      });
      await serviceRow.getByRole('button', { name: '호스트 배정' }).click();
      await expect(adminPage.getByRole('heading', { name: '호스트 직접 배정' })).toBeVisible({
        timeout: 20000,
      });
      await adminPage.getByRole('button', { name: new RegExp(hostUser.fullName) }).click();
      await expect(adminPage.getByLabel('호스트 시간당 보수')).toHaveValue('20000');
      await adminPage.getByRole('checkbox').check();

      const assignHostResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/service-requests/${fixture.requestId}/assign-host`) &&
          response.request().method() === 'POST',
        { timeout: 60000 }
      );
      await adminPage.getByRole('button', { name: '배정 확정' }).click();
      const assignHostResponse = await assignHostResponsePromise;
      expect(assignHostResponse.ok()).toBeTruthy();
      const assignHostPayload = (await assignHostResponse.json()) as {
        data?: { hostInquiryId?: string };
      };
      expect(assignHostPayload.data?.hostInquiryId).toBeTruthy();
      await expect(
        adminPage.getByText('호스트 배정과 고객-호스트 문의 생성이 완료되었습니다.')
      ).toBeVisible({ timeout: 20000 });
      logStep('admin assigned approved host directly');

      await waitForAuditLog({
        actionType: 'ADMIN_SERVICE_HOST_ASSIGN',
        targetType: 'service_request',
        targetId: fixture.requestId,
      });

      await waitForNotification({
        userId: hostId,
        type: 'service_host_selected',
        linkIncludes: `inquiryId=${assignHostPayload.data?.hostInquiryId}`,
      });
      logStep('host received assignment notification');

      await expect
        .poll(async () => {
          const { data, error } = await getTestAdminClient()
            .from('service_requests')
            .select('status, selected_host_id')
            .eq('id', fixture.requestId)
            .maybeSingle<{ status: string | null; selected_host_id: string | null }>();

          if (error) throw error;
          return data;
        })
        .toMatchObject({
          status: 'matched',
          selected_host_id: hostId,
        });

      const { data: hostInquiry, error: hostInquiryError } = await getTestAdminClient()
        .from('inquiries')
        .select('id, user_id, host_id, service_request_id, type')
        .eq('service_request_id', fixture.requestId)
        .eq('host_id', hostId)
        .eq('type', 'general')
        .maybeSingle();
      if (hostInquiryError || !hostInquiry?.id) {
        throw hostInquiryError || new Error('Direct assignment did not create dedicated host inquiry.');
      }
      expect(hostInquiry).toMatchObject({ user_id: customerId, host_id: hostId });
      expect(String(hostInquiry.id)).toBe(assignHostPayload.data?.hostInquiryId);
      createdInquiryIds.push(hostInquiry.id);

      await customerPage.goto(`/services/${fixture.requestId}`, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(customerPage);
      await customerPage.getByRole('button', { name: '호스트와 대화' }).click();
      await customerPage.waitForURL(/\/guest\/inbox\?inquiryId=/, { timeout: 20000 });
      const customerInboxUrl = new URL(customerPage.url());
      const inquiryId = customerInboxUrl.searchParams.get('inquiryId');
      expect(inquiryId).toBeTruthy();
      createdInquiryIds.push(inquiryId!);
      logStep(`customer opened inquiry ${inquiryId}`);

      const guestMessage = `release 서비스 게스트 메시지 ${Date.now()}`;
      const guestInput = customerPage.getByPlaceholder('메시지 입력...');
      await expect(guestInput).toBeVisible({ timeout: 20000 });
      await guestInput.fill(guestMessage);
      await guestInput.press('Enter');
      await expect(
        customerPage
          .getByTestId('guest-inbox-message-thread')
          .locator('div.bg-black.text-white')
          .filter({ hasText: guestMessage })
          .last()
      ).toBeVisible({ timeout: 15000 });
      logStep('guest message sent');

      await waitForNotification({
        userId: hostId,
        type: 'new_message',
        linkIncludes: `inquiryId=${inquiryId}`,
      });
      logStep('host received new_message notification');

      await hostPage.goto(`/services/${fixture.requestId}`, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(hostPage);
      await hostPage.getByRole('button', { name: '고객과 대화' }).click();
      await hostPage.waitForURL(new RegExp(`/host/dashboard\\?tab=inquiries&inquiryId=${inquiryId}`), {
        timeout: 20000,
      });
      await expect(
        hostPage
          .locator('div.bg-white.border.border-gray-200')
          .filter({ hasText: guestMessage })
          .last()
      ).toBeVisible({ timeout: 20000 });
      logStep('host opened inquiry detail');

      const hostReply = `release 서비스 호스트 답장 ${Date.now()}`;
      const hostReplyInput = hostPage.getByPlaceholder('답장 입력...');
      await expect(hostReplyInput).toBeVisible({ timeout: 20000 });
      await hostReplyInput.fill(hostReply);
      await hostReplyInput.press('Enter');
      await expect(
        hostPage
          .locator('div.bg-black.text-white')
          .filter({ hasText: hostReply })
          .last()
      ).toBeVisible({ timeout: 15000 });
      logStep('host reply sent');

      await waitForNotification({
        userId: customerId,
        type: 'new_message',
        linkIncludes: `inquiryId=${inquiryId}`,
      });
      logStep('customer received new_message notification');

      await expect
        .poll(async () => {
          const { count, error } = await getTestAdminClient()
            .from('inquiry_messages')
            .select('*', { count: 'exact', head: true })
            .eq('inquiry_id', inquiryId!);

          if (error) throw error;
          return count ?? 0;
        })
        .toBeGreaterThanOrEqual(2);

      const inquirySupportsServiceRequestId = await supportsServiceRequestId();
      const { data: inquiryRow, error: inquiryError } = await getTestAdminClient()
        .from('inquiries')
        .select('id, user_id, host_id, service_request_id')
        .eq('id', inquiryId!)
        .maybeSingle<{
          id: string | number;
          user_id: string;
          host_id: string | null;
          service_request_id?: string | null;
        }>();

      if (inquiryError) throw inquiryError;

      expect(inquiryRow).toMatchObject({
        id: Number(inquiryId!),
        user_id: customerId,
        host_id: hostId,
      });

      if (inquirySupportsServiceRequestId) {
        expect(inquiryRow?.service_request_id).toBe(fixture.requestId);
      }
    } finally {
      await Promise.all([
        adminSession.context.close(),
        hostSession.context.close(),
        customerSession.context.close(),
      ]);
    }
  });
});
