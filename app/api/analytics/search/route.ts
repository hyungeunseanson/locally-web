import { NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  extractAnalyticsTrackingMetadata,
  insertSearchLog,
  normalizeRequiredText,
} from '@/app/utils/analytics/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type AnalyticsSearchRequestBody = {
  keyword?: unknown;
  route?: unknown;
  session_id?: unknown;
  referrer?: unknown;
  referrer_host?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  landing_path?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyticsSearchRequestBody;
    const keyword = normalizeRequiredText(body.keyword, 200);

    if (!keyword) {
      return NextResponse.json({ success: false, error: 'Invalid keyword' }, { status: 400 });
    }

    const route = normalizeRequiredText(body.route, 100) || 'main';
    const tracking = extractAnalyticsTrackingMetadata(body);

    const supabaseServer = await createServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    const supabaseAdmin = createAdminClient();
    await insertSearchLog(supabaseAdmin, {
      keyword,
      route,
      user_id: user?.id || null,
      ...tracking,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[analytics/search] error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
