import { readFileSync } from 'fs';

import { expect, test } from '@playwright/test';

const sharedInquiryPath =
  '/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/inquiries/thread/shared.ts';

test.describe('Inquiry email provider contract', () => {
  test('delegates admin inquiry mail to ops admin while routing host and guest mail transactionally', () => {
    const source = readFileSync(sharedInquiryPath, 'utf8');

    expect(source).toContain("templateId: 'inquiry.new_message'");
    expect(source).toContain('audience: resolveInquiryEmailAudience({');
    expect(source).toContain("transportPolicy: audience === 'admin' ? 'opsAdmin' : 'transactional'");
    expect(source).not.toContain("const audience = localizeEmailForRecipient ? 'guest' : 'admin';");
    expect(source).not.toContain('findRecipientEmail');
    expect(source).not.toContain('if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;');
  });
});
