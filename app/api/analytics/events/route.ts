import { NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  extractAnalyticsTrackingMetadata,
  insertAnalyticsEvent,
  normalizeRequiredText,
} from '@/app/utils/analytics/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

const ALLOWED_EVENT_TYPES = new Set(['view', 'click', 'payment_init', 'booking_confirmed']);

type AnalyticsEventRequestBody = {
  event_type?: unknown;
  target_id?: unknown;
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
    const body = (await request.json()) as AnalyticsEventRequestBody;
    const eventType = normalizeRequiredText(body.event_type, 64);

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ success: false, error: 'Invalid event_type' }, { status: 400 });
    }

    const targetId = normalizeRequiredText(body.target_id, 200) || null;
    const tracking = extractAnalyticsTrackingMetadata(body);

    const supabaseServer = await createServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    const supabaseAdmin = createAdminClient();
    await insertAnalyticsEvent(supabaseAdmin, {
      event_type: eventType,
      target_id: targetId,
      user_id: user?.id || null,
      ...tracking,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[analytics/events] error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
