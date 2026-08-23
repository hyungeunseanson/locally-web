import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getAdminManualPayoutPreview } from '@/app/utils/adminManualPayouts';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type PreviewBody = { hostId?: string };

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as PreviewBody;
    const hostId = body.hostId?.trim();
    if (!hostId) {
      return NextResponse.json({ success: false, error: '호스트 ID가 필요합니다.' }, { status: 400 });
    }

    const preview = await getAdminManualPayoutPreview(supabaseAdmin, hostId);
    return NextResponse.json({ success: true, preview });
  } catch (error: unknown) {
    console.error('[ADMIN] manual payout preview error:', error);
    const message = error instanceof Error ? error.message : '수동 정산 정보를 확인하지 못했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
