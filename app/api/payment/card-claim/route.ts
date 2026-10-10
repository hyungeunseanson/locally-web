import { NextResponse } from 'next/server';

import {
  claimExperiencePaymentAtomic,
  ExperiencePaymentContractError,
} from '@/app/utils/bookings/experiencePaymentClaims';
import { getCurrentCardPaymentProvider } from '@/app/utils/payments/card/server';
import { prepareNicePayAttempt } from '@/app/utils/payments/card/nicepayRecovery';
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
    const supabaseAdmin = createAdminClient();
    const claim = await claimExperiencePaymentAtomic({
      supabaseAdmin,
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

    if (provider === 'nicepay') {
      const { data: booking, error: bookingError } = await supabaseAdmin.from('bookings')
        .select('id, order_id, user_id, amount')
        .eq('id', orderId).maybeSingle();
      if (bookingError || !booking || booking.user_id !== user.id || booking.order_id !== orderId) {
        throw new Error('NICEPAY attempt booking lookup failed');
      }
      const attemptState = await prepareNicePayAttempt({
        client: supabaseAdmin, bookingId: booking.id, orderId: booking.order_id,
        amount: Number(booking.amount),
      });
      if (attemptState !== 'claimed') {
        return NextResponse.json({ success: false, error: '이전 카드 결제 승인 상태를 확인 중입니다. 중복 결제하지 마세요.' }, { status: 409 });
      }
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
