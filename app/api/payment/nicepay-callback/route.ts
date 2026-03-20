import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { getCurrentCardPaymentProvider, verifyApprovedCardPayment } from '@/app/utils/payments/card/server';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshot } from '@/app/utils/bookingFinance';
import { notifyExperiencePaymentConfirmed } from '@/app/utils/experienceNotificationFlows';
import { captureServerException } from '@/app/utils/monitoring/sentry';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type BookingNicePayCallbackBody = {
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
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as BookingNicePayCallbackBody;
      impUid = (body.imp_uid || body.approvalId || '').trim();
      orderId = (body.merchant_uid || body.orderId || '').trim();
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
      });
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : '카드 결제 승인 검증에 실패했습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const experienceMeta = Array.isArray(originalBooking.experiences)
      ? originalBooking.experiences[0]
      : originalBooking.experiences;

    const { data: existingBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, guests, type')
      .eq('experience_id', originalBooking.experience_id)
      .eq('date', originalBooking.date)
      .eq('time', originalBooking.time)
      .neq('id', originalBooking.id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    const currentBookedCount =
      existingBookings?.reduce((sum, booking) => sum + Number(booking.guests || 0), 0) || 0;
    const hasPrivateBooking = existingBookings?.some((booking) => booking.type === 'private');
    const maxGuests = experienceMeta?.max_guests || 10;

    if (
      hasPrivateBooking ||
      (originalBooking.type === 'private' && currentBookedCount > 0) ||
      (originalBooking.type !== 'private' &&
        currentBookedCount + Number(originalBooking.guests || 0) > maxGuests)
    ) {
      return NextResponse.json(
        { success: false, error: '잔여 좌석이 부족하여 예약을 확정할 수 없습니다.' },
        { status: 409 }
      );
    }

    const snapshot = getBookingSettlementSnapshot({
      ...originalBooking,
      amount: expectedAmount,
    });

    const { data: bookingData, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'PAID',
        payment_method: 'card',
        tid: verificationResult.providerTransactionId,
        price_at_booking: snapshot.basePrice,
        total_experience_price: snapshot.totalExperiencePrice,
        host_payout_amount: snapshot.hostPayout,
        platform_revenue: snapshot.platformRevenue,
        payout_status: 'pending',
      })
      .eq('id', originalBooking.id)
      .eq('status', 'PENDING') // [Race Guard] PENDING 상태일 때만 업데이트 — 중복 처리 방지
      .select('*, experiences (host_id, title)')
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message || '결제 확정 업데이트에 실패했습니다.');
    }
    if (!bookingData) {
      // 다른 요청이 이미 처리 완료 — 멱등성 응답
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    const bookingExperienceMeta = Array.isArray(bookingData.experiences)
      ? bookingData.experiences[0]
      : bookingData.experiences;
    const expTitle = bookingExperienceMeta?.title || 'Locally 체험';
    const resolvedHostId = bookingExperienceMeta?.host_id;
    const guestName = bookingData.contact_name || '게스트';

    await notifyExperiencePaymentConfirmed({
      supabaseAdmin,
      guestId: bookingData.user_id || null,
      hostId: resolvedHostId || null,
      experienceTitle: expTitle,
      guestName,
      guestsCount: Number(bookingData.guests || 1),
      bookingDate: bookingData.date,
      bookingTime: bookingData.time || null,
      totalAmount: Number(bookingData.amount || expectedAmount || 0),
    });

    insertAdminAlerts({
      title: '체험 예약 결제가 완료되었습니다',
      message: `'${expTitle}' 예약 결제가 완료되었습니다. 게스트: ${guestName}`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch((adminAlertError) => {
      console.error('Booking Payment Admin Alert Error:', adminAlertError);
    });

    revalidatePath(`/experiences/${originalBooking.experience_id}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '결제 처리 중 서버 오류가 발생했습니다.';
    captureServerException(error, { route: '/api/payment/nicepay-callback', method: 'POST' });
    console.error('🔥 [DEBUG] Experience payment callback error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
