import crypto from 'crypto';

import { expect, test } from '@playwright/test';

import { buildNicePayLaunchFields } from '@/app/utils/payments/card/server';

const ORIGINAL_ENV = {
  CARD_PAYMENT_PROVIDER: process.env.CARD_PAYMENT_PROVIDER,
  NICEPAY_MID: process.env.NICEPAY_MID,
  NICEPAY_MERCHANT_KEY: process.env.NICEPAY_MERCHANT_KEY,
};

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function withNicePayEnv() {
  process.env.CARD_PAYMENT_PROVIDER = 'nicepay';
  process.env.NICEPAY_MID = 'nicepay-test-mid';
  process.env.NICEPAY_MERCHANT_KEY = 'nicepay-test-merchant-key';
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

test('keeps NicePay launch display fields inside WebStd limits', () => {
  withNicePayEnv();

  const fields = buildNicePayLaunchFields({
    orderId: 'ORD-NICEPAY-LONG-FIELDS',
    productName: '[NICEPAY LIVE TEST] 100원 실결제 정산 검수 20260703210114',
    amount: 110,
    buyerName: 'Locally Guest Test 20260703210114',
    buyerTel: '+82 10-4110-1230',
    buyerEmail: 'very-long-nicepay-review-address-that-should-be-truncated@example.com',
    returnUrl: 'https://locally.example/api/payment/nicepay/relay',
  });

  expect(Buffer.byteLength(fields.GoodsName, 'utf8')).toBeLessThanOrEqual(40);
  expect(Buffer.byteLength(fields.BuyerName, 'utf8')).toBeLessThanOrEqual(30);
  expect(Buffer.byteLength(fields.BuyerTel, 'utf8')).toBeLessThanOrEqual(20);
  expect(Buffer.byteLength(fields.BuyerEmail, 'utf8')).toBeLessThanOrEqual(60);
  expect(fields.GoodsName).not.toMatch(/[\[\]{}"']/);
  expect(fields).not.toHaveProperty('ConnWithIframe');
  expect(fields.BuyerName).toBe('Locally Guest Test 20260703210');
  expect(fields.BuyerTel).toBe('821041101230');
  expect(fields.SignData).toBe(
    sha256Hex(`${fields.EdiDate}${fields.MID}${fields.Amt}${process.env.NICEPAY_MERCHANT_KEY}`)
  );
});
