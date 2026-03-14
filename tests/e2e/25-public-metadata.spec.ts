import { expect, test } from '@playwright/test';

test.use({ locale: 'ko-KR' });

const EXPECTED_META = [
  {
    path: '/about',
    title: 'Locally 소개 | Locally',
    description: '관광보다 삶에 가까운 여행을 만드는 Locally의 철학과 운영 방식을 소개합니다.',
  },
  {
    path: '/search',
    title: '로컬 체험 검색 | Locally',
    description: '도시, 날짜, 언어, 취향에 맞는 로컬 체험을 검색하고 현지 호스트와 특별한 여행을 예약해보세요.',
  },
  {
    path: '/become-a-host',
    title: '호스트 되기 | Locally',
    description: '당신의 동네와 취향을 여행으로 연결하세요. Locally 호스트 지원 절차와 운영 기준을 확인해보세요.',
  },
] as const;

test.describe('Public metadata smoke', () => {
  for (const item of EXPECTED_META) {
    test(`serves page-level metadata for ${item.path}`, async ({ page }) => {
      await page.goto(item.path, { waitUntil: 'networkidle' });

      await expect(page).toHaveTitle(item.title);

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', item.description);
    });
  }
});
