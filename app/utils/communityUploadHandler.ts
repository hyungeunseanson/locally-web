import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommunityEnvironment } from './communityMedia.server';
import { communityWriteAuthority, COMMUNITY_MAX_BYTES } from './communityMediaContract.mjs';
import { CommunityMediaError, prepareCommunityAsset } from './communityMedia';
async function boundedBody(request: Request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) <= 0 || Number(declared) > COMMUNITY_MAX_BYTES + 8192)) throw new CommunityMediaError('community_request_size_invalid', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CommunityMediaError('community_request_empty', 400);
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > COMMUNITY_MAX_BYTES + 8192) throw new CommunityMediaError('community_request_size_invalid', 413); chunks.push(value); } }
  finally { await reader.cancel(); reader.releaseLock(); }
  if (!size || (declared !== null && Number(declared) !== size)) throw new CommunityMediaError('community_request_size_invalid', 413);
  const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}
export function createCommunityUploadHandlers(deps: { createClient(): Promise<SupabaseClient>; createAdminClient(): SupabaseClient; loadRuntime(): CommunityEnvironment | null }) {
  const authority = () => communityWriteAuthority(deps.loadRuntime(), process.env.COMMUNITY_R2_SOURCE_ENABLED);
  return {
    GET: async () => {
      try { return Response.json({ authority: authority() }, { headers: { 'Cache-Control': 'private, no-store' } }); }
      catch { return Response.json({ error: 'community_r2_unavailable' }, { status: 503 }); }
    },
    POST: async (request: Request) => {
      try {
        if (request.headers.get('origin') !== new URL(request.url).origin) throw new CommunityMediaError('community_origin_required', 403);
        const client = await deps.createClient(), { data: { user }, error } = await client.auth.getUser();
        if (error || !user) throw new CommunityMediaError('community_auth_required', 401);
        const env = deps.loadRuntime();
        if (authority() !== 'r2') throw new CommunityMediaError('community_r2_disabled', 409);
        const owned = await client.from('profiles').select('id').eq('id', user.id).single();
        if (owned.error || owned.data?.id !== user.id) throw new CommunityMediaError('community_owner_required', 403);
        const raw = await boundedBody(request);
        let form: FormData;
        try { form = await new Response(raw, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData(); }
        catch { throw new CommunityMediaError('community_form_invalid', 400); }
        const file = form.get('file'), postId = form.get('post_id');
        if ([...form.keys()].some(k => !['file', 'post_id'].includes(k)) || form.getAll('file').length !== 1 || form.getAll('post_id').length > 1 || !(file instanceof File) || /\.(heic|heif|svg)$/i.test(file.name)) throw new CommunityMediaError('community_file_invalid', 400);
        if (postId !== null) {
          if (typeof postId !== 'string' || !/^[a-f0-9-]{36}$/.test(postId)) throw new CommunityMediaError('community_post_invalid', 400);
          const post = await client.from('community_posts').select('id,user_id').eq('id', postId).eq('user_id', user.id).single();
          if (post.error || post.data?.user_id !== user.id) throw new CommunityMediaError('community_post_owner_required', 403);
        }
        if (!file.size || file.size > COMMUNITY_MAX_BYTES) throw new CommunityMediaError('community_size_invalid', 413);
        const asset = await prepareCommunityAsset({ registry: deps.createAdminClient(), binding: env!.PUBLIC_COMMUNITY_SOURCE_R2!, decoder: env!.IMAGES!, actorId: user.id, ownerId: user.id, bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type });
        return Response.json({ authority: 'r2', assetId: asset.id, publicUrl: asset.public_url }, { headers: { 'Cache-Control': 'private, no-store' } });
      } catch (e) { return Response.json({ error: e instanceof CommunityMediaError ? e.code : 'community_upload_unavailable' }, { status: e instanceof CommunityMediaError ? e.status : 503 }); }
    },
  };
}
