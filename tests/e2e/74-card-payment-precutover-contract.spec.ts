import { expect, test } from '@playwright/test';

test.describe('Card payment pre-cutover contracts', () => {
  test('keeps card-ready response shape stable for experience and service routes', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/payment/card-ready'),
      request.get('/api/services/payment/card-ready'),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toContain('no-store');

      const body = (await response.json()) as {
        provider?: unknown;
        ready?: unknown;
        missingConfig?: unknown;
        reason?: unknown;
        runtime?: unknown;
      };

      expect(typeof body.provider).toBe('string');
      expect(typeof body.ready).toBe('boolean');
      expect(Array.isArray(body.missingConfig)).toBe(true);

      if (body.reason != null) {
        expect(typeof body.reason).toBe('string');
      }

      if (body.runtime != null) {
        expect(typeof body.runtime).toBe('object');
        expect(typeof (body.runtime as { provider?: unknown }).provider).toBe('string');
        expect(typeof (body.runtime as { merchantCode?: unknown }).merchantCode).toBe('string');
        expect(typeof (body.runtime as { scriptSrc?: unknown }).scriptSrc).toBe('string');
      }
    }
  });

  test('keeps card notification routes inert under PortOne while exposing idempotency anchors', async ({
    request,
  }) => {
    const experienceResponse = await request.post('/api/payment/card-notification', {
      data: {
        orderId: 'EXP-CARD-NOTI-TEST',
        approvalId: 'imp_test_approval_id',
        amount: 55000,
        status: 'paid',
      },
    });

    expect(experienceResponse.status()).toBe(202);
    await expect(experienceResponse.json()).resolves.toMatchObject({
      success: true,
      ignored: true,
      orderId: 'EXP-CARD-NOTI-TEST',
      idempotencyKey: 'EXP-CARD-NOTI-TEST',
    });

    const serviceResponse = await request.post('/api/services/payment/card-notification', {
      form: {
        Moid: 'SVC-CARD-NOTI-TEST',
        TID: 'tid_test_value',
        Amt: '88000',
        ResultCode: '0000',
      },
    });

    expect(serviceResponse.status()).toBe(202);
    await expect(serviceResponse.json()).resolves.toMatchObject({
      success: true,
      ignored: true,
      orderId: 'SVC-CARD-NOTI-TEST',
      idempotencyKey: 'SVC-CARD-NOTI-TEST',
    });

    const proxyResponse = await request.post('/api/proxy-bookings/payment/card-notification', {
      form: {
        Moid: 'LOCALLY-PROXY-NOTI-TEST',
        TID: 'proxy_tid_test_value',
        Amt: '4500',
        ResultCode: '0000',
      },
    });

    expect(proxyResponse.status()).toBe(202);
    await expect(proxyResponse.json()).resolves.toMatchObject({
      success: true,
      ignored: true,
      orderId: 'LOCALLY-PROXY-NOTI-TEST',
      idempotencyKey: 'LOCALLY-PROXY-NOTI-TEST',
    });
  });
});
