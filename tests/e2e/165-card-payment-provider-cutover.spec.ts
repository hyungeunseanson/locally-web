import crypto from 'crypto';

import { expect, test } from '@playwright/test';

import {
  buildNicePayLaunchFields,
  getCardPaymentReadiness,
  verifyApprovedCardPayment,
  verifyCardPaymentNotification,
  readCardPaymentNotificationRequest,
} from '@/app/utils/payments/card/server';

const NICEPAY_STATUS_QUERY_URL = 'https://pg-api.nicepay.co.kr/webapi/common/trans_status.jsp';
const ORIGINAL_ENV = {
  CARD_PAYMENT_PROVIDER: process.env.CARD_PAYMENT_PROVIDER,
  NICEPAY_MID: process.env.NICEPAY_MID,
  NICEPAY_MERCHANT_KEY: process.env.NICEPAY_MERCHANT_KEY,
  NICEPAY_CLIENT_KEY: process.env.NICEPAY_CLIENT_KEY,
  NEXT_PUBLIC_NICEPAY_CLIENT_KEY: process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY,
};

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function withNicePayEnv() {
  process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
  process.env.NICEPAY_MID = 'nicepay-test-mid';
  process.env.NICEPAY_MERCHANT_KEY = 'nicepay-test-merchant-key';
  process.env.NICEPAY_CLIENT_KEY = 'nicepay-server-client-key';
  process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = 'nicepay-public-client-key';
}

function resetEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test.afterEach(() => {
  resetEnv();
});

test.describe('Card payment provider cutover contracts', () => {
  test('requires the full NicePay credential bundle before the provider is ready', () => {
    process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
    delete process.env.NICEPAY_MID;
    delete process.env.NICEPAY_MERCHANT_KEY;
    delete process.env.NICEPAY_CLIENT_KEY;
    delete process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;

    const readiness = getCardPaymentReadiness();

    expect(readiness).toMatchObject({
      provider: 'nicepay',
      ready: false,
      reason: 'missing_nicepay_credentials',
    });
    expect(readiness.missingConfig).toEqual([
      'NICEPAY_MID',
      'NICEPAY_MERCHANT_KEY',
      'NICEPAY_CLIENT_KEY',
      'NEXT_PUBLIC_NICEPAY_CLIENT_KEY',
    ]);
  });

  test('exposes NicePay runtime and signed launch fields once the full bundle exists', () => {
    withNicePayEnv();

    const readiness = getCardPaymentReadiness();
    expect(readiness).toMatchObject({
      provider: 'nicepay',
      ready: true,
      runtime: {
        provider: 'nicepay',
        merchantCode: 'nicepay-test-mid',
        publicClientKey: 'nicepay-public-client-key',
      },
    });
    expect(readiness.runtime?.scriptSrc).toContain('nicepay-pg-web.js');

    const fields = buildNicePayLaunchFields({
      orderId: 'ORD-NICEPAY-001',
      productName: 'Locally Test Product',
      amount: 55000,
      buyerName: '테스트 고객',
      buyerTel: '01012345678',
      buyerEmail: 'test@example.com',
      returnUrl: 'https://locally.example/api/payment/nicepay/relay',
    });

    expect(fields).toMatchObject({
      MID: 'nicepay-test-mid',
      Moid: 'ORD-NICEPAY-001',
      Amt: '55000',
      ReturnURL: 'https://locally.example/api/payment/nicepay/relay',
      PayMethod: 'CARD',
    });
    expect(fields.SignData).toBe(
      sha256Hex(`${fields.EdiDate}${fields.MID}${fields.Amt}${process.env.NICEPAY_MERCHANT_KEY}`)
    );
  });

  test('verifies NicePay approval payloads through the server-side approval API', async () => {
    withNicePayEnv();

    const authToken = 'AUTH-TOKEN-001';
    const amount = 88000;
    const providerPayload = {
      AuthResultCode: '0000',
      AuthToken: authToken,
      TxTid: 'TX-TID-001',
      MID: process.env.NICEPAY_MID!,
      Moid: 'ORD-NICEPAY-VERIFY-001',
      Amt: String(amount),
      NextAppURL: 'https://webapi.nicepay.co.kr/webapi/pay_process.jsp',
      PayMethod: 'CARD',
      Signature: sha256Hex(
        `${authToken}${process.env.NICEPAY_MID}${amount}${process.env.NICEPAY_MERCHANT_KEY}`
      ),
    };

    const originalFetch = global.fetch;
    global.fetch = (async (input, init) => {
      expect(String(input)).toBe('https://webapi.nicepay.co.kr/webapi/pay_process.jsp');
      expect(init?.method).toBe('POST');
      const body = new URLSearchParams(String(init?.body || ''));
      expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
      expect(body.get('AuthToken')).toBe(authToken);
      expect(body.get('Amt')).toBe(String(amount));

      return new Response(
        JSON.stringify({
          ResultCode: '3001',
          ResultMsg: 'Approval complete',
          TID: 'TX-TID-001',
          Moid: 'ORD-NICEPAY-VERIFY-001',
          Amt: String(amount),
          PayMethod: 'CARD',
          Signature: sha256Hex(
            `TX-TID-001${process.env.NICEPAY_MID}${amount}${process.env.NICEPAY_MERCHANT_KEY}`
          ),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const result = await verifyApprovedCardPayment({
        provider: 'nicepay',
        approvalId: 'TX-TID-001',
        orderId: 'ORD-NICEPAY-VERIFY-001',
        expectedAmount: amount,
        providerPayload,
      });

      expect(result).toMatchObject({
        provider: 'nicepay',
        approvedAmount: amount,
        providerTransactionId: 'TX-TID-001',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('verifies NicePay notifications through the transaction status query', async () => {
    withNicePayEnv();

    const notification = await readCardPaymentNotificationRequest(
      new Request('https://locally.example/api/payment/card-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Moid: 'ORD-NICEPAY-NOTI-001',
          TID: 'TX-TID-NOTI-001',
          Amt: '45000',
          ResultCode: '3001',
          StateCd: '0',
          PayMethod: 'CARD',
        }).toString(),
      })
    );

    const originalFetch = global.fetch;
    global.fetch = (async (input, init) => {
      expect(String(input)).toBe(NICEPAY_STATUS_QUERY_URL);
      expect(init?.method).toBe('POST');
      const body = new URLSearchParams(String(init?.body || ''));
      expect(body.get('MID')).toBe(process.env.NICEPAY_MID);
      expect(body.get('TID')).toBe('TX-TID-NOTI-001');

      return new Response(
        JSON.stringify({
          ResultCode: '0000',
          ResultMsg: 'OK',
          Status: '0',
          TID: 'TX-TID-NOTI-001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const result = await verifyCardPaymentNotification({
        notification,
        orderId: 'ORD-NICEPAY-NOTI-001',
        expectedAmount: 45000,
      });

      expect(result).toMatchObject({
        provider: 'nicepay',
        approvedAmount: 45000,
        providerTransactionId: 'TX-TID-NOTI-001',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
