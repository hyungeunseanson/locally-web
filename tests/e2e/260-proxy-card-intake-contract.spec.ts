import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const migration = readFileSync(
  'supabase/migrations/20260918000000_proxy_card_intake_atomic.sql',
  'utf8'
);
const proxyRoute = readFileSync('app/api/proxy-bookings/route.ts', 'utf8');
const proxyConfirmation = readFileSync(
  'app/api/proxy-bookings/payment/proxyCardConfirmation.ts',
  'utf8'
);
const callbackRoute = readFileSync(
  'app/api/proxy-bookings/payment/nicepay-callback/route.ts',
  'utf8'
);
const notificationHandler = readFileSync('app/api/payment/cardNotificationHandler.ts', 'utf8');
const launchRoute = readFileSync('app/api/payment/card-launch-page/route.ts', 'utf8');
const detailRoute = readFileSync('app/api/proxy-bookings/[id]/route.ts', 'utf8');
const commentsRoute = readFileSync('app/api/proxy-bookings/[id]/comments/route.ts', 'utf8');
const adminShared = readFileSync('app/api/admin/proxy-bookings/shared.ts', 'utf8');
const cronWorkflow = readFileSync('.github/workflows/cancel-pending-bookings.yml', 'utf8');

test.describe('proxy card intake contracts', () => {
  test('keeps the atomic RPC invoker-only and schema additive-free', () => {
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('public.inquiries');
    expect(migration).toContain('public.inquiry_messages');
    expect(migration).toContain('REVOKE ALL ON FUNCTION');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i);
  });

  test('creates only a card anchor before payment and hides its server surfaces', () => {
    expect(proxyRoute).toContain("const isCardAnchor = data.payment_channel === 'LOCALLY' && data.payment_method === 'card'");
    expect(proxyRoute).toContain("[PROXY_CARD_ANCHOR_MARKER]: PROXY_CARD_ANCHOR_VERSION");
    expect(proxyRoute).toContain('inquiryId: null');
    expect(proxyRoute).toContain('redirectUrl: null');
    expect(proxyRoute).toContain('upsertInquiryThread');
    expect(proxyRoute).toContain('form_data->>${PROXY_CARD_ANCHOR_MARKER}.is.null');
    expect(detailRoute).toContain('isProxyCardPaymentAnchor(requestRow)');
    expect(commentsRoute).toContain('isProxyCardPaymentAnchor(proxyReq)');
    expect(adminShared).toContain('isProxyCardPaymentAnchor(proxyRequest)');
    expect(launchRoute).toContain('getProxyRequestFeeKrw');
    expect(launchRoute).toContain('proxyRequest.user_id !== user.id');
  });

  test('preserves completed payment before activation and reuses RPC on replay', () => {
    expect(proxyConfirmation).toContain("paymentStatus: 'COMPLETED'");
    expect(proxyConfirmation).toContain(".rpc('finalize_proxy_card_intake_atomic'");
    expect(proxyConfirmation).toContain('if (!activation.activated_now)');
    expect(callbackRoute).toContain('isProxyCardPaymentAnchor(originalRequest)');
    expect(notificationHandler).toContain('isProxyCardPaymentAnchor(proxyRequest)');
    expect(notificationHandler).toContain('verifyCardPaymentNotification');
  });

  test('keeps Cancel Pending Bookings as a manual GitHub fallback', () => {
    expect(cronWorkflow).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(cronWorkflow).toContain('workflow_dispatch:');
  });
});
