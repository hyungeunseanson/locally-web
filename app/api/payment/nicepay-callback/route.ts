import { NextResponse } from 'next/server';

import { finalizeExperienceCardPayment } from '@/app/api/payment/experienceCardConfirmation';
import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { getCurrentCardPaymentProvider, verifyApprovedCardPayment } from '@/app/utils/payments/card/server';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type BookingNicePayCallbackBody = {
  providerPayload?: Record<string, unknown>;
  imp_uid?: string;
  approvalId?: string;
  merchant_uid?: string;
  orderId?: string;
};

export async function POST(request: Request) {
  console.log('🔒 [SECURE] Experience Payment Callback Received');

  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let impUid = '';
    let orderId = '';
    let providerPayload: Record<string, string> = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as BookingNicePayCallbackBody;
      impUid = (body.imp_uid || body.approvalId || '').trim();
      orderId = (body.merchant_uid || body.orderId || '').trim();
      providerPayload = Object.entries({
        ...body,
        ...(body.providerPayload || {}),
      }).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value == null || typeof value === 'object') return acc;
        acc[key] = String(value);
        return acc;
      }, {});
    } else {
      const formData = await request.formData();
      impUid =
        formData.get('imp_uid')?.toString().trim() ||
        formData.get('approvalId')?.toString().trim() ||
        '';
      orderId =
        formData.get('merchant_uid')?.toString().trim() ||
        formData.get('moid')?.toString().trim() ||
        formData.get('orderId')?.toString().trim() ||
        '';
      providerPayload = Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
      );
    }

    if (!impUid || !orderId) {
      return NextResponse.json(
        { success: false, error: 'Missing imp_uid or orderId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: originalBooking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*, experiences (price, private_price, max_guests, host_id, title)')
      .eq('order_id', orderId)
      .maybeSingle();

    if (bookingError || !originalBooking) {
      return NextResponse.json(
        { success: false, error: '예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (originalBooking.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (BOOKING_ACTIVE_STATUS_FOR_CAPACITY.includes(originalBooking.status)) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    if (String(originalBooking.status || '').toUpperCase() !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: '이미 처리된 예약이거나 결제 대기 상태가 아닙니다.' },
        { status: 409 }
      );
    }

    const normalizedPaymentMethod = String(originalBooking.payment_method || '').toLowerCase();
    if (normalizedPaymentMethod && normalizedPaymentMethod !== 'card') {
      return NextResponse.json(
        { success: false, error: '카드 결제 대기 예약만 카드 결제를 확정할 수 있습니다.' },
        { status: 409 }
      );
    }

    const expectedOrderId = originalBooking.order_id || originalBooking.id;
    const expectedAmount = Number(originalBooking.amount || 0);

    let verificationResult;
    try {
      verificationResult = await verifyApprovedCardPayment({
        provider: getCurrentCardPaymentProvider(),
        approvalId: impUid,
        orderId: expectedOrderId,
        expectedAmount,
        providerPayload,
      });
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const confirmationResult = await finalizeExperienceCardPayment({
      supabaseAdmin,
      originalBooking,
      verificationResult,
    });

    if (!confirmationResult.success) {
      return NextResponse.json(
        { success: false, error: confirmationResult.error },
        { status: confirmationResult.status }
      );
    }

    if (confirmationResult.alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '결제 처리 중 서버 오류가 발생했습니다.';
    captureServerException(error, { route: '/api/payment/nicepay-callback', method: 'POST' });
    console.error('🔥 [DEBUG] Experience payment callback error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
