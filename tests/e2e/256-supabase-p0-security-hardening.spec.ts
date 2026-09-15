import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { serveAdminFile } from '@/app/api/admin/files/[...path]/route';
import { serveInquiryMessageImage } from '@/app/api/inquiries/messages/[messageId]/image/route';
import {
  extractStorageObjectPath,
  getAdminFileDeliveryUrl,
  getPrivateChatImageDeliveryUrl,
  isSafeInlineRasterImageType,
  resolveAdminFileDeliveryUrl,
} from '@/app/utils/privateStorageDelivery';

const migrationPath = 'supabase/migrations/20260915141606_p0_storage_rpc_security_hardening.sql';
const migration = readFileSync(migrationPath, 'utf8');
const normalizedMigration = migration.replace(/\s+/g, ' ').trim();

function serverClient(user: { id: string; email?: string } | null, message?: { image_url: string; type: string } | null) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: message ?? null, error: null }),
      };
      return query;
    },
  };
}

function storageClient(blob = new Blob(['private-image'], { type: 'image/webp' })) {
  const calls: Array<{ bucket: string; path: string }> = [];
  return {
    calls,
    client: {
      storage: {
        from: (bucket: string) => ({
          download: async (path: string) => {
            calls.push({ bucket, path });
            return { data: blob, error: null };
          },
        }),
      },
    },
  };
}

