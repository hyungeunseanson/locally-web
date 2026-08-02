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
  supportsServiceRequestId,
  waitForAuditLog,
  waitForNotification,
} from './helpers/releaseJourney';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
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
      description: '서비스 host apply full journey 검증용 활성 체험입니다.',
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
  const title = `[Playwright] Release Service Journey ${timestamp}`;

  const { data: requestRow, error: requestError } = await supabase
    .from('service_requests')
    .insert({
      user_id: params.customerId,
      title,
      description: 'release full journey 서비스 의뢰입니다. 입금 확인 후 모집을 열고 매칭 후 채팅까지 이어집니다.',
      city: 'Seoul',
      country: 'Korea',
      service_date: formatDate(serviceDate),
      start_time: '10:00',
      duration_hours: 4,
      languages: ['한국어', 'English'],
      guest_count: 2,
      contact_name: params.customer.fullName,
      contact_phone: params.customer.phone,
      status: 'pending_payment',
    })
    .select('id, title, total_customer_price, total_host_payout')
    .single();

  if (requestError || !requestRow?.id) {
    throw requestError || new Error('Failed to create service request fixture.');
  }

  createdServiceRequestIds.push(requestRow.id);

  const orderId = `REL-SVC-BANK-${timestamp}-${Math.random().toString(16).slice(2, 8)}`;
  const { error: bookingError } = await supabase.from('service_bookings').insert({
    id: orderId,
    order_id: orderId,
    request_id: requestRow.id,
    application_id: null,
    customer_id: params.customerId,
    host_id: null,
    amount: Number(requestRow.total_customer_price || 0),
    host_payout_amount: Number(requestRow.total_host_payout || 0),
    platform_revenue:
      Number(requestRow.total_customer_price || 0) - Number(requestRow.total_host_payout || 0),
    status: 'PENDING',
    payment_method: 'bank',
    payout_status: 'pending',
    contact_name: params.customer.fullName,
    contact_phone: params.customer.phone,
  });

  if (bookingError) {
    throw bookingError;
  }

  createdAuditTargetIds.push(orderId);

  return {
    requestId: requestRow.id,
    orderId,
    title: String(requestRow.title || title),
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

  for (const email of createdWhitelistEmails) {
    await supabase.from('admin_whitelist').delete().eq('email', email);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('users').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test.describe.serial('Release journey 191: service bank open -> match -> chat', () => {
  test('covers admin confirm, host apply, customer select, and shared inquiry handoff', async ({
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
    createdWhitelistEmails.push(adminUser.email);

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
      await expect(adminPage.getByText(fixture.title)).toBeVisible({ timeout: 20000 });

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
      await expect(adminPage.getByText('입금 확인 완료. 의뢰가 공개되었습니다.')).toBeVisible({
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
        .toBe('open');

      await hostPage.goto(`/services/${fixture.requestId}/apply`, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(hostPage);
      await expect(
        hostPage.getByRole('heading', { name: /서비스 지원하기|Apply for Request/ })
      ).toBeVisible({
        timeout: 20000,
      });
      await hostPage
        .locator('textarea')
        .fill('서울 현지 진행 경험과 통역 경험이 있어 이번 서비스 의뢰를 안정적으로 끝까지 진행할 수 있습니다.');
      await hostPage.getByRole('button', { name: '지원 완료하기' }).click();
      await hostPage.waitForURL(new RegExp(`/services/${fixture.requestId}$`), { timeout: 20000 });
      await expect(hostPage.getByText('지원이 완료되었습니다! 고객의 선택을 기다려주세요.')).toBeVisible({
        timeout: 15000,
      });
      logStep('host application submitted');

      await waitForNotification({
        userId: customerId,
        type: 'service_application_new',
        linkIncludes: `/services/${fixture.requestId}`,
      });
      logStep('customer received application notification');

      await customerPage.goto(`/services/${fixture.requestId}`, { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(customerPage);
      await expect(customerPage.getByRole('heading', { name: fixture.title })).toBeVisible({
        timeout: 20000,
      });
      await customerPage.getByRole('button', { name: '이 호스트 선택' }).first().click();
      await confirmDialogAction(customerPage, '이 호스트를 선택하시겠습니까?', '이 호스트 선택');
      await expect(customerPage.getByText('호스트 선택 완료! 매칭이 확정되었습니다.')).toBeVisible({
        timeout: 20000,
      });
      logStep('customer selected host');

      await waitForNotification({
        userId: hostId,
        type: 'service_host_selected',
        linkIncludes: `/services/${fixture.requestId}`,
      });
      logStep('host received selected notification');

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

      await customerPage.reload({ waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(customerPage);
      await customerPage.getByRole('button', { name: '호스트에게 메시지' }).click();
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
      await hostPage.getByRole('button', { name: '고객에게 메시지' }).click();
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
