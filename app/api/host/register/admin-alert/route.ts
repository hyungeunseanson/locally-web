import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';

export async function POST() {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: application, error: applicationError } = await supabaseAdmin
      .from('host_applications')
      .select('id, name, email, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (applicationError || !application) {
      return NextResponse.json({ success: false, error: 'Host application not found' }, { status: 404 });
    }

    if (application.status !== 'pending') {
      return NextResponse.json({ success: true, skipped: true });
    }

    const applicantName = application.name || user.email || '새 호스트';

    await insertAdminAlerts({
      title: '새 호스트 신청이 접수되었습니다',
      message: `${applicantName}님의 호스트 신청이 접수되었습니다.`,
      link: '/admin/dashboard?tab=APPROVALS',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Host Register Admin Alert Route Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create admin alert' }, { status: 500 });
  }
}
