import { existsSync, readFileSync, unlinkSync } from 'fs';

import { expect, test, type APIRequestContext } from '@playwright/test';

const MOCK_CAPTURE_PATH = '/tmp/locally-mock-nodemailer.jsonl';

type PartnershipInquiryPayload = {
  companyName: string;
  email: string;
  message: string;
  website?: string;
};

function clearMockMails() {
  if (existsSync(MOCK_CAPTURE_PATH)) {
    unlinkSync(MOCK_CAPTURE_PATH);
  }
}

function readMockMails() {
  if (!existsSync(MOCK_CAPTURE_PATH)) return [];

  return readFileSync(MOCK_CAPTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as {
      to: string;
      subject: string;
      html: string;
      from?: string;
    });
}

async function submitInquiry(
  request: APIRequestContext,
  data: PartnershipInquiryPayload,
  headers?: Record<string, string>
) {
  return request.post('/api/company/partnership-inquiry', { data, headers });
}

test.describe('Partnership inquiry route', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    clearMockMails();
  });

  test('keeps the honeypot outside the visible UI, accessibility tree, and tab order', async ({ page }) => {
    await page.goto('/company/partnership');

    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');

    const box = await honeypot.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThan(0);
  });

  test('preserves existing required, email, and length validation', async ({ request }) => {
    const invalidPayloads: PartnershipInquiryPayload[] = [
      {
        companyName: '',
        email: 'invalid',
        message: 'short',
      },
      {
        companyName: 'Invalid Email Co',
        email: 'invalid',
        message: '광고 제휴 가능 여부를 문의드립니다.',
      },
      {
        companyName: 'Short Message Co',
        email: 'marketing@example.com',
        message: '짧은 문의',
      },
      {
        companyName: 'A'.repeat(121),
        email: 'marketing@example.com',
        message: '광고 제휴 가능 여부를 문의드립니다.',
      },
      {
        companyName: 'Long Message Co',
        email: 'marketing@example.com',
        message: 'a'.repeat(4001),
      },
    ];

    for (const payload of invalidPayloads) {
      const response = await submitInquiry(request, payload);

      expect(response.status()).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ success: false });
    }

    expect(readMockMails()).toHaveLength(0);
  });

  test('sends a normal Korean inquiry with an empty honeypot', async ({ request }) => {
    const response = await submitInquiry(
      request,
      {
        companyName: 'Playwright Partnership Co',
        email: 'marketing@example.com',
        message: '브랜드 협업 가능 여부와 예상 단가를 안내받고 싶습니다.',
        website: '',
      },
      { origin: 'http://localhost:3000' }
    );

    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      provider: 'mock',
      recipient: 'locally.partners@gmail.com',
    });

    const mails = readMockMails();
    expect(mails).toHaveLength(1);
    const mail = mails[0];
    expect(mail.to).toBe('locally.partners@gmail.com');
    expect(mail.subject).toContain('[Locally Partnership] Playwright Partnership Co');
    expect(mail.html).toContain('새로운 광고 · 제휴 문의가 도착했습니다');
    expect(mail.html).toContain('marketing@example.com');
    expect(mail.html).toContain('Playwright Partnership Co');
  });

  test('sends a normal English inquiry', async ({ request }) => {
    const response = await submitInquiry(request, {
      companyName: 'English Campaign Co',
      email: 'campaign@example.com',
      message: 'We would like to discuss an Instagram campaign partnership.',
    });

    expect(response.ok()).toBeTruthy();
    expect(readMockMails()).toHaveLength(1);
  });

  test('rejects numeric-only and numeric-symbol-only messages without sending mail', async ({ request }) => {
    for (const message of ['7733701795', '1234-5678-90 !!!']) {
      const response = await submitInquiry(request, {
        companyName: 'Automated LLC',
        email: 'generated@example.com',
        message,
      });

      expect(response.status()).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ success: false });
    }

    expect(readMockMails()).toHaveLength(0);
  });

  test('allows a normal inquiry containing numbers', async ({ request }) => {
    const response = await submitInquiry(request, {
      companyName: 'August Campaign Co',
      email: 'august@example.com',
      message: '2026年8月27日の日本旅行キャンペーンについて問い合わせます。Budget 1000000 KRW.',
    });

    expect(response.ok()).toBeTruthy();
    expect(readMockMails()).toHaveLength(1);
  });

  test('silently accepts a filled honeypot without sending mail', async ({ request }) => {
    const response = await submitInquiry(request, {
      companyName: 'Honeypot Bot LLC',
      email: 'bot@example.com',
      message: 'This payload would otherwise pass normal validation.',
      website: 'https://spam.example',
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(readMockMails()).toHaveLength(0);
  });

  test('rejects an explicit cross-site browser request without sending mail', async ({ request }) => {
    const response = await submitInquiry(
      request,
      {
        companyName: 'Cross Site Co',
        email: 'cross-site@example.com',
        message: 'This request should be rejected before email delivery.',
      },
      {
        origin: 'https://spam.example',
        'sec-fetch-site': 'cross-site',
      }
    );

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ success: false });
    expect(readMockMails()).toHaveLength(0);
  });
});
