import { NextResponse } from 'next/server';

import {
  getCurrentCardPaymentProvider,
} from '@/app/utils/payments/card/server';

type CardLaunchBody = {
  provider?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CardLaunchBody;
  const provider = getCurrentCardPaymentProvider();

  if (provider !== 'nicepay') {
    return NextResponse.json(
      {
        success: false,
        error: 'Card launch signing is only used for NICEPAY direct payments.',
        provider,
      },
      { status: 409 }
    );
  }

  if ((body.provider || '').trim() && body.provider !== provider) {
    return NextResponse.json(
      {
        success: false,
        error: 'Requested provider does not match the configured card provider.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Card launch signing is unavailable. Use the authenticated launch page.',
    },
    { status: 410 }
  );
}
