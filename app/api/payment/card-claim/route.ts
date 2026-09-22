import { NextResponse } from 'next/server';

import {
  claimExperiencePaymentAtomic,
  ExperiencePaymentContractError,
} from '@/app/utils/bookings/experiencePaymentClaims';
import { getCurrentCardPaymentProvider } from '@/app/utils/payments/card/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { orderId?: string };
    const orderId = String(body.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 });
    }

    const provider = getCurrentCardPaymentProvider();
    const claim = await claimExperiencePaymentAtomic({
      supabaseAdmin: createAdminClient(),
      bookingId: orderId,
      userId: user.id,
      provider,
      providerReference: orderId,
    });

    if (claim.outcome !== 'claimed' && claim.outcome !== 'already_claimed') {
      return NextResponse.json(
        { success: false, error: '카드 결제를 안전하게 시작할 수 없습니다.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      outcome: claim.outcome,
      provider: claim.provider,
      claimExpiresAt: claim.claimExpiresAt,
    });
  } catch (error: unknown) {
    if (error instanceof ExperiencePaymentContractError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.diagnosticCode },
        { status: error.status }
      );
    }

    console.error(JSON.stringify({
      event: 'experience_card_claim',
      status: 'failed',
      diagnosticCode: 'unexpected_error',
    }));
    return NextResponse.json(
      { success: false, error: '카드 결제 준비 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
