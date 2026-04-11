import { NextResponse } from 'next/server';

import {
  buildNicePayLaunchFields,
  getCardPaymentReadiness,
  getCurrentCardPaymentProvider,
} from '@/app/utils/payments/card/server';

type CardLaunchBody = {
  provider?: string;
  orderId?: string;
  productName?: string;
  amount?: number;
  buyerName?: string;
  buyerTel?: string;
  buyerEmail?: string;
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

  const readiness = getCardPaymentReadiness();
  if (!readiness.ready || !readiness.runtime) {
    return NextResponse.json(
      {
        success: false,
        error: 'Card payment is not ready.',
        provider: readiness.provider,
        missingConfig: readiness.missingConfig || [],
      },
      { status: 503 }
    );
  }

  try {
    const fields = buildNicePayLaunchFields({
      orderId: String(body.orderId || ''),
      productName: String(body.productName || ''),
      amount: Number(body.amount || 0),
      buyerName: String(body.buyerName || ''),
      buyerTel: String(body.buyerTel || ''),
      buyerEmail: String(body.buyerEmail || ''),
      returnUrl: `${new URL(request.url).origin}/api/payment/nicepay/relay`,
    });

    return NextResponse.json({
      success: true,
      provider,
      formAction: '/api/payment/nicepay/relay',
      fields,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'NICEPAY 결제 시작 정보 생성에 실패했습니다.';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
