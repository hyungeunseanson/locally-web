export const BUNDLES = {
  gate: {
    description: 'Read-only Production runtime smoke. Full write-path coverage remains in isolated baseline.',
    specs: ['tests/e2e/271-production-readonly-smoke.spec.ts'],
    sideEffects: 'GET requests only; no browser scripts, synthetic users, or database writes.',
    cleanupExpectation: 'No test data is created.',
    config: 'playwright.production-readonly.config.ts',
    requires: null,
  },
  baseline: {
    description: 'Full release E2E against an isolated application and Supabase Auth/database.',
    specs: [
      'tests/e2e/43-guest-search-detail-ingress.spec.ts',
      'tests/e2e/56-notification-read-route.spec.ts',
      'tests/e2e/67-analytics-ingest-routes.spec.ts',
      'tests/e2e/09-admin-analytics.spec.ts',
      'tests/e2e/69-admin-role-access.spec.ts',
      'tests/e2e/71-public-host-profile.spec.ts',
    ],
    sideEffects: 'Isolated Auth users, analytics, notifications, admin roles, host and booking fixtures.',
    cleanupExpectation: 'All test-created rows and Auth users are removed from the isolated database.',
    config: 'playwright.isolated-release.config.ts',
    requires: 'isolated',
  },
  shared: {
    description: 'Shared-surface E2E against an isolated application and database.',
    specs: [
      'tests/e2e/17-admin-sidebar.spec.ts',
      'tests/e2e/13-admin-alerts.spec.ts',
      'tests/e2e/15-admin-team.spec.ts',
      'tests/e2e/16-admin-team-chat.spec.ts',
      'tests/e2e/18-admin-team-badge.spec.ts',
      'tests/e2e/54-mobile-notification-badges.spec.ts',
      'tests/e2e/70-admin-audit-logs.spec.ts',
      'tests/e2e/72-review-host-notification.spec.ts',
    ],
    sideEffects: 'Isolated Auth users, notifications, admin tasks, and other shared-surface rows.',
    cleanupExpectation: 'All test-created rows and Auth users are removed from the isolated database.',
    config: 'playwright.isolated-release.config.ts',
    requires: 'shared-surface',
  },
  noisy: {
    description: 'Operational E2E against an isolated application and database.',
    specs: [
      'tests/e2e/68-booking-rpc-public-guard.spec.ts',
      'tests/e2e/31-live-guest-trip-cancel.spec.ts',
      'tests/e2e/23-live-guest-post-booking.spec.ts',
      'tests/e2e/05-live-guest-booking-messaging-support.spec.ts',
      'tests/e2e/03-live-host-signup-registration.spec.ts',
      'tests/e2e/04-live-host-experience-create.spec.ts',
    ],
    sideEffects: 'Isolated bookings, notifications, messages, and email attempts.',
    cleanupExpectation: 'Report any remaining isolated fixtures or external delivery attempts.',
    config: 'playwright.isolated-release.config.ts',
    requires: 'noisy',
  },
};

function origin(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopback(url) {
  return url?.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
}

export function assertSmokeTarget({ bundle, baseURL, fileSupabaseURL, fileSiteURL, fileAnonKey, fileServiceRoleKey }) {
  const target = origin(baseURL);
  if (!target) throw new Error('A bare application origin is required.');

  if (bundle === 'gate') {
    if (target.protocol !== 'https:') throw new Error('Production read-only gate requires an HTTPS origin.');
    return;
  }

  const supabase = origin(fileSupabaseURL);
  if (!isLoopback(target) || target.port !== '3100' || !isLoopback(supabase)) {
    throw new Error('Write-bearing E2E requires the isolated app on port 3100 and a loopback Supabase URL.');
  }
  if (fileSiteURL && origin(fileSiteURL)?.origin !== target.origin) {
    throw new Error('The isolated app and NEXT_PUBLIC_SITE_URL must use the same origin.');
  }
  if (!fileAnonKey || !fileServiceRoleKey) {
    throw new Error('The isolated Supabase anon and service-role keys are required.');
  }
}
