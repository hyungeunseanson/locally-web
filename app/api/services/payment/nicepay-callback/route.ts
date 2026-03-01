import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

function verifySignature(signData: string, ediDate: string, amount: string, mid: string, key: string): boolean {
  try {
    const data = ediDate + mid + amount + key;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash === signData;
  } catch (error) {
    console.error('Service Payment Signature verification failed:', error);
    return false;
  }
}

export async function POST(request: Request) {
  console.log('🔒 [SERVICE] Payment Callback Received');

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const MER_KEY = process.env.NICEPAY_MERCHANT_KEY;
    const MID = process.env.NICEPAY_MID;

    if (!SUPABASE_URL || !SERVICE_KEY || !MER_KEY || !MID) {
      return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    let resCode = '';
    let amount = '';
    let orderId = '';
    let tid = '';
    let signData = '';
    let ediDate = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await request.json();
      resCode = json.resCode || json.resultCode || '';
      amount = (json.paid_amount || json.amount || '').toString();
      orderId = json.merchant_uid || json.orderId || '';
      tid = json.pg_tid || json.imp_uid || '';
      signData = json.signData || '';
      ediDate = json.ediDate || '';
    } else {
      const formData = await request.formData();
      resCode = formData.get('resCode')?.toString() || '';
      amount = formData.get('amt')?.toString() || '';
      orderId = formData.get('moid')?.toString() || '';
      tid = formData.get('tid')?.toString() || '';
      signData = formData.get('signData')?.toString() || '';
      ediDate = formData.get('ediDate')?.toString() || '';
    }

    // 서비스 주문번호 접두사 검증
    if (!orderId.startsWith('SVC-')) {
      console.error(`[SERVICE CALLBACK] Invalid order prefix: ${orderId}`);
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }

    // 서명 검증
    if (!verifySignature(signData, ediDate, amount, MID, MER_KEY)) {
      console.error(`🚨 [SERVICE SECURITY] Signature Mismatch! Order: ${orderId}`);
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
    }

    if (resCode !== '0000') {
      console.log(`[SERVICE CALLBACK] Payment failed. Code: ${resCode}, Order: ${orderId}`);
      return NextResponse.json({ success: false, message: 'Payment not successful' });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. service_bookings 조회
    const { data: serviceBooking } = await supabase
      .from('service_bookings')
      .select('*, service_requests(user_id, title)')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!serviceBooking) {
      throw new Error(`[SERVICE] 예약 정보를 찾을 수 없습니다. order_id=${orderId}`);
    }

    // 중복 처리 방지
    if (serviceBooking.status === 'PAID' || serviceBooking.status === 'confirmed') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // 금액 검증
    const paidAmount = Number(amount);
    if (paidAmount !== serviceBooking.amount) {
      console.error(`[SERVICE] Amount mismatch! Expected: ${serviceBooking.amount}, Got: ${paidAmount}`);
      throw new Error('Amount mismatch');
    }

    // 2. service_bookings 상태 PAID로 변경
    const { error: bookingUpdateErr } = await supabase
      .from('service_bookings')
      .update({ status: 'PAID', tid })
      .eq('order_id', orderId);

    if (bookingUpdateErr) {
      throw new Error(`[SERVICE] Booking update failed: ${bookingUpdateErr.message}`);
    }

    // 3. service_requests 상태 paid로 변경
    const { error: requestUpdateErr } = await supabase
      .from('service_requests')
      .update({ status: 'paid' })
      .eq('id', serviceBooking.request_id);

    if (requestUpdateErr) {
      console.error('[SERVICE] Request status update failed:', requestUpdateErr);
    }

    const requestTitle = (serviceBooking.service_requests as { title?: string } | null)?.title || '맞춤 서비스';

    // 4. 양측 알림 발송 (비동기)
    const notifications = [
      {
        user_id: serviceBooking.customer_id,
        type: 'service_payment_confirmed',
        title: '✅ 결제가 완료되었습니다!',
        message: `'${requestTitle}' 서비스 결제가 확정되었습니다. 호스트가 연락드릴 예정입니다.`,
        link: `/services/my`,
        is_read: false,
      },
      {
        user_id: serviceBooking.host_id,
        type: 'service_payment_confirmed',
        title: '🎉 매칭이 확정되었습니다!',
        message: `'${requestTitle}' 서비스 결제가 완료되어 매칭이 확정되었습니다.`,
        link: `/host/dashboard?tab=service-jobs`,
        is_read: false,
      },
    ];

    supabase.from('notifications').insert(notifications).then(({ error }) => {
      if (error) console.error('[SERVICE] Payment Notification Error:', error);
    });

    console.log(`✅ [SERVICE] Payment confirmed. Order: ${orderId}`);
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[SERVICE] Payment Callback Error:', errMsg);
    return NextResponse.json({ error: '결제 처리 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
