import { expect, test } from '@playwright/test';

test.use({ locale: 'ko-KR' });

const NOTICE_LOCALE_CASES = [
  {
    path: '/company/notices',
    heading: '공지사항',
    description: 'Locally의 중요한 소식들을 전해드립니다.',
    type: '공지',
    title: 'Locally 웹사이트 오픈 안내',
    content: ['새롭게 오픈', '1:1 문의', '감사합니다'],
  },
  {
    path: '/en/company/notices',
    heading: 'Notices',
    description: 'Important updates from Locally.',
    type: 'Notice',
    title: 'Locally website launch notice',
    content: ['website is now open', '1:1 inquiry', 'Thank you'],
  },
  {
    path: '/ja/company/notices',
    heading: 'お知らせ',
    description: 'Locallyからの重要なお知らせをお届けします。',
    type: 'お知らせ',
    title: 'Locallyウェブサイト公開のお知らせ',
    content: ['新しくオープンしました', '1:1お問い合わせ', 'ありがとうございます'],
  },
  {
    path: '/zh/company/notices',
    heading: '公告',
    description: '查看 Locally 的重要公告与最新消息。',
    type: '公告',
    title: 'Locally 网站上线公告',
    content: ['正式上线', '1:1 咨询', '谢谢'],
  },
] as const;

test.describe('Public company notices surface', () => {
  for (const testCase of NOTICE_LOCALE_CASES) {
    test(`renders localized notices for ${testCase.path}`, async ({ page }) => {
      await page.goto(testCase.path, { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { name: testCase.heading, exact: true })).toBeVisible();
      await expect(page.getByText(testCase.description, { exact: true })).toBeVisible();

      await expect(page.getByTestId('company-notice-item')).toHaveCount(1);
      await expect(page.getByTestId('company-notice-type-1')).toHaveText(testCase.type);
      await expect(page.getByTestId('company-notice-date-1')).toHaveText('Apr 29, 2026');
      await expect(page.getByTestId('company-notice-title-1')).toHaveText(testCase.title);

      await page.getByTestId('company-notice-toggle-1').click();

      const content = page.getByTestId('company-notice-content-1');
      for (const expectedText of testCase.content) {
        await expect(content).toContainText(expectedText);
      }
    });
  }
});
