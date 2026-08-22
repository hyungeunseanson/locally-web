import './helpers/serverOnlyTestShim';

import { expect, test } from '@playwright/test';

import { resolveInquiryEmailAudience } from '@/app/api/inquiries/thread/shared';
import { resolveRecipientEmail } from '@/app/emails/delivery/sendTemplatedEmail';

type ResolverClientOptions = {
  hostApplicationEmail?: string | null;
  hostApplicationError?: Error | null;
  profileEmail?: string | null;
  authEmail?: string | null;
};

function createResolverClient(options: ResolverClientOptions = {}) {
  const requestedTables: string[] = [];

  const client = {
    from(table: string) {
      requestedTables.push(table);
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        async maybeSingle() {
          if (table === 'host_applications') {
            return {
              data: options.hostApplicationEmail === undefined
                ? null
                : { email: options.hostApplicationEmail },
              error: options.hostApplicationError || null,
            };
          }

          if (table === 'profiles') {
            return {
              data: options.profileEmail === undefined
                ? null
                : { email: options.profileEmail },
              error: null,
            };
          }

          throw new Error(`Unexpected table: ${table}`);
        },
      };

      return query;
    },
    auth: {
      admin: {
        async getUserById() {
          return {
            data: {
              user: options.authEmail === undefined
                ? null
                : { email: options.authEmail },
            },
            error: null,
          };
        },
      },
    },
  };

  return {
    client: client as unknown as Parameters<
      typeof resolveRecipientEmail
    >[0]['supabaseAdmin'],
    requestedTables,
  };
}

test.describe('Host notification email routing', () => {
  test('prefers the latest host application email over an explicit login email', async () => {
    const { client } = createResolverClient({
      hostApplicationEmail: '  host-notification@example.com  ',
      profileEmail: 'login@example.com',
      authEmail: 'login@example.com',
    });

    await expect(resolveRecipientEmail({
      supabaseAdmin: client,
      userId: 'host-id',
      audience: 'host',
      explicitEmail: 'login@example.com',
    })).resolves.toBe('host-notification@example.com');
  });

  test('keeps guest and admin explicit email routing unchanged', async () => {
    const guest = createResolverClient({
      hostApplicationEmail: 'host-notification@example.com',
      profileEmail: 'profile@example.com',
      authEmail: 'auth@example.com',
    });
    const admin = createResolverClient({
      hostApplicationEmail: 'host-notification@example.com',
      profileEmail: 'profile@example.com',
      authEmail: 'auth@example.com',
    });

    await expect(resolveRecipientEmail({
      supabaseAdmin: guest.client,
      userId: 'dual-role-user',
      audience: 'guest',
      explicitEmail: 'guest-explicit@example.com',
    })).resolves.toBe('guest-explicit@example.com');
    await expect(resolveRecipientEmail({
      supabaseAdmin: admin.client,
      userId: 'admin-id',
      audience: 'admin',
      explicitEmail: 'admin-explicit@example.com',
    })).resolves.toBe('admin-explicit@example.com');

    expect(guest.requestedTables).not.toContain('host_applications');
    expect(admin.requestedTables).not.toContain('host_applications');
  });

  test('uses the guest profile notification email before the Auth login fallback', async () => {
    const guest = createResolverClient({
      hostApplicationEmail: 'host-notification@example.com',
      profileEmail: 'guest-notification@example.com',
      authEmail: 'guest-login@example.com',
    });

    await expect(resolveRecipientEmail({
      supabaseAdmin: guest.client,
      userId: 'guest-id',
      audience: 'guest',
    })).resolves.toBe('guest-notification@example.com');

    expect(guest.requestedTables).toEqual(['profiles']);
  });

  test('preserves profile and auth fallbacks when a host application email is absent', async () => {
    const profileFallback = createResolverClient({
      hostApplicationEmail: null,
      profileEmail: 'profile@example.com',
      authEmail: 'auth@example.com',
    });
    const authFallback = createResolverClient({
      hostApplicationEmail: null,
      profileEmail: null,
      authEmail: 'auth@example.com',
    });

    await expect(resolveRecipientEmail({
      supabaseAdmin: profileFallback.client,
      userId: 'host-with-profile',
      audience: 'host',
    })).resolves.toBe('profile@example.com');
    await expect(resolveRecipientEmail({
      supabaseAdmin: authFallback.client,
      userId: 'host-with-auth-only',
      audience: 'host',
    })).resolves.toBe('auth@example.com');
  });

  test('fails closed when the host application lookup fails', async () => {
    const { client } = createResolverClient({
      hostApplicationError: new Error('host application lookup failed'),
      profileEmail: 'profile@example.com',
      authEmail: 'auth@example.com',
    });

    await expect(resolveRecipientEmail({
      supabaseAdmin: client,
      userId: 'host-id',
      audience: 'host',
      explicitEmail: 'explicit@example.com',
    })).rejects.toThrow('host application lookup failed');
  });
});

test.describe('Inquiry recipient audience routing', () => {
  test('distinguishes host, guest, and admin recipients without changing the sender flow', () => {
    expect(resolveInquiryEmailAudience({
      isAdminSupport: false,
      recipientId: 'host-id',
      hostId: 'host-id',
    })).toBe('host');
    expect(resolveInquiryEmailAudience({
      isAdminSupport: false,
      recipientId: 'guest-id',
      hostId: 'host-id',
    })).toBe('guest');
    expect(resolveInquiryEmailAudience({
      isAdminSupport: true,
      recipientId: 'admin-id',
      hostId: 'admin-id',
    })).toBe('admin');
    expect(resolveInquiryEmailAudience({
      isAdminSupport: true,
      recipientId: 'guest-id',
      hostId: 'admin-id',
    })).toBe('guest');
  });
});
