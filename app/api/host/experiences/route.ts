import { NextRequest } from 'next/server';
import { handleHostExperienceCreate } from './routeHandler';

export async function POST(request: NextRequest) {
  return handleHostExperienceCreate(request);
}
