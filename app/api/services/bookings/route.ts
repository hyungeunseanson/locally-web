import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ServiceBookingAtomicResult = {
  new_order_id: string;
  final_amount: number;
  host_payout: number;
  platform_margin: number;
  host_id: string;
};

type CreateServiceBookingBody = {
  request_id?: string;
  application_id?: string;
  contact_name?: string;
  contact_phone?: string;
};

export async function POST(request: Request) {
  try {
    // 1. 인증 확인
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateServiceBookingBody;
    const { request_id, application_id, contact_name, contact_phone } = body;

    if (!request_id || !application_id || !contact_name || !contact_phone) {
      return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    // 2. 관리자 권한 클라이언트
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 3. 원자적 예약 생성 RPC
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .rpc('create_service_booking_atomic', {
        p_customer_id: user.id,
        p_request_id: request_id,
        p_application_id: application_id,
        p_contact_name: contact_name.trim(),
        p_contact_phone: contact_phone.trim(),
      })
      .maybeSingle<ServiceBookingAtomicResult>();

    if (bookingError || !bookingData) {
      const errMsg = bookingError?.message || '예약 처리 중 오류가 발생했습니다.';

      if (errMsg.includes('SVC_NOT_FOUND')) {
        return NextResponse.json({ success: false, error: '의뢰 또는 지원서를 찾을 수 없습니다.' }, { status: 404 });
      }
      if (errMsg.includes('SVC_INVALID_STATUS')) {
        return NextResponse.json({ success: false, error: '결제 가능한 상태가 아닙니다.' }, { status: 409 });
      }
      if (errMsg.includes('SVC_FORBIDDEN')) {
        return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
      }
      if (errMsg.includes('SVC_BAD_REQUEST')) {
        return NextResponse.json({ success: false, error: '선택된 지원서 정보가 올바르지 않습니다.' }, { status: 400 });
      }

      console.error('Service Booking Atomic Error:', bookingError);
      throw new Error(errMsg);
    }

    return NextResponse.json({
      success: true,
      newOrderId: bookingData.new_order_id,
      finalAmount: bookingData.final_amount,
    });

  } catch (error: unknown) {
    console.error('API Service Booking Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
