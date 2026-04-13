import { expect, test } from '@playwright/test';

const notFoundPagePattern =
  /페이지를 찾을 수 없습니다|요청하신 페이지가 존재하지 않거나 이동되었습니다.|This page could not be found|404/;

test.describe('Internal footer test route is not public', () => {
  test('returns 404 for the retired footer-test page', async ({ request }) => {
    const response = await request.get('/footer-test');
    const html = await response.text();

    expect(response.status()).toBe(404);
    expect(html).toMatch(notFoundPagePattern);
  });
});
