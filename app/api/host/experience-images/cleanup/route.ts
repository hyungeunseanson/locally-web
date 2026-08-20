import { NextRequest, NextResponse } from 'next/server';
import {
  MAX_EXPERIENCE_IMAGE_CLEANUP_PATHS,
  isOwnedExperienceImagePath,
} from '@/app/host/create/experienceImageUpload';
import { getRouteActor, toApiErrorResponse } from '@/app/api/host/experiences/shared';

function parseCleanupPaths(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_EXPERIENCE_IMAGE_CLEANUP_PATHS) {
    return null;
  }

  if (!value.every((path): path is string => typeof path === 'string')) {
    return null;
  }

  return Array.from(new Set(value));
}
export async function DELETE(request: NextRequest) {
  try {
    const { actor, supabaseAdmin } = await getRouteActor();
    const body = await request.json();
    const paths = parseCleanupPaths(body?.paths);

    if (!paths || paths.some((path) => !isOwnedExperienceImagePath(path, actor.id))) {
      return NextResponse.json({ success: false, error: 'Invalid image cleanup request.' }, { status: 400 });
    }

    const { data: experiences, error: referenceError } = await supabaseAdmin
      .from('experiences')
      .select('photos,itinerary')
      .eq('host_id', actor.id);

    if (referenceError) {
      throw referenceError;
    }

    const referencedContent = JSON.stringify(experiences ?? []);
    const unreferencedPaths = paths.filter((path) => !referencedContent.includes(path));

    if (unreferencedPaths.length === 0) {
      return NextResponse.json({ success: true, removed: 0 });
    }

    const { error: removeError } = await supabaseAdmin.storage
      .from('experiences')
      .remove(unreferencedPaths);

    if (removeError) {
      throw removeError;
    }

    return NextResponse.json({ success: true, removed: unreferencedPaths.length });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
