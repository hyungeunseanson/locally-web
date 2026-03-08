import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { getInquiryThreadErrorResponse, upsertInquiryThread } from '../../inquiries/thread/shared';

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
    const result = await upsertInquiryThread({
      actor: { id: user.id, email: user.email },
      body: {
        contextType: 'service_request',
        serviceRequestId: requestId,
        openOnly: true,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = getInquiryThreadErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
