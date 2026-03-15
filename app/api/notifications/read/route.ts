import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/app/utils/supabase/server';

type NotificationReadRequestBody = {
  notificationId?: number;
  markAll?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as NotificationReadRequestBody;
    const notificationId = Number(body.notificationId);
    const markAll = body.markAll === true;

    if (!markAll && !Number.isFinite(notificationId)) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

    const query = supabaseServer
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    const { data, error } = markAll
      ? await query.select('id')
      : await query.eq('id', notificationId).select('id');

    if (error) {
      throw error;
    }

    const markedIds = (data || []).map((row) => Number(row.id)).filter((id) => Number.isFinite(id));

    return NextResponse.json({
      success: true,
      markedIds,
      markedCount: markedIds.length,
    });
  } catch (error) {
    console.error('[notifications/read] error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
