import { NextRequest, NextResponse } from 'next/server';
import { createExperienceFromBody, getRouteActor, toApiErrorResponse } from './shared';

export async function POST(request: NextRequest) {
  try {
    const { actor } = await getRouteActor();
    const body = await request.json();
    const result = await createExperienceFromBody(body, actor);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

