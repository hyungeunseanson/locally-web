import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

// PATCH: 어드민이 맞춤 의뢰 제목·내용 수정
export async function PATCH(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const [userEntry, whitelist] = await Promise.all([
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle(),
    ]);

    const isAdmin = userEntry.data?.role === 'admin' || !!whitelist.data;
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { requestId, title, description } = await req.json();
    if (!requestId || (!title && !description)) {
      return NextResponse.json({ success: false, error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (title?.trim()) updates.title = title.trim();
    if (description?.trim()) updates.description = description.trim();

    const { error: updateError } = await supabaseAdmin
      .from('service_requests')
      .update(updates)
      .eq('id', requestId);

    if (updateError) {
      console.error('[admin/service-requests] update error:', updateError);
      return NextResponse.json({ success: false, error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/service-requests] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
