import { expect, test } from '@playwright/test';

import { resolveGmailSenderProfile } from '@/app/emails/delivery/sendTemplatedEmail';

test.describe('Admin email sender contract', () => {
  test('prefers dedicated admin Gmail credentials for ops admin transport when configured', () => {
    const sender = resolveGmailSenderProfile('opsAdmin', {
      ADMIN_GMAIL_USER: 'partner.locally@gmail.com',
      ADMIN_GMAIL_APP_PASSWORD: 'admin-pass',
      GMAIL_USER: 'locally.partners@gmail.com',
      GMAIL_APP_PASSWORD: 'general-pass',
    });

    expect(sender).toEqual({
      user: 'partner.locally@gmail.com',
      pass: 'admin-pass',
      from: '"Locally Admin" <partner.locally@gmail.com>',
    });
  });

  test('falls back to the shared Gmail sender for ops admin transport when dedicated admin credentials are missing', () => {
    const sender = resolveGmailSenderProfile('opsAdmin', {
      GMAIL_USER: 'locally.partners@gmail.com',
      GMAIL_APP_PASSWORD: 'general-pass',
    });

    expect(sender).toEqual({
      user: 'locally.partners@gmail.com',
      pass: 'general-pass',
      from: '"Locally Team" <locally.partners@gmail.com>',
    });
  });

  test('keeps transactional mail on the shared Gmail sender even when dedicated admin credentials exist', () => {
    const sender = resolveGmailSenderProfile('transactional', {
      ADMIN_GMAIL_USER: 'partner.locally@gmail.com',
      ADMIN_GMAIL_APP_PASSWORD: 'admin-pass',
      GMAIL_USER: 'locally.partners@gmail.com',
      GMAIL_APP_PASSWORD: 'general-pass',
    });

    expect(sender).toEqual({
      user: 'locally.partners@gmail.com',
      pass: 'general-pass',
      from: '"Locally Team" <locally.partners@gmail.com>',
    });
  });
});
