import { NextRequest } from 'next/server';
import { handleAdminExperiencePhotoReorder } from './routeHandler';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleAdminExperiencePhotoReorder(request, context);
}
