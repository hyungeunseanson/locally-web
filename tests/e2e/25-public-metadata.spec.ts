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
  {
    path: '/help',
    title: '도움말 센터 | Locally',
    description: '예약, 취소, 계정, 호스트 운영, 1:1 문의까지 Locally 이용 중 자주 묻는 질문을 확인하세요.',
  },
  {
    path: '/community',
    title: '로컬리 콘텐츠 | Locally',
    description: '로컬이 직접 정리한 여행 콘텐츠 — 루트, 맛집, 현지 추천 정보를 확인하세요.',
  },
  {
    path: '/company/news',
    title: '뉴스룸 | Locally',
    description: '검증이 끝난 외부 기사 링크가 순차적으로 반영되는 Locally 뉴스룸 아카이브 프리뷰입니다.',
  },
  {
    path: '/company/careers',
    title: '채용 | Locally',
    description: 'Locally 채용 방향과 예정 역할을 소개하는 프리뷰 페이지입니다. 공식 지원 링크는 오픈 시점에만 공개됩니다.',
  },
  {
    path: '/company/investors',
    title: '투자자 정보 | Locally',
    description: 'Locally 투자자 정보 프리뷰 페이지입니다. 공식 리포트와 검증된 자료는 공개 시점에 순차적으로 반영됩니다.',
  },
  {
    path: '/services/intro',
    title: '일본 현지인 동행 가이드 맞춤 의뢰 | Locally',
    description: '도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.',
  },
  {
    path: '/site-map',
    title: '사이트맵 | Locally',
    description: 'Locally의 주요 공개 페이지와 안내 페이지를 한눈에 확인할 수 있는 사이트맵입니다.',
  },
] as const;

test.describe('Public metadata smoke', () => {
  for (const item of EXPECTED_META) {
    test(`serves page-level metadata for ${item.path}`, async ({ page }) => {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveTitle(item.title);

      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', item.description);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute(
        'href',
        new RegExp(`${item.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
      );
    });
  }

  test('keeps locale-prefixed public pages canonicalized to primary no-prefix routes', async ({ page }) => {
    const cases = [
      { path: '/en/about', canonicalPath: '/about' },
      { path: '/ja/community', canonicalPath: '/community' },
      { path: '/zh/services/intro', canonicalPath: '/services/intro' },
    ] as const;

    for (const item of cases) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`${item.canonicalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
      );
    }
  });
});
