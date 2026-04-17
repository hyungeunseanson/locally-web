import { expect, test } from '@playwright/test';

import { createAuthUser, createTestUser, getTestAdminClient } from './helpers/testSupabase';
import {
  createIsolatedPage,
  dismissAnnouncementIfVisible,
  setPreferredLocale,
  waitForAuditLog,
  waitForNotification,
} from './helpers/releaseJourney';

const createdAuthUserIds: string[] = [];
const createdWhitelistEmails: string[] = [];
const createdProxyRequestIds: string[] = [];
const createdInquiryIds: Array<string | number> = [];
const createdAuditTargetIds: string[] = [];

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdAuthUserIds.length > 0) {
    await supabase.from('notifications').delete().in('user_id', createdAuthUserIds);
  }

  if (createdAuditTargetIds.length > 0) {
    await supabase.from('admin_audit_logs').delete().in('target_id', createdAuditTargetIds);
  }

  if (createdInquiryIds.length > 0) {
    await supabase.from('inquiry_messages').delete().in('inquiry_id', createdInquiryIds);
    await supabase.from('inquiries').delete().in('id', createdInquiryIds);
  }

  if (createdProxyRequestIds.length > 0) {
    await supabase.from('proxy_requests').delete().in('id', createdProxyRequestIds);
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

test.describe.serial('Release journey 192: proxy self-service -> admin refund -> linked inquiry', () => {
  test('keeps proxy detail, linked inquiry, notifications, and refund state aligned', async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const logStep = (message: string) => console.log(`[release-192] ${message}`);

    const adminUser = createTestUser('release.proxy.admin');
    const customerUser = createTestUser('release.proxy.customer');

    const adminId = await createAuthUser(adminUser, { isAdmin: true });
    const customerId = await createAuthUser(customerUser);
    createdAuthUserIds.push(adminId, customerId);
    createdWhitelistEmails.push(adminUser.email);

    await Promise.all([
      setPreferredLocale(adminId, 'ko'),
      setPreferredLocale(customerId, 'ko'),
    ]);

    const customerSession = await createIsolatedPage(browser, customerUser, 'ko');
    const adminSession = await createIsolatedPage(browser, adminUser, 'ko');

    try {
      const customerPage = customerSession.page;
      const adminPage = adminSession.page;

      const restaurantName = `release 전화예약 ${Date.now()}`;
      const today = new Date();
      const targetDay = Math.min(
        today.getDate() + 3,
        new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      );
      const targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(targetDay).padStart(2, '0')}`;

      await customerPage.goto('/', { waitUntil: 'networkidle' });
      await dismissAnnouncementIfVisible(customerPage);
      await customerPage.getByRole('button', { name: '서비스' }).first().click();
      await customerPage.getByRole('link', { name: /일본 전화 예약 · 문의 대행/ }).click();
      await customerPage.waitForURL(/\/proxy-bookings\/new/, { timeout: 20000 });
      await dismissAnnouncementIfVisible(customerPage);
      await expect(
        customerPage.getByRole('heading', { name: '일본인이 대신 전화 예약을 도와드립니다' })
      ).toBeVisible({ timeout: 20000 });

      await customerPage.getByPlaceholder('예: 스시 지로').fill(restaurantName);
      await customerPage.getByTestId('preferred-slot-primary-trigger').click();
      await customerPage.getByTestId(`preferred-slot-primary-day-${targetDate}`).click();
      await customerPage.getByTestId('preferred-slot-primary-time-19:00').click();
      await customerPage.getByTestId('preferred-slot-primary-confirm').click();

      await customerPage.getByTestId('preferred-slot-secondary-trigger').click();
      await customerPage.getByTestId(`preferred-slot-secondary-day-${targetDate}`).click();
      await customerPage.getByTestId('preferred-slot-secondary-time-19:30').click();
      await customerPage.getByTestId('preferred-slot-secondary-confirm').click();

      await customerPage.getByTestId('preferred-slot-tertiary-trigger').click();
      await customerPage.getByTestId(`preferred-slot-tertiary-day-${targetDate}`).click();
      await customerPage.getByTestId('preferred-slot-tertiary-time-20:00').click();
      await customerPage.getByTestId('preferred-slot-tertiary-confirm').click();

      await customerPage.getByPlaceholder('예: 홍길동').first().fill(customerUser.fullName);
      await customerPage.locator('input[type="number"]').first().fill('2');
      await customerPage.getByPlaceholder('예: 01012345678').first().fill(customerUser.phone);
      await customerPage.getByRole('radio', { name: /로컬리 자체 결제/ }).check();
      await customerPage.locator('input[type="radio"][value="bank"]').check();
      const paymentSection = customerPage
        .locator('section')
        .filter({ has: customerPage.getByRole('heading', { name: '결제 방식 선택' }) });
      const paymentContactInputs = paymentSection.locator('input:not([type="radio"])');
      await paymentContactInputs.nth(0).fill(customerUser.fullName);
      await paymentContactInputs.nth(1).fill(customerUser.phone);

      const noticeLabel = customerPage.locator('label').filter({
        hasText:
          '유의사항을 확인했고, 예약 가능 여부와 업장 사정에 따라 진행이 제한될 수 있음을 이해했습니다.',
      });
      const noticeCheckbox = noticeLabel.locator('input[type="checkbox"]');
      const termsLabel = customerPage.locator('label').filter({
        hasText: '서비스 기준 및 환불 규정을 확인했고 동의합니다. (필수)',
      });
      const termsCheckbox = termsLabel.locator('input[type="checkbox"]');
      const submitButton = customerPage.getByRole('button', { name: '요청 제출하기' });

      await noticeLabel.click();
      await expect(noticeCheckbox).toBeChecked();
      await termsLabel.click();
      await expect(termsCheckbox).toBeChecked();
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      logStep('proxy request form is complete and submit is enabled');
      await submitButton.click();

      await customerPage.waitForURL(/\/guest\/inbox\?inquiryId=/, { timeout: 20000 });
      const inboxUrl = new URL(customerPage.url());
      const inquiryId = inboxUrl.searchParams.get('inquiryId');
      expect(inquiryId).toBeTruthy();
      createdInquiryIds.push(inquiryId!);
      logStep(`customer opened inquiry ${inquiryId}`);

      const { data: proxyRequest, error: proxyRequestError } = await getTestAdminClient()
        .from('proxy_requests')
        .select('id')
        .eq('user_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (proxyRequestError || !proxyRequest?.id) {
        throw proxyRequestError || new Error('Failed to find the created proxy request.');
      }

      createdProxyRequestIds.push(proxyRequest.id);
      createdAuditTargetIds.push(proxyRequest.id);

      const proxyDetailResponse = await customerPage.request.get(
        `/api/proxy-bookings/${proxyRequest.id}?includeComments=false`
      );
      expect(proxyDetailResponse.ok()).toBeTruthy();
      const proxyDetailPayload = await proxyDetailResponse.json();
      expect(proxyDetailPayload.data.linked_inquiry_id).toBe(inquiryId);
      logStep('proxy detail api linked inquiry aligned');

      await customerPage.goto(`/proxy-bookings/${proxyRequest.id}`, { waitUntil: 'networkidle' });
      await expect(customerPage.getByRole('heading', { name: restaurantName })).toBeVisible({
        timeout: 20000,
      });
      await expect(customerPage.getByText('무통장 입금 안내')).toBeVisible();
      await expect(customerPage.getByRole('link', { name: '메시지함 열기' })).toHaveAttribute(
        'href',
        new RegExp(`inquiryId=${inquiryId}`)
      );
      logStep('customer proxy detail shows bank guidance');

      await adminPage.goto(`/proxy-bookings/${proxyRequest.id}`, { waitUntil: 'networkidle' });
      await expect(adminPage.getByRole('heading', { name: restaurantName })).toBeVisible({
        timeout: 20000,
      });

      await adminPage.getByRole('button', { name: '입금 확인' }).click();
      await expect(adminPage.getByText('결제 완료').first()).toBeVisible({ timeout: 20000 });
      logStep('admin confirmed proxy payment');

      await waitForAuditLog({
        actionType: 'ADMIN_CONFIRM_PROXY_PAYMENT',
        targetType: 'proxy_request',
        targetId: proxyRequest.id,
      });
      await waitForNotification({
        userId: customerId,
        type: 'booking_confirmed',
        title: '전화 예약 결제가 확인되었습니다',
        linkIncludes: `inquiryId=${inquiryId}`,
      });
      logStep('customer received booking_confirmed notification');

      const adminComment = `release 전화예약 운영 코멘트 ${Date.now()}`;
      const commentInput = adminPage.getByPlaceholder('답변을 입력하세요...');
      await commentInput.fill(adminComment);
      await adminPage.locator('form button[type="submit"]').click();
      await expect(adminPage.getByText(adminComment)).toBeVisible({ timeout: 15000 });
      logStep('admin comment posted');

      await waitForNotification({
        userId: customerId,
        type: 'new_message',
        linkIncludes: `inquiryId=${inquiryId}`,
      });
      logStep('customer received new_message notification');

      await adminPage.getByRole('button', { name: '진행 중' }).click();
      await expect
        .poll(async () => {
          const response = await adminPage.request.get(`/api/proxy-bookings/${proxyRequest.id}`);
          const payload = await response.json();
          return payload?.data?.status ?? null;
        }, { timeout: 15000 })
        .toBe('IN_PROGRESS');
      logStep('admin moved proxy request to in-progress');

      await adminPage.getByRole('button', { name: '환불 처리' }).click();
      await expect(adminPage.getByText('환불 완료').first()).toBeVisible({ timeout: 20000 });
      logStep('admin refunded proxy payment');

      await waitForAuditLog({
        actionType: 'ADMIN_REFUND_PROXY_PAYMENT',
        targetType: 'proxy_request',
        targetId: proxyRequest.id,
      });
      await waitForNotification({
        userId: customerId,
        type: 'cancellation',
        title: '전화 예약 결제가 환불 처리되었습니다',
        linkIncludes: `inquiryId=${inquiryId}`,
      });
      logStep('customer received cancellation notification');

      await customerPage.goto(`/proxy-bookings/${proxyRequest.id}`, { waitUntil: 'networkidle' });
      await expect(customerPage.getByRole('heading', { name: restaurantName })).toBeVisible({
        timeout: 20000,
      });
      await expect(customerPage.getByText(adminComment)).toBeVisible({ timeout: 15000 });
      await expect(customerPage.getByText('환불 완료')).toBeVisible();
      await expect(customerPage.getByRole('link', { name: '메시지함 열기' })).toHaveAttribute(
        'href',
        new RegExp(`inquiryId=${inquiryId}`)
      );
      logStep('customer proxy detail reflects refund and comment');

      const { data: linkedInquiry, error: linkedInquiryError } = await getTestAdminClient()
        .from('inquiries')
        .select('id')
        .eq('id', inquiryId!)
        .maybeSingle<{ id: string | number }>();

      if (linkedInquiryError) throw linkedInquiryError;
      expect(linkedInquiry?.id).toBeTruthy();
      logStep('linked inquiry row remained stable after refund flow');
    } finally {
      await Promise.all([customerSession.context.close(), adminSession.context.close()]);
    }
  });
});
