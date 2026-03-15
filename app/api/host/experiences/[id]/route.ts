import { NextRequest, NextResponse } from 'next/server';
import { toApiErrorResponse, getRouteActor, updateExperienceFromBody } from '../shared';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await getRouteActor();
    const { id } = await context.params;
    const experienceId = Number(id);

    if (!Number.isInteger(experienceId) || experienceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid experience id' }, { status: 400 });
    }

    const body = await request.json();
    const result = await updateExperienceFromBody({
      experienceId,
      body,
      actor,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { actor, supabaseAdmin } = await getRouteActor();
    const { id } = await context.params;
    const experienceId = Number(id);

    if (!Number.isInteger(experienceId) || experienceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid experience id' }, { status: 400 });
    }

    const { data: experience, error: loadError } = await supabaseAdmin
      .from('experiences')
      .select('id, host_id')
      .eq('id', experienceId)
      .maybeSingle();

    if (loadError || !experience) {
      return NextResponse.json({ success: false, error: '체험을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!actor.isAdmin && experience.host_id !== actor.id) {
      return NextResponse.json({ success: false, error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('experiences')
      .delete()
      .eq('id', experienceId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
