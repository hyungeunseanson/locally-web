import { existsSync, readFileSync, unlinkSync } from 'fs';

import { expect, test } from '@playwright/test';

const MOCK_CAPTURE_PATH = '/tmp/locally-mock-nodemailer.jsonl';

function readLatestMockMail() {
  const content = readFileSync(MOCK_CAPTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);

  const latest = content.at(-1);
  if (!latest) {
    throw new Error('No mock mail was captured.');
  }

  return JSON.parse(latest) as {
    to: string;
    subject: string;
    html: string;
    from?: string;
  };
}

test.describe('Partnership inquiry route', () => {
  test('rejects incomplete payloads', async ({ request }) => {
    const response = await request.post('/api/company/partnership-inquiry', {
      data: {
        companyName: '',
        email: 'invalid',
        message: 'short',
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
  });

  test('captures a partnership inquiry mail for locally.partners@gmail.com in non-production', async ({ request }) => {
    if (existsSync(MOCK_CAPTURE_PATH)) {
      unlinkSync(MOCK_CAPTURE_PATH);
    }

    const response = await request.post('/api/company/partnership-inquiry', {
      data: {
        companyName: 'Playwright Partnership Co',
        email: 'marketing@example.com',
        message: '브랜드 협업 가능 여부와 예상 단가를 안내받고 싶습니다.',
      },
    });

    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      provider: 'mock',
      recipient: 'locally.partners@gmail.com',
    });

    expect(existsSync(MOCK_CAPTURE_PATH)).toBeTruthy();

    const mail = readLatestMockMail();
    expect(mail.to).toBe('locally.partners@gmail.com');
    expect(mail.subject).toContain('[Locally Partnership] Playwright Partnership Co');
    expect(mail.html).toContain('새로운 광고 · 제휴 문의가 도착했습니다');
    expect(mail.html).toContain('marketing@example.com');
    expect(mail.html).toContain('Playwright Partnership Co');
  });
});
