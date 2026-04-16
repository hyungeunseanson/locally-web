import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';

const ADMIN_ALERT_LINK = '/admin/dashboard?tab=APPROVALS';
const COMPATIBILITY_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

// Legacy compatibility route.
// Current host register submit flow already creates the admin alert inside
// POST /api/host/register/submit. Keep this endpoint alive for older clients
// that may still call it after saving the application.
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
    const title = '새 호스트 신청이 접수되었습니다';
    const message = `${applicantName}님의 호스트 신청이 접수되었습니다.`;
    const dedupeWindowStart = new Date(Date.now() - COMPATIBILITY_DEDUPE_WINDOW_MS).toISOString();
    const { data: recentAlert, error: recentAlertError } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('type', 'admin_alert')
      .eq('title', title)
      .eq('message', message)
      .eq('link', ADMIN_ALERT_LINK)
      .gte('created_at', dedupeWindowStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentAlertError) {
      throw recentAlertError;
    }

    if (recentAlert?.id) {
      return NextResponse.json({ success: true, skipped: true, deduped: true });
    }

    await insertAdminAlerts({
      title,
      message,
      link: ADMIN_ALERT_LINK,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Host Register Admin Alert Route Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create admin alert' }, { status: 500 });
  }
}
