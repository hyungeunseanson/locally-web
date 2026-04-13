import { expect, test } from '@playwright/test';

const notFoundPagePattern =
  /페이지를 찾을 수 없습니다|요청하신 페이지가 존재하지 않거나 이동되었습니다.|This page could not be found|404/;

test.describe('Legacy payment success route gate', () => {
  test('returns 404 without an orderId query', async ({ request }) => {
    const response = await request.get('/payment/success');
    const html = await response.text();

    expect(response.status()).toBe(404);
    expect(html).toMatch(notFoundPagePattern);
  });

  test('keeps compatibility access when orderId is present', async ({ request }) => {
    const response = await request.get('/payment/success?orderId=legacy-smoke-order');
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).not.toMatch(/This page could not be found/);
  });
});
