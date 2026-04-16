import { expect, test } from '@playwright/test';

import {
  normalizeInternalReturnPath,
  resolveAuthCallbackOrigin,
} from '@/app/utils/authRedirect';
import { hasSupabaseSessionCookie } from '@/app/utils/supabase/authCookies';

test.describe('Auth runtime contracts', () => {
  test('normalizes return paths to internal relative paths only', () => {
    expect(normalizeInternalReturnPath('/guest/trips?tab=upcoming#receipt')).toBe(
      '/guest/trips?tab=upcoming#receipt'
    );
    expect(normalizeInternalReturnPath(' /account ')).toBe('/account');
    expect(normalizeInternalReturnPath('https://evil.example')).toBe('/');
    expect(normalizeInternalReturnPath('//evil.example')).toBe('/');
    expect(normalizeInternalReturnPath('/\\evil')).toBe('/');
    expect(normalizeInternalReturnPath('/guest/trips\u0000')).toBe('/');
    expect(normalizeInternalReturnPath(null)).toBe('/');
  });

  test('resolves auth callback origin conservatively from the active request host', () => {
    const forwardedHeaders = new Headers({
      'x-forwarded-host': 'www.locally-travel.com',
      'x-forwarded-proto': 'https',
    });

    expect(
      resolveAuthCallbackOrigin(
        'https://locally-web.vercel.app/auth/callback?next=%2Fguest%2Ftrips',
        forwardedHeaders,
        { NODE_ENV: 'production' }
      )
    ).toBe('https://www.locally-travel.com');

    expect(
      resolveAuthCallbackOrigin(
        'http://localhost:3000/auth/callback?next=%2Fguest%2Ftrips',
        forwardedHeaders,
        { NODE_ENV: 'development' }
      )
    ).toBe('http://localhost:3000');

    expect(
      resolveAuthCallbackOrigin(
        'https://locally-web.vercel.app/auth/callback',
        new Headers({ 'x-forwarded-host': 'bad host/evil' }),
        { NODE_ENV: 'production' }
      )
    ).toBe('https://locally-web.vercel.app');
  });

  test('detects only real Supabase session cookies', () => {
    expect(
      hasSupabaseSessionCookie([
        { name: 'sb-uhinvcydgzqlpnvieyal-auth-token' },
      ])
    ).toBe(true);

    expect(
      hasSupabaseSessionCookie([
        { name: 'sb-uhinvcydgzqlpnvieyal-auth-token.0' },
        { name: 'sb-uhinvcydgzqlpnvieyal-auth-token.1' },
      ])
    ).toBe(true);

    expect(
      hasSupabaseSessionCookie([
        { name: 'sb-uhinvcydgzqlpnvieyal-auth-token-code-verifier' },
      ])
    ).toBe(false);

    expect(
      hasSupabaseSessionCookie([
        { name: 'app_lang' },
        { name: 'locally_view_mode' },
      ])
    ).toBe(false);
  });
});
