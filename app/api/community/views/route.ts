import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { enforcePublicWriteGuard } from '@/app/utils/security/publicWriteGuard';

const COMMUNITY_VIEW_COOKIE_PREFIX = 'community_viewed_';
const COMMUNITY_VIEW_COOKIE_MAX_AGE = 60 * 60 * 6;

function buildViewCookieName(postId: string) {
  return `${COMMUNITY_VIEW_COOKIE_PREFIX}${postId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export async function POST(request: NextRequest) {
  try {
    const { postId } = (await request.json()) as { postId?: string };
    if (!postId) {
      return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 });
    }
    // [Security] UUID 형식 검증 — 비정상 postId로 불필요한 DB 쿼리/쿠키명 오염 방지
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(postId)) {
      return NextResponse.json({ success: false, error: 'Invalid postId' }, { status: 400 });
    }

    const cookieName = buildViewCookieName(postId);
    const alreadyCounted = request.cookies.get(cookieName)?.value === '1';

    if (!alreadyCounted) {
      const guardResult = enforcePublicWriteGuard(request, {
        bucket: 'community_views',
        scopeKey: postId,
        limit: 5,
        windowMs: 10 * 60 * 1000,
      });

      if (guardResult.blockedByOrigin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      if (!guardResult.allowed) {
        return NextResponse.json(
          {
            success: true,
            counted: false,
            rateLimited: true,
          },
          {
            status: 202,
            headers: guardResult.retryAfterSeconds
              ? { 'Retry-After': String(guardResult.retryAfterSeconds) }
              : undefined,
          }
        );
      }
    }

    const supabaseAdmin = createAdminClient();

    const { data: post, error: postError } = await supabaseAdmin
      .from('community_posts')
      .select('id, view_count')
      .eq('id', postId)
      .maybeSingle();

    if (postError || !post) {
      return NextResponse.json({ success: false, error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    let nextViewCount = Number(post.view_count || 0);

    if (!alreadyCounted) {
      nextViewCount += 1;
      const { error: updateError } = await supabaseAdmin
        .from('community_posts')
        .update({ view_count: nextViewCount })
        .eq('id', postId);

      if (updateError) {
        throw updateError;
      }
    }

    const response = NextResponse.json({
      success: true,
      viewCount: nextViewCount,
      counted: !alreadyCounted,
    });

    if (!alreadyCounted) {
      response.cookies.set(cookieName, '1', {
        httpOnly: true,
        maxAge: COMMUNITY_VIEW_COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('[community/views] error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
