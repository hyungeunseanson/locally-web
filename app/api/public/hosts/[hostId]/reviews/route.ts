import { NextResponse } from 'next/server';

import { isPublicHostApplicationStatus, pickLatestPublicHostApplication } from '@/app/utils/hostVisibility';
import { createAdminClient } from '@/app/utils/supabase/admin';

type PublicHostApplicationRow = {
  id: string | number;
  user_id: string | null;
  status: string | null;
  created_at?: string | null;
};

type ReviewRow = {
  id: number;
  user_id: string | null;
  rating: number;
  content: string | null;
  created_at: string;
  reply: string | null;
  reply_at: string | null;
  photos: string[] | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await context.params;
    if (!hostId) {
      return NextResponse.json({ success: false, error: 'Invalid host id' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: hostAppRows, error: hostAppError } = await supabaseAdmin
      .from('public_host_applications')
      .select('id, user_id, status, created_at')
      .eq('user_id', hostId)
      .order('created_at', { ascending: false });

    if (hostAppError) throw hostAppError;

    const hostApp = pickLatestPublicHostApplication((hostAppRows || []) as PublicHostApplicationRow[]);
    if (!hostApp || !isPublicHostApplicationStatus(hostApp.status)) {
      return NextResponse.json({ success: false, error: 'Host not found' }, { status: 404 });
    }

    const { data: reviewRows, error: reviewsError } = await supabaseAdmin
      .from('reviews')
      .select('id, user_id, rating, content, created_at, reply, reply_at, photos, experiences!inner(host_id)')
      .eq('experiences.host_id', hostId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;

    return NextResponse.json({
      success: true,
      data: ((reviewRows as ReviewRow[] | null) || []).map((review) => ({
        id: review.id,
        user_id: review.user_id,
        rating: review.rating,
        content: review.content,
        created_at: review.created_at,
        reply: review.reply,
        reply_at: review.reply_at,
        photos: review.photos || [],
      })),
    });
  } catch (error) {
    console.error('[api/public/hosts/[hostId]/reviews] GET failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to load public host reviews';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
