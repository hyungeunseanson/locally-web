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