test.describe('private Storage delivery compatibility', () => {
  test('maps legacy private object URLs without leaking chat object paths into the UI', () => {
    const chatUrl = 'https://example.supabase.co/storage/v1/object/public/chat-images/42/legacy%20image.webp';
    const adminUrl = 'https://example.supabase.co/storage/v1/object/public/admin_files/markdown_images/a%20b.webp';

    expect(extractStorageObjectPath(chatUrl, 'chat-images')).toBe('42/legacy image.webp');
    expect(getPrivateChatImageDeliveryUrl(123)).toBe('/api/inquiries/messages/123/image');
    expect(resolveAdminFileDeliveryUrl(adminUrl)).toBe('/api/admin/files/markdown_images/a%20b.webp');
    expect(getAdminFileDeliveryUrl('../secret')).toBeNull();
    expect(extractStorageObjectPath(adminUrl, 'chat-images')).toBeNull();
    expect(extractStorageObjectPath(
      'https://evil.invalid/prefix/storage/v1/object/public/admin_files/markdown_images/forged.webp',
      'admin_files'
    )).toBeNull();
    expect(isSafeInlineRasterImageType('image/webp')).toBe(true);
    expect(isSafeInlineRasterImageType('image/svg+xml')).toBe(false);
  });

  test('requires message RLS visibility before downloading a legacy chat image', async () => {
    const rawImage = 'https://example.supabase.co/storage/v1/object/public/chat-images/42/legacy.webp';
    const storage = storageClient();
    const dependencies = {
      createServerClient: async () => serverClient({ id: 'participant' }, { image_url: rawImage, type: 'image' }),
      createAdminClient: () => storage.client,
    } as never;

    const response = await serveInquiryMessageImage(
      new Request('http://localhost/api/inquiries/messages/9/image'),
      { params: Promise.resolve({ messageId: '9' }) },
      dependencies
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(storage.calls).toEqual([{ bucket: 'chat-images', path: '42/legacy.webp' }]);
    expect(await response.text()).toBe('private-image');
  });

  test('denies anonymous and non-participant chat image reads before Storage download', async () => {
    for (const [user, expectedStatus] of [[null, 401], [{ id: 'other' }, 404]] as const) {
      const storage = storageClient();
      const response = await serveInquiryMessageImage(
        new Request('http://localhost/image'),
        { params: Promise.resolve({ messageId: '9' }) },
        {
          createServerClient: async () => serverClient(user, null),
          createAdminClient: () => storage.client,
        } as never
      );
      expect(response.status).toBe(expectedStatus);
      expect(storage.calls).toEqual([]);
    }
  });

  test('does not serve active same-origin content from a private image route', async () => {
    const storage = storageClient(new Blob(['<script>blocked</script>'], { type: 'text/html' }));
    const response = await serveInquiryMessageImage(
      new Request('http://localhost/image'),
      { params: Promise.resolve({ messageId: '9' }) },
      {
        createServerClient: async () => serverClient(
          { id: 'participant' },
          { image_url: 'https://example.supabase.co/storage/v1/object/public/chat-images/legacy.webp', type: 'image' }
        ),
        createAdminClient: () => storage.client,
      } as never
    );
    expect(response.status).toBe(415);
    expect(await response.text()).not.toContain('script');
  });

  test('allows only admins to read admin_files through the server delivery route', async () => {
    for (const scenario of [
      { user: null, isAdmin: false, status: 401, downloads: 0 },
      { user: { id: 'member' }, isAdmin: false, status: 403, downloads: 0 },
      { user: { id: 'admin' }, isAdmin: true, status: 200, downloads: 1 },
    ]) {
      const storage = storageClient();
      const response = await serveAdminFile(
        new Request('http://localhost/file'),
        { params: Promise.resolve({ path: ['markdown_images', 'memo.webp'] }) },
        {
          createServerClient: async () => serverClient(scenario.user),
          createAdminClient: () => storage.client,
          resolveAdminAccess: async () => ({ isAdmin: scenario.isAdmin }),
        } as never
      );
      expect(response.status).toBe(scenario.status);
      expect(storage.calls).toHaveLength(scenario.downloads);
    }
  });

  test('keeps legacy admin chat_images available only through the admin route', async () => {
    const storage = storageClient();
    const response = await serveAdminFile(
      new Request('http://localhost/file'),
      { params: Promise.resolve({ path: ['chat_images', 'legacy.webp'] }) },
      {
        createServerClient: async () => serverClient({ id: 'admin' }),
        createAdminClient: () => storage.client,
        resolveAdminAccess: async () => ({ isAdmin: true }),
      } as never
    );
    expect(response.status).toBe(200);
    expect(storage.calls).toEqual([{ bucket: 'admin_files', path: 'chat_images/legacy.webp' }]);
  });

  test('rejects unsupported admin namespaces and traversal before download', async () => {
    for (const path of [['other', 'legacy.webp'], ['..', 'secret']]) {
      const storage = storageClient();
      const response = await serveAdminFile(
        new Request('http://localhost/file'),
        { params: Promise.resolve({ path }) },
        {
          createServerClient: async () => serverClient({ id: 'admin' }),
          createAdminClient: () => storage.client,
          resolveAdminAccess: async () => ({ isAdmin: true }),
        } as never
      );
      expect(response.status).toBe(404);
      expect(storage.calls).toEqual([]);
    }
  });
});

test.describe('P0 Storage and SECURITY DEFINER migration', () => {
  test('makes chat/admin buckets private without touching object bytes', () => {
    expect(normalizedMigration).toContain("UPDATE storage.buckets SET public = false WHERE id IN ('chat-images', 'admin_files');");
    expect(normalizedMigration).toContain('p0_storage_object_baseline');
    expect(normalizedMigration).not.toMatch(/\bDELETE\s+FROM\s+storage\.objects\b/i);
    expect(normalizedMigration).not.toMatch(/\bTRUNCATE\b|\bCopyObject\b/i);
  });

  test('replaces broad avatar/image/global owner writes with owned namespaces', () => {
    for (const policy of [
      'Anyone can update their own avatar', 'Anyone can upload an avatar',
      'Authenticated Delete', 'Authenticated Update', 'Authenticated Upload',
      'Owner Delete', 'Owner Update',
    ]) {
      expect(normalizedMigration).toContain(`DROP POLICY \"${policy}\" ON storage.objects;`);
    }
    expect(normalizedMigration).toContain('CREATE POLICY \"Avatar owners can upload\" ON storage.objects FOR INSERT TO authenticated');
    expect(normalizedMigration).toContain("owner_id = auth.uid()::text AND split_part(name, '/', 1) = auth.uid()::text");
    expect(normalizedMigration).toContain('CREATE POLICY \"Image owners can delete\" ON storage.objects FOR DELETE TO authenticated');
    expect(normalizedMigration).toContain('CREATE POLICY \"Image owners can read\" ON storage.objects FOR SELECT TO authenticated');
    expect(normalizedMigration).toContain("bucket_id = 'images' AND owner_id = auth.uid()::text");
    expect(normalizedMigration).toContain("split_part(name, '/', 1) = 'community' AND split_part(name, '/', 2) = auth.uid()::text");
    expect(normalizedMigration).toContain('CREATE POLICY \"Experience object owners can update\"');
  });

  test('keeps public reads and verification-doc protections intact', () => {
    expect(normalizedMigration).not.toContain('DROP POLICY \"Avatar images are publicly accessible\"');
    expect(normalizedMigration).not.toContain('DROP POLICY \"Public Access\"');
    expect(normalizedMigration).not.toMatch(/DROP POLICY \"Verification docs owners can/);
    expect(normalizedMigration).not.toMatch(/UPDATE storage\.buckets[^;]+verification-docs/i);
  });

  test('removes direct privileged RPC exposure and narrows public views to SELECT', () => {
    for (const signature of [
      'public.check_rate_limit(text, integer)',
      'public.handle_new_user()',
      'public.mark_room_messages_read(uuid, uuid)',
    ]) {
      expect(normalizedMigration).toContain(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated;`);
      expect(normalizedMigration).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
    }
    expect(normalizedMigration).toContain('REVOKE EXECUTE ON FUNCTION public.is_admin_reader() FROM PUBLIC, anon;');
    expect(normalizedMigration).toContain('GRANT EXECUTE ON FUNCTION public.is_admin_reader() TO authenticated, service_role;');
    expect(normalizedMigration).toContain('ALTER FUNCTION public.mark_room_messages_read(uuid, uuid) SET search_path = public, pg_catalog;');
    for (const view of ['public.public_profiles', 'public.public_host_applications']) {
      expect(normalizedMigration).toContain(`REVOKE ALL PRIVILEGES ON TABLE ${view} FROM PUBLIC, anon, authenticated, service_role;`);
      expect(normalizedMigration).toContain(`GRANT SELECT ON TABLE ${view} TO anon, authenticated, service_role;`);
    }
    expect(normalizedMigration).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i);
  });

  test('updates each browser upload to its enforced owner namespace', () => {
    const account = readFileSync('app/account/page.tsx', 'utf8');
    const mobile = readFileSync('app/components/mobile/MobileProfileView.tsx', 'utf8');
    const hostRegistration = readFileSync('app/host/register/page.tsx', 'utf8');
    const hostEditor = readFileSync('app/host/dashboard/components/ProfileEditor.tsx', 'utf8');
    const community = readFileSync('app/community/write/PostEditor.tsx', 'utf8');
    expect(account).toContain('`${user.id}/${fileName}`');
    expect(mobile).toContain('`${userId}/${Date.now()}-${Math.random()}.${fileExt}`');
    expect(hostRegistration).toContain('`profile/${user.id}_${Date.now()}`');
    expect(hostEditor).toContain('`profile/${user.id}_${Date.now()}`');
    expect(community).toContain('`community/${user.id}/${Date.now()}-${fileName}`');
  });
});
