import { NextRequest, NextResponse } from 'next/server';
import { createExperienceFromBody, getRouteActor, toApiErrorResponse } from './shared';

type HostExperienceCreateRouteDependencies = {
  getRouteActor: typeof getRouteActor;
  createExperienceFromBody: typeof createExperienceFromBody;
};

const DEFAULT_DEPENDENCIES: HostExperienceCreateRouteDependencies = {
  getRouteActor,
  createExperienceFromBody,
};

export async function handleHostExperienceCreate(
  request: NextRequest,
  dependencies: HostExperienceCreateRouteDependencies = DEFAULT_DEPENDENCIES
) {
  try {
    const { actor } = await dependencies.getRouteActor();
    const body = await request.json();
    const result = await dependencies.createExperienceFromBody(body, actor);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
