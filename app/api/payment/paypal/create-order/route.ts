import { NextResponse } from 'next/server';

import {
  attachExperiencePaymentProviderReferenceAtomic,
  claimExperiencePaymentAtomic,
  ExperiencePaymentContractError,
} from '@/app/utils/bookings/experiencePaymentClaims';
import { createPayPalOrder } from '@/app/utils/paypal/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type CreateOrderBody = {
  bookingId?: string;
};

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

    const body = (await request.json()) as CreateOrderBody;
    const bookingId = String(body.bookingId || '').trim();
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Missing bookingId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, order_id, user_id, amount, status, payment_method, experiences(title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (booking.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (String(booking.status || '').toUpperCase() !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: '이미 처리된 예약이거나 결제 대기 상태가 아닙니다.' },
        { status: 409 }
      );
    }
    const paymentMethod = String(booking.payment_method || '').toLowerCase();
    if (paymentMethod === 'bank') {
      return NextResponse.json(
        { success: false, error: '무통장 예약에는 PayPal 결제를 시작할 수 없습니다.' },
        { status: 400 }
      );
    }
    if (paymentMethod && paymentMethod !== 'paypal') {
      return NextResponse.json(
        { success: false, error: 'PayPal 결제 대기 예약만 PayPal 주문을 생성할 수 있습니다.' },
        { status: 409 }
      );
    }

    const claim = await claimExperiencePaymentAtomic({
      supabaseAdmin,
      bookingId,
      userId: user.id,
      provider: 'paypal',
    });

    if (claim.providerReference) {
      return NextResponse.json({
        success: true,
        paypalOrderId: claim.providerReference,
        reused: true,
      });
    }

    if (claim.outcome !== 'claimed' || !claim.claimToken) {
      return NextResponse.json(
        { success: false, error: 'PayPal 주문 생성이 이미 진행 중입니다. 잠시 후 다시 시도해 주세요.' },
        { status: 409 }
      );
    }

    const amount = Number(booking.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ExperiencePaymentContractError(400, 'PAYMENT_CLAIM_AMOUNT_INVALID');
    }

    const experienceRelation = booking.experiences as
      | { title?: string }
      | Array<{ title?: string }>
      | null;
    const experienceTitle = Array.isArray(experienceRelation)
      ? experienceRelation[0]?.title
      : experienceRelation?.title;

    const paypalOrder = await createPayPalOrder({
      amount,
      currencyCode: 'KRW',
      orderId: booking.order_id || booking.id,
      description: experienceTitle || 'Locally 체험 예약',
    });

    const attached = await attachExperiencePaymentProviderReferenceAtomic({
      supabaseAdmin,
      bookingId,
      userId: user.id,
      providerReference: paypalOrder.id,
      claimToken: claim.claimToken,
    });

    return NextResponse.json({
      success: true,
      paypalOrderId: attached.providerReference,
      status: paypalOrder.status,
      approveLink: paypalOrder.links?.find((link) => link.rel === 'approve')?.href || null,
    });
  } catch (error: unknown) {
    if (error instanceof ExperiencePaymentContractError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.diagnosticCode },
        { status: error.status }
      );
    }

    console.error(JSON.stringify({
      event: 'experience_paypal_create_order',
      status: 'failed',
      diagnosticCode: 'provider_or_internal_error',
    }));
    return NextResponse.json(
      { success: false, error: 'PayPal 주문 생성 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
