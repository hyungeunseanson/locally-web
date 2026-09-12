import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { canaryHeaders, requiredEnv } from './helpers';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test('uploads, reads, and removes a synthetic image through staging Storage RLS', async ({ request }) => {
  const readiness = await request.get('/api/canary/cloudflare/readiness', {
    headers: canaryHeaders(),
  });
  expect(readiness.status()).toBe(200);
  expect(await readiness.json()).toMatchObject({
    safe: true,
    safety: { activeWriteGate: 'storage', activeWriteGateConfigured: true },
  });

  const client = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const path = `staging-canary/runtime-${Date.now()}.png`;

  const { error: signInError } = await client.auth.signInWithPassword({
    email: requiredEnv('CLOUDFLARE_CANARY_GUEST_EMAIL'),
    password: requiredEnv('CLOUDFLARE_CANARY_GUEST_PASSWORD'),
  });
  if (signInError) throw signInError;

  try {
    const { error: uploadError } = await client.storage
      .from('experiences')
      .upload(path, ONE_PIXEL_PNG, { contentType: 'image/png', upsert: false });
    if (uploadError) throw uploadError;

    const publicUrl = client.storage.from('experiences').getPublicUrl(path).data.publicUrl;
    const response = await fetch(publicUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^image\/png/);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(ONE_PIXEL_PNG);
  } finally {
    const { error: removeError } = await client.storage.from('experiences').remove([path]);
    if (removeError) throw removeError;
    await client.auth.signOut();
  }

  const { data: remaining, error: listError } = await client.storage
    .from('experiences')
    .list('staging-canary', { search: path.split('/').at(-1) });
  if (listError) throw listError;
  expect(remaining).toEqual([]);
});
