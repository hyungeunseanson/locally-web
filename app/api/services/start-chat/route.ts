import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

// POST /api/services/start-chat
// 서비스 매칭 완료 후 고객 ↔ 선택 호스트 1:1 채팅방 생성 또는 기존 채팅방 반환
export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = (await req.json()) as { requestId?: string };

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 의뢰 조회
    const { data: serviceRequest } = await supabaseAdmin
      .from('service_requests')
      .select('id, user_id, selected_host_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (!serviceRequest) {
      return NextResponse.json({ error: '의뢰를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!serviceRequest.selected_host_id) {
      return NextResponse.json({ error: '매칭된 호스트가 없습니다.' }, { status: 400 });
    }

    const isCustomer = user.id === serviceRequest.user_id;
    const isSelectedHost = user.id === serviceRequest.selected_host_id;

    if (!isCustomer && !isSelectedHost) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const guestId = serviceRequest.user_id as string;
    const hostId = serviceRequest.selected_host_id as string;

    // 기존 inquiry 조회 (experience_id IS NULL 조건으로 서비스 매칭 채팅 구분)
    const { data: existing } = await supabaseAdmin
      .from('inquiries')
      .select('id')
      .eq('user_id', guestId)
      .eq('host_id', hostId)
      .is('experience_id', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ inquiryId: existing.id, guestId, hostId });
    }

    // 새 inquiry 생성 (experience_id 없는 서비스 매칭 채팅)
    const { data: newInquiry, error: insertError } = await supabaseAdmin
      .from('inquiries')
      .insert([{ user_id: guestId, host_id: hostId, content: '', type: 'general' }])
      .select()
      .maybeSingle();

    if (insertError || !newInquiry) {
      console.error('[service/start-chat] insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 });
    }

    return NextResponse.json({ inquiryId: newInquiry.id, guestId, hostId });
  } catch (err) {
    console.error('[service/start-chat] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
