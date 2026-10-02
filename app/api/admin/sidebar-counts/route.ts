import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { attentionTotals, EMPTY_ATTENTION, type AttentionConversation } from '@/app/utils/adminAttentionState';

export async function GET(request: Request) {
  try {
    const server = await createServerClient();
    const { data: { user }, error: authError } = await server.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false }, { status: 401 });
    const admin = createAdminClient();
    if (!(await resolveAdminAccess(admin, { userId: user.id, email: user.email })).isAdmin) {
      return NextResponse.json({ success: false }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope');
    const rawIds = params.get('inquiryIds');
    const ids = rawIds?.split(',') ?? null;
    if (scope === 'conversations' && (!ids?.length || ids.length > 100 || ids.some(id => !/^[1-9]\d*$/.test(id)))) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    const alerts = () => admin.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false).eq('type', 'admin_alert');
    if (scope === 'alerts') {
      const result = await alerts(); if (result.error) throw result.error;
      return NextResponse.json({ success: true, data: { adminAlertsUnread: result.count ?? 0 } });
    }
    const attention = await admin.rpc('get_admin_attention', { p_inquiry_ids: scope === 'conversations' ? ids : null });
    if (attention.error) throw attention.error;
    const conversations = (attention.data ?? []) as AttentionConversation[];
    const counts = attentionTotals({ ...EMPTY_ATTENTION, conversations: Object.fromEntries(conversations.map(row => [String(row.inquiry_id), row])) });
    const data = { conversations, csUnreadCount: counts.total, csUnseenByView: counts };
    if (scope === 'conversations') return NextResponse.json({ success: true, data });
    const results = await Promise.all([
      admin.from('host_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('experiences').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'PENDING').eq('payment_method', 'bank'),
      admin.from('service_bookings').select('id', { count: 'exact', head: true }).eq('status', 'PENDING').eq('payment_method', 'bank'),
      alerts(),
    ]);
    for (const result of results) if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: { ...data, appsCount: results[0].count ?? 0, expsCount: results[1].count ?? 0,
      pendingBookingCount: results[2].count ?? 0, svcBankPendingCount: results[3].count ?? 0, adminAlertsUnread: results[4].count ?? 0,
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[admin/sidebar-counts] failed:', error);
    return NextResponse.json({ success: false, error: '관리자 표시를 불러오지 못했습니다.' }, { status: 500 });
  }
}
