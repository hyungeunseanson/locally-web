import { readFileSync } from 'fs';

import { expect, test } from '@playwright/test';

const sharedInquiryPath =
  '/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts';

test.describe('Inquiry email provider contract', () => {
  test('does not hardcode a shared Gmail env gate before delegating to the templated email delivery layer', () => {
    const source = readFileSync(sharedInquiryPath, 'utf8');

    expect(source).toContain("templateId: 'inquiry.new_message'");
    expect(source).toContain("transportPolicy: 'transactional'");
    expect(source).not.toContain('if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;');
  });
});
