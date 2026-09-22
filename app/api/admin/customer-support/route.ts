import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import type { ProxyRequest } from '@/app/types/proxy';
import { getProxyRequestTitle } from '@/app/utils/proxyBooking';
import { matchesPhoneFilter, PHONE_FILTER_LABELS, type PhoneFilter } from '@/app/utils/phoneReservationWorkspace';
import { enrichPhoneRequests, filteredPage, FORMAL_PROXY_FILTER, PROXY_SELECT } from './queries';

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const db = createAdminClient();
    if (!(await resolveAdminAccess(db, { userId: user.id, email: user.email })).isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const requestId = params.get('requestId');
    if (requestId) {
      const { data, error } = await db.from('proxy_requests').select(`${PROXY_SELECT},tid,paid_at,refunded_at`)
        .or(FORMAL_PROXY_FILTER).eq('id', requestId).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
      const [detail] = await enrichPhoneRequests(db, [data as ProxyRequest]);
      return NextResponse.json({ success: true, data: detail }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const rawFilter = params.get('filter') || 'todo';
    const filter: PhoneFilter = Object.hasOwn(PHONE_FILTER_LABELS, rawFilter) ? rawFilter as PhoneFilter : 'todo';
    const q = (params.get('q') || '').trim().toLocaleLowerCase().slice(0, 200);
    const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(params.get('limit') || '10', 10) || 10));
    const page = await filteredPage(async scan => {
      const { data, error } = await db.from('proxy_requests').select(PROXY_SELECT).or(FORMAL_PROXY_FILTER)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(scan, scan + 99);
      if (error) throw error;
      return enrichPhoneRequests(db, data as ProxyRequest[]);
    }, row => matchesPhoneFilter(row, filter) && (!q || [row.id, row.locally_order_id, row.profiles?.full_name,
      row.profiles?.email, row.form_data.contact_name, row.form_data.reservation_name, getProxyRequestTitle(row)]
      .some(value => String(value || '').toLocaleLowerCase().includes(q))), offset, limit);
    return NextResponse.json({ success: true, ...page }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[customer-support] phone read failed:', error);
    return NextResponse.json({ success: false, error: '전화예약을 불러오지 못했습니다.' }, { status: 500 });
  }
}
