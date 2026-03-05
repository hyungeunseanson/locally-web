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

    // 서명 검증 (IMP 클라이언트 콜백 시 signData가 비어있을 수 있음 — 금액 검증으로 대체)
    if (signData && ediDate && !verifySignature(signData, ediDate, amount, MID, MER_KEY)) {
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
      .select('*, service_requests(user_id, title, city, duration_hours, guest_count)')
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

    const requestTitle = (serviceBooking.service_requests as { title?: string; city?: string; duration_hours?: number; guest_count?: number } | null)?.title || '맞춤 서비스';
    const reqCity = (serviceBooking.service_requests as { city?: string } | null)?.city ?? '';
    const reqDuration = (serviceBooking.service_requests as { duration_hours?: number } | null)?.duration_hours ?? 0;
    const reqGuests = (serviceBooking.service_requests as { guest_count?: number } | null)?.guest_count ?? 0;

    // 3. service_requests 상태 open으로 변경 (v2 에스크로: 결제 완료 후 호스트 모집 시작)
    const { error: requestUpdateErr } = await supabase
      .from('service_requests')
      .update({ status: 'open' })
      .eq('id', serviceBooking.request_id);

    if (requestUpdateErr) {
      console.error('[SERVICE] Request status update failed:', requestUpdateErr);
    }

    // 4. 해당 도시 승인 호스트 전체에 알림 발송 (비동기)
    supabase
      .from('host_applications')
      .select('user_id')
      .eq('status', 'approved')
      .then(async ({ data: hosts }) => {
        if (!hosts || hosts.length === 0) return;

        // 도시 필터: reqCity가 있으면 해당 도시에 experiences 보유 호스트만 발송
        let eligibleHostIds: Set<string> | null = null;
        if (reqCity) {
          const { data: cityHosts } = await supabase
            .from('experiences')
            .select('host_id')
            .ilike('city', `%${reqCity}%`)
            .eq('is_active', true);
          eligibleHostIds = new Set((cityHosts ?? []).map((e) => e.host_id as string).filter(Boolean));
        }

        const hostIds = hosts
          .map((h) => h.user_id as string)
          .filter((id) => !!id && id !== serviceBooking.customer_id && (eligibleHostIds === null || eligibleHostIds.has(id)));
        if (hostIds.length === 0) return;
        const notifications = hostIds.map((hostId) => ({
          user_id: hostId,
          type: 'service_request_new',
          title: `📋 새로운 맞춤 서비스 의뢰 — ${reqCity}`,
          message: `${requestTitle} (${reqDuration}시간, ${reqGuests}명)`,
          link: `/services/${serviceBooking.request_id}`,
          is_read: false,
        }));
        const { error: notiErr } = await supabase.from('notifications').insert(notifications);
        if (notiErr) console.error('[SERVICE] Host Notification Error:', notiErr);
      });

    // 5. 고객에게만 알림 (에스크로: 호스트 미정이므로 고객만)
    supabase.from('notifications').insert({
      user_id: serviceBooking.customer_id,
      type: 'service_payment_confirmed',
      title: '✅ 결제 완료! 호스트 모집이 시작됩니다',
      message: `'${requestTitle}' 결제가 완료되었습니다. 현지 호스트들의 지원이 시작됩니다.`,
      link: `/services/${serviceBooking.request_id}`,
      is_read: false,
    }).then(({ error }) => {
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
