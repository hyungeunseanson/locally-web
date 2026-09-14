import { NextRequest, NextResponse } from 'next/server';
import { getRouteActor, toApiErrorResponse, updateExperienceFromBody } from '../shared';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type HostExperienceUpdateRouteDependencies = {
  getRouteActor: typeof getRouteActor;
  updateExperienceFromBody: typeof updateExperienceFromBody;
};

const DEFAULT_DEPENDENCIES: HostExperienceUpdateRouteDependencies = {
  getRouteActor,
  updateExperienceFromBody,
};

export async function handleHostExperienceUpdate(
  request: NextRequest,
  context: RouteContext,
  dependencies: HostExperienceUpdateRouteDependencies = DEFAULT_DEPENDENCIES
) {
  try {
    const { actor } = await dependencies.getRouteActor();
    const { id } = await context.params;
    const experienceId = Number(id);

    if (!Number.isInteger(experienceId) || experienceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid experience id' }, { status: 400 });
    }

    const body = await request.json();
    const result = await dependencies.updateExperienceFromBody({
      experienceId,
      body,
      actor,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
