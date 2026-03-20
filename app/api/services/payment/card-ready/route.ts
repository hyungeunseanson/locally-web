import { NextResponse } from 'next/server';

import { getCardPaymentReadiness } from '@/app/utils/payments/card/server';

export async function GET() {
  const readiness = getCardPaymentReadiness();

  return NextResponse.json(readiness, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
