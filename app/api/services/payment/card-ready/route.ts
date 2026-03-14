import { NextResponse } from 'next/server';

import { isPortOneServiceCardReady } from '@/app/utils/portone/server';

export async function GET() {
  const readiness = isPortOneServiceCardReady();

  return NextResponse.json(readiness, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
