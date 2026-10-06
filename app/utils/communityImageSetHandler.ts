import { isManagedCommunityUrl } from './communityMediaContract.mjs';
import type { SupabaseClient } from '@supabase/supabase-js';
/** Media-only endpoint: no content/visibility/counter fields cross this boundary. */
export function createCommunityImageSetHandler(deps: { createClient(): Promise<SupabaseClient>; createAdminClient(): SupabaseClient }) {
  return async (request: Request) => {
    try {
      if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'community_origin_required' }, { status: 403 });
      const client = await deps.createClient(), { data: { user }, error } = await client.auth.getUser();
      if (error || !user) return Response.json({ error: 'community_auth_required' }, { status: 401 });
      // Bound JSON independently of the untrusted Content-Length header.
      const reader = request.body?.getReader(); if (!reader) return Response.json({ error: 'community_set_invalid' }, { status: 400 });
      let size = 0; const chunks: Uint8Array[] = [];
      try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 32768) return Response.json({ error: 'community_set_bound' }, { status: 413 }); chunks.push(value); } }
      finally { await reader.cancel(); reader.releaseLock(); }
      const raw = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
      const body = JSON.parse(new TextDecoder().decode(raw));
      const fields = ['post_id', 'expected_revision', 'expected_images', 'images'];
      if (!body || typeof body !== 'object' || Object.keys(body).some(k => !fields.includes(k)) || typeof body.post_id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.post_id)
        || !Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0 || !Array.isArray(body.images) || !Array.isArray(body.expected_images)
        || body.images.length > Math.max(1, body.expected_images.length) || body.expected_images.length > 100 || [...body.images, ...body.expected_images].some(v => typeof v !== 'string' || !v || v.length > 2048)) return Response.json({ error: 'community_set_invalid' }, { status: 400 });
      if (body.images.some((url: string) => !isManagedCommunityUrl(url) && !body.expected_images.includes(url))) return Response.json({ error: 'community_managed_image_required' }, { status: 400 });
      const { data, error: conflict } = await deps.createAdminClient().rpc('commit_community_post_images', { p_actor_id: user.id, p_post_id: body.post_id, p_expected_revision: body.expected_revision, p_expected_images: body.expected_images, p_images: body.images });
      if (conflict || !data) return Response.json({ error: 'community_image_set_conflict' }, { status: 409 });
      return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch { return Response.json({ error: 'community_set_invalid' }, { status: 400 }); }
  };
}
