import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { ADMIN_CHAT_SEARCH_MIN_LENGTH, ADMIN_CHAT_SEARCH_MAX_LENGTH, ADMIN_CHAT_SEARCH_LIMIT } from '@/app/utils/adminChatSearch';

export async function GET(request: Request) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store' },
  });
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ success: false, error: 'Unauthorized' }, 401);
    const db = createAdminClient();
    if (!(await resolveAdminAccess(db, { userId: user.id, email: user.email })).isAdmin) {
      return json({ success: false, error: 'Forbidden' }, 403);
    }
    const params = new URL(request.url).searchParams;
    const surface = params.get('surface');
    const query = (params.get('q') || '').trim();
    if (!['support', 'phone'].includes(surface || '') || query.length > ADMIN_CHAT_SEARCH_MAX_LENGTH) {
      return json({ success: false, error: 'Invalid search query' }, 400);
    }
    if (query.length < ADMIN_CHAT_SEARCH_MIN_LENGTH) return json({ success: true, data: [] });
    const result = await db.rpc('search_admin_chat', { p_surface: surface, p_query: query })
      .abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]));
    if (result.error) throw result.error;
    return json({ success: true, data: (result.data || []).slice(0, ADMIN_CHAT_SEARCH_LIMIT) });
  } catch {
    return json({ success: false, error: '검색하지 못했습니다. 다시 시도해주세요.' }, 500);
  }
}
