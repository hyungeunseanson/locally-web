import { NextResponse } from 'next/server';

import { isPortOneCardReady } from '@/app/utils/portone/server';

export async function GET() {
  const readiness = isPortOneCardReady();

  return NextResponse.json(readiness, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
