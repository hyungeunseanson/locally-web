import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Admin role check (role=admin OR admin_whitelist)
    const [userEntry, whitelist] = await Promise.all([
      supabaseServer.from('users').select('role').eq('id', user.id).maybeSingle(),
      supabaseServer.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
    ]);

    const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, error: '주문번호가 필요합니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 3. Fetch service_booking
    const { data: booking } = await supabaseAdmin
      .from('service_bookings')
      .select('id, order_id, request_id, customer_id, status, payment_method, amount')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json({ success: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (booking.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `현재 상태(${booking.status})에서는 입금 확인할 수 없습니다.` },
        { status: 409 }
      );
    }

    if (booking.payment_method !== 'bank') {
      return NextResponse.json({ success: false, error: '무통장 입금 예약이 아닙니다.' }, { status: 409 });
    }

    // 4. Fetch service request info (for notifications)
    const { data: serviceRequest } = await supabaseAdmin
      .from('service_requests')
      .select('title, city, duration_hours, guest_count')
      .eq('id', booking.request_id)
      .maybeSingle();

    const requestTitle = serviceRequest?.title || '맞춤 서비스';
    const reqCity = (serviceRequest as { city?: string } | null)?.city ?? '';
    const reqDuration = (serviceRequest as { duration_hours?: number } | null)?.duration_hours ?? 0;
    const reqGuests = (serviceRequest as { guest_count?: number } | null)?.guest_count ?? 0;

    // 5. service_bookings: PENDING → PAID (identical to nicepay-callback)
    const { error: bookingUpdateErr } = await supabaseAdmin
      .from('service_bookings')
      .update({ status: 'PAID' })
      .eq('order_id', orderId);

    if (bookingUpdateErr) throw new Error(`Booking update failed: ${bookingUpdateErr.message}`);

    // 6. service_requests: pending_payment → open (identical to nicepay-callback)
    const { error: requestUpdateErr } = await supabaseAdmin
      .from('service_requests')
      .update({ status: 'open' })
      .eq('id', booking.request_id);

    if (requestUpdateErr) {
      console.error('[ADMIN] service request update error:', requestUpdateErr);
    }

    // 7. Notify all approved hosts (identical to nicepay-callback)
    supabaseAdmin
      .from('host_applications')
      .select('user_id')
      .eq('status', 'approved')
      .then(async ({ data: hosts }) => {
        if (!hosts || hosts.length === 0) return;
        const hostIds = hosts
          .map((h) => h.user_id as string)
          .filter((id) => !!id && id !== booking.customer_id);
        if (hostIds.length === 0) return;
        const notifications = hostIds.map((hostId) => ({
          user_id: hostId,
          type: 'service_request_new',
          title: `📋 새로운 맞춤 서비스 의뢰 — ${reqCity}`,
          message: `${requestTitle} (${reqDuration}시간, ${reqGuests}명)`,
          link: `/services/${booking.request_id}`,
          is_read: false,
        }));
        const { error: notiErr } = await supabaseAdmin.from('notifications').insert(notifications);
        if (notiErr) console.error('[ADMIN] host notification error:', notiErr);
      });

    // 8. Notify customer (identical to nicepay-callback)
    supabaseAdmin.from('notifications').insert({
      user_id: booking.customer_id,
      type: 'service_payment_confirmed',
      title: '✅ 입금 확인 완료! 호스트 모집이 시작됩니다',
      message: `'${requestTitle}' 입금이 확인되어 현지 호스트들의 지원이 시작됩니다.`,
      link: `/services/${booking.request_id}`,
      is_read: false,
    }).then(({ error }) => {
      if (error) console.error('[ADMIN] customer notification error:', error);
    });

    // 9. Audit log
    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_SERVICE_CONFIRM_BANK',
      target_type: 'service_booking',
      target_id: orderId,
      details: { request_title: requestTitle, amount: booking.amount },
    });

    return NextResponse.json({ success: true, message: '입금 확인 완료. 의뢰가 공개되었습니다.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ADMIN] service-confirm-payment error:', msg);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
