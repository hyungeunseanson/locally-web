import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const lastViewed = searchParams.get('lastViewed') || new Date(0).toISOString();

    const [tasksRes, commentsRes] = await Promise.all([
      supabaseAdmin
        .from('admin_tasks')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastViewed),
      supabaseAdmin
        .from('admin_task_comments')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastViewed),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        newTasksCount: tasksRes.count || 0,
        newCommentsCount: commentsRes.count || 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ADMIN] /api/admin/team-counts error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
