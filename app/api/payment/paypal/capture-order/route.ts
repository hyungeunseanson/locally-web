import { NextResponse } from 'next/server';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshot } from '@/app/utils/bookingFinance';
import { capturePayPalOrder, getPayPalOrder } from '@/app/utils/paypal/server';

type CaptureOrderBody = {
  bookingId?: string;
  paypalOrderId?: string;
};

function parsePayPalAmount(value: string | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

    const body = (await request.json()) as CaptureOrderBody;
    const bookingId = (body.bookingId || '').trim();
    const paypalOrderId = (body.paypalOrderId || '').trim();

    if (!bookingId || !paypalOrderId) {
      return NextResponse.json(
        { success: false, error: 'Missing bookingId or paypalOrderId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: originalBooking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*, experiences (price, private_price, max_guests, host_id, title)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !originalBooking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (originalBooking.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (BOOKING_ACTIVE_STATUS_FOR_CAPACITY.includes(originalBooking.status)) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    const expectedOrderId = originalBooking.order_id || originalBooking.id;
    const expectedAmount = Number(originalBooking.amount || 0);
    const experienceMeta = Array.isArray(originalBooking.experiences)
      ? originalBooking.experiences[0]
      : originalBooking.experiences;

    const paypalOrder = await getPayPalOrder(paypalOrderId);
    const purchaseUnit = paypalOrder.purchase_units?.[0];
    const unitOrderId = purchaseUnit?.custom_id || purchaseUnit?.reference_id || '';
    const orderAmount = parsePayPalAmount(purchaseUnit?.amount?.value);

    if (unitOrderId !== expectedOrderId) {
      return NextResponse.json({ success: false, error: 'PayPal 주문 참조가 일치하지 않습니다.' }, { status: 400 });
    }

    if (orderAmount !== expectedAmount) {
      return NextResponse.json({ success: false, error: 'PayPal 주문 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    const captured =
      paypalOrder.status === 'COMPLETED'
        ? {
            orderId: paypalOrder.id,
            status: paypalOrder.status,
            captureId: purchaseUnit?.payments?.captures?.[0]?.id || null,
            amount: purchaseUnit?.payments?.captures?.[0]?.amount || null,
            raw: paypalOrder,
          }
        : await capturePayPalOrder(paypalOrderId);

    const capturedAmount = parsePayPalAmount(captured.amount?.value);
    if (captured.status !== 'COMPLETED' || capturedAmount !== expectedAmount) {
      return NextResponse.json({ success: false, error: 'PayPal 결제 승인 검증에 실패했습니다.' }, { status: 400 });
    }

    const { data: existingBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, guests, type')
      .eq('experience_id', originalBooking.experience_id)
      .eq('date', originalBooking.date)
      .eq('time', originalBooking.time)
      .neq('id', bookingId)
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
        payment_method: 'paypal',
        tid: captured.captureId,
        price_at_booking: snapshot.basePrice,
        total_experience_price: snapshot.totalExperiencePrice,
        host_payout_amount: snapshot.hostPayout,
        platform_revenue: snapshot.platformRevenue,
        payout_status: 'pending',
      })
      .eq('id', bookingId)
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
      }).catch((mailError) => console.error('[PAYPAL] host email dispatch failed:', mailError));
    }

    insertAdminAlerts({
      title: '체험 예약 PayPal 결제가 완료되었습니다',
      message: `'${expTitle}' 예약 결제가 완료되었습니다. 게스트: ${guestName}`,
      link: '/admin/dashboard?tab=LEDGER',
    }).catch((adminAlertError) => {
      console.error('[PAYPAL] booking admin alert failed:', adminAlertError);
    });

    return NextResponse.json({
      success: true,
      captureId: captured.captureId,
      bookingId,
      paypalOrderId: captured.orderId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[PAYPAL] capture-order error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
