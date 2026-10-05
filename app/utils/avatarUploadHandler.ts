import type { SupabaseClient } from '@supabase/supabase-js';
import type { AvatarEnvironment } from './avatarMedia.server';
import { AVATAR_MAX_BYTES, avatarContentType, avatarWriteAuthority } from './avatarMediaContract.mjs';
import { AvatarMediaError, prepareManagedAvatar, commitManagedAvatar, validateAvatarImage } from './avatarMedia';

/** Dependencies keep the exact Production handler testable without provider access. */
export function createAvatarUploadHandler(deps: {
  createClient(): Promise<SupabaseClient>;
  createAdminClient(): SupabaseClient;
  loadAvatarRuntime(): AvatarEnvironment | null;
}) {
  return async function POST(request: Request) {
    try {
      if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'avatar_origin_required' }, { status: 403 });
      const supabase = await deps.createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return Response.json({ error: 'avatar_auth_required' }, { status: 401 });
      const environment = deps.loadAvatarRuntime();
      const authority = avatarWriteAuthority(environment, process.env.AVATAR_R2_SOURCE_ENABLED);
      const length = Number(request.headers.get('content-length'));
      if (!Number.isSafeInteger(length) || length <= 0 || length > AVATAR_MAX_BYTES + 8192) {
        return Response.json({ error: 'avatar_invalid_size' }, { status: 413 });
      }
      // Capture the profile locator before accepting upload bytes. CAS preserves a
      // newer avatar selected while this request is in flight.
      const { data: profile, error } = await supabase.from('profiles').select('id,avatar_url').eq('id', user.id).single();
      if (error || !profile || profile.id !== user.id) return Response.json({ error: 'avatar_owner_required' }, { status: 403 });
      const form = await request.formData();
      const file = form.get('file');
      if ([...form.keys()].some(key => key !== 'file') || form.getAll('file').length !== 1 || !(file instanceof File) || !file.size || file.size > AVATAR_MAX_BYTES) {
        return Response.json({ error: 'avatar_invalid_image' }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = validateAvatarImage(bytes, file.type);
      if (authority === 'r2') {
        // No Supabase fallback after selecting R2 authority, including errors.
        const registry = deps.createAdminClient();
        const asset = await prepareManagedAvatar({ registry, binding: environment!.PUBLIC_AVATAR_R2!, actorId: user.id, ownerId: profile.id, bytes, contentType: mime });
        const result = await commitManagedAvatar(registry, asset, profile.avatar_url);
        return Response.json(result);
      }
      // Flag false retains authenticated Supabase Storage/RLS upload authority.
      const extension = avatarContentType(mime).split('/')[1].replace('jpeg', 'jpg');
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from('avatars').upload(path, bytes, { contentType: mime, upsert: false });
      if (upload.error) throw new AvatarMediaError('avatar_provider_unavailable');
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      let update = supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      update = profile.avatar_url === null ? update.is('avatar_url', null) : update.eq('avatar_url', profile.avatar_url);
      const saved = await update.select('id').maybeSingle();
      if (saved.error || !saved.data) throw new AvatarMediaError('avatar_cas_or_identity_conflict', 409);
      return Response.json({ publicUrl, authority: 'supabase' });
    } catch (error) {
      const code = error instanceof AvatarMediaError ? error.code : error instanceof Error && error.message === 'avatar_r2_unavailable' ? 'avatar_r2_unavailable' : 'avatar_upload_failed';
      return Response.json({ error: code }, { status: error instanceof AvatarMediaError ? error.status : 503 });
    }
  }

}
