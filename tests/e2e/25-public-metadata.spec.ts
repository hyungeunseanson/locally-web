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
    title: '커뮤니티 | Locally',
    description: '현지인과 여행자들이 생생한 정보를 나누고 동행을 구하는 로컬리 커뮤니티',
  },
  {
    path: '/company/news',
    title: '뉴스룸 | Locally',
    description: 'Locally의 주요 소식, 보도자료, 미디어 노출을 한곳에서 확인할 수 있는 뉴스룸입니다.',
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
      await page.goto(item.path, { waitUntil: 'networkidle' });

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
});
