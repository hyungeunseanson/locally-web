import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { MAX_EXPERIENCE_PHOTOS } from '@/app/host/create/config';
import {
  arePhotoOrdersEqual,
  toPostgresTextArrayLiteral,
  validateExperiencePhotoReorder,
} from '@/app/utils/experiencePhotoOrder';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const experienceId = Number(id);
    if (!Number.isInteger(experienceId) || experienceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid experience id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      expectedPhotos?: unknown;
      photos?: unknown;
    };

    const { data: currentExperience, error: loadError } = await supabaseAdmin
      .from('experiences')
      .select('id, title, photos')
      .eq('id', experienceId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!currentExperience) {
      return NextResponse.json({ success: false, error: 'Experience not found.' }, { status: 404 });
    }

    const validation = validateExperiencePhotoReorder({
      currentPhotos: currentExperience.photos,
      expectedPhotos: body.expectedPhotos,
      nextPhotos: body.photos,
      maxPhotos: MAX_EXPERIENCE_PHOTOS,
    });

    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
    }

    if (arePhotoOrdersEqual(validation.currentPhotos, validation.nextPhotos)) {
      return NextResponse.json({
        success: true,
        data: { id: currentExperience.id, photos: validation.currentPhotos },
      });
    }

    const currentPhotosLiteral = toPostgresTextArrayLiteral(validation.currentPhotos);
    const { data: updatedExperience, error: updateError } = await supabaseAdmin
      .from('experiences')
      .update({ photos: validation.nextPhotos })
      .eq('id', experienceId)
      .filter('photos', 'eq', currentPhotosLiteral)
      .select('id, photos')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedExperience) {
      return NextResponse.json(
        { success: false, error: 'Photos changed. Refresh and try again.' },
        { status: 409 }
      );
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'UPDATE_EXPERIENCE_PHOTO_ORDER',
      target_type: 'experiences',
      target_id: String(experienceId),
      details: {
        target_info: currentExperience.title || String(experienceId),
        previous_main_photo: validation.currentPhotos[0],
        main_photo: validation.nextPhotos[0],
        previous_photo_order: validation.currentPhotos,
        photo_order: validation.nextPhotos,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: updatedExperience.id, photos: updatedExperience.photos },
    });
  } catch (error) {
    console.error('[admin/experiences/:id/photos] update failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
