import { NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshot } from '@/app/utils/bookingFinance';
import { getPortOnePayment } from '@/app/utils/portone/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type BookingNicePayCallbackBody = {
  imp_uid?: string;
  merchant_uid?: string;
  orderId?: string;
};

function parsePortOneAmount(value: number | string | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
      impUid = (body.imp_uid || '').trim();
      orderId = (body.merchant_uid || body.orderId || '').trim();
    } else {
      const formData = await request.formData();
      impUid = formData.get('imp_uid')?.toString().trim() || '';
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

    const payment = await getPortOnePayment(impUid);
    const verifiedMerchantUid = String(payment.merchant_uid || '').trim();
    const verifiedAmount = parsePortOneAmount(payment.amount);

    if (String(payment.status || '').toLowerCase() !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'PortOne 결제 상태가 paid가 아닙니다.' },
        { status: 400 }
      );
    }

    const expectedOrderId = originalBooking.order_id || originalBooking.id;
    const expectedAmount = Number(originalBooking.amount || 0);

    if (verifiedMerchantUid !== expectedOrderId) {
      return NextResponse.json(
        { success: false, error: 'PortOne 주문번호가 예약과 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (verifiedAmount !== expectedAmount) {
      return NextResponse.json(
        { success: false, error: 'PortOne 결제 금액이 예약 금액과 일치하지 않습니다.' },
        { status: 400 }
      );
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
        tid: payment.pg_tid || payment.imp_uid || impUid,
        price_at_booking: snapshot.basePrice,
        total_experience_price: snapshot.totalExperiencePrice,
        host_payout_amount: snapshot.hostPayout,
        platform_revenue: snapshot.platformRevenue,
        payout_status: 'pending',
      })
      .eq('id', originalBooking.id)
      .select('*, experiences (host_id, title)')
      .maybeSingle();

    if (updateError || !bookingData) {
      throw new Error(updateError?.message || '결제 확정 업데이트에 실패했습니다.');
    }

    const bookingExperienceMeta = Array.isArray(bookingData.experiences)
      ? bookingData.experiences[0]
      : bookingData.experiences;
    const expTitle = bookingExperienceMeta?.title || 'Locally 체험';
    const resolvedHostId = bookingExperienceMeta?.host_id;
    const guestName = bookingData.contact_name || '게스트';

    if (resolvedHostId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: resolvedHostId,
        type: 'new_booking',
        title: '🎉 새로운 예약 도착!',
        message: `[${expTitle}] 체험에 ${guestName}님의 예약이 확정되었습니다.`,
        link: '/host/dashboard',
        is_read: false,
      });

      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'booking_confirmation',
          hostId: resolvedHostId,
          guestName,
          experienceTitle: expTitle,
          guestsCount: bookingData.guests,
          bookingDate: bookingData.date,
          bookingTime: bookingData.time,
          totalAmount: bookingData.amount || expectedAmount,
        }),
      }).catch((mailError) => console.error('Background fetch to send-email failed:', mailError));
    }

    insertAdminAlerts({
      title: '체험 예약 결제가 완료되었습니다',
      message: `'${expTitle}' 예약 결제가 완료되었습니다. 게스트: ${guestName}`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch((adminAlertError) => {
      console.error('Booking Payment Admin Alert Error:', adminAlertError);
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '결제 처리 중 서버 오류가 발생했습니다.';
    console.error('🔥 [DEBUG] Experience payment callback error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
