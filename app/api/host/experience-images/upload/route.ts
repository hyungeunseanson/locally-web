import { NextRequest, NextResponse } from 'next/server';
import { getRouteActor, toApiErrorResponse } from '@/app/api/host/experiences/shared';
import {
  createExperienceMediaR2Source,
  experienceMediaSourceEnabled,
  EXPERIENCE_MEDIA_SOURCE_MAX_BYTES,
  hasExpectedExperienceImageMagic,
  loadExperienceMediaSourceRuntime,
  normalizeExperienceImageContentType,
  resolveExperienceMediaUploadOwner,
  repositoryProductionR2SourceDefaultEnabled,
} from '@/app/utils/experienceMediaSource.server';

export const runtime = 'nodejs';

function parseFolder(value: FormDataEntryValue | null) {
  return value === 'hero' || value === 'itinerary' ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const { actor, supabaseAdmin } = await getRouteActor();
    const form = await request.formData();
    const file = form.get('file');
    const folder = parseFolder(form.get('folder'));
    const rawExperienceId = form.get('experienceId');
    const experienceId = typeof rawExperienceId === 'string' && /^[1-9][0-9]{0,18}$/.test(rawExperienceId)
      ? rawExperienceId
      : null;
    if (!(file instanceof File) || !folder || file.size <= 0 || file.size > EXPERIENCE_MEDIA_SOURCE_MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Invalid image upload.' }, { status: 400 });
    }

    let ownerId = actor.id;
    if (rawExperienceId !== null) {
      if (!experienceId) {
        return NextResponse.json({ success: false, error: 'Invalid experience.' }, { status: 400 });
      }
      const { data: experience, error } = await supabaseAdmin
        .from('experiences')
        .select('host_id')
        .eq('id', experienceId)
        .maybeSingle();
      if (error) throw error;
      if (!experience) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      try {
        ownerId = resolveExperienceMediaUploadOwner({
          actorId: actor.id,
          isAdmin: actor.isAdmin,
          experienceHostId: experience.host_id,
        });
      } catch {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    let contentType: string;
    try {
      contentType = normalizeExperienceImageContentType(file.type);
    } catch {
      return NextResponse.json({ success: false, error: 'Unsupported image type.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedExperienceImageMagic(bytes, contentType)) {
      return NextResponse.json({ success: false, error: 'Invalid image content.' }, { status: 400 });
    }

    const environment = loadExperienceMediaSourceRuntime();
    if (environment && experienceMediaSourceEnabled(environment)) {
      if (!environment.PUBLIC_EXPERIENCE_MEDIA_R2) {
        return NextResponse.json({ success: false, error: 'Image storage unavailable.' }, { status: 503 });
      }
      const result = await createExperienceMediaR2Source({
        binding: environment.PUBLIC_EXPERIENCE_MEDIA_R2,
        ownerId,
        folder,
        bytes,
        contentType,
      });
      return NextResponse.json({ success: true, publicUrl: result.publicUrl, authority: 'r2' });
    }

    if (
      process.env.EXPERIENCE_MEDIA_R2_SOURCE_ENABLED === 'true' ||
      (process.env.VERCEL_ENV === 'production' && repositoryProductionR2SourceDefaultEnabled())
    ) {
      return NextResponse.json({ success: false, error: 'Image storage unavailable.' }, { status: 503 });
    }

    const safeExtension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : contentType === 'image/avif' ? 'avif' : 'jpg';
    const path = `experience/${ownerId}/${folder}/${Date.now()}_${crypto.randomUUID()}.${safeExtension}`;
    const { error } = await supabaseAdmin.storage.from('experiences').upload(path, bytes, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from('experiences').getPublicUrl(path);
    return NextResponse.json({
      success: true,
      publicUrl: data.publicUrl,
      cleanupPath: path,
      authority: 'supabase',
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
