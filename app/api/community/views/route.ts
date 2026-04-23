import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { enforcePublicWriteGuard } from '@/app/utils/security/publicWriteGuard';

const COMMUNITY_VIEW_COOKIE_PREFIX = 'community_viewed_';
const COMMUNITY_VIEW_COOKIE_MAX_AGE = 60 * 60 * 6;
const COMMUNITY_VIEW_INCREMENT_RPC = 'increment_community_post_view_count';

type CommunityViewRequestBody = {
  postId?: string;
  knownViewCount?: number;
};

type CommunityViewRpcErrorLike = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message?: string;
};

function buildViewCookieName(postId: string) {
  return `${COMMUNITY_VIEW_COOKIE_PREFIX}${postId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function normalizeViewCount(value: unknown) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.trunc(count);
}

function isMissingCommunityViewRpcError(error: CommunityViewRpcErrorLike | null | undefined) {
  if (!error) return false;

  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (combinedMessage.includes(COMMUNITY_VIEW_INCREMENT_RPC) &&
      (combinedMessage.includes('Could not find the function') ||
        combinedMessage.includes('No function matches') ||
        combinedMessage.includes('does not exist')))
  );
}

async function incrementCommunityPostViewCountFallback(postId: string) {
  const supabaseAdmin = createAdminClient();
  const { data: post, error: postError } = await supabaseAdmin
    .from('community_posts')
    .select('id, view_count')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post) {
    return { viewCount: null as number | null, notFound: true };
  }

  const nextViewCount = normalizeViewCount(post.view_count) + 1;
  const { error: updateError } = await supabaseAdmin
    .from('community_posts')
    .update({ view_count: nextViewCount })
    .eq('id', postId);

  if (updateError) {
    throw updateError;
  }

  return { viewCount: nextViewCount, notFound: false };
}

export async function POST(request: NextRequest) {
  try {
    const { postId, knownViewCount } = (await request.json()) as CommunityViewRequestBody;
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
    const normalizedKnownViewCount = normalizeViewCount(knownViewCount);

    if (alreadyCounted) {
      return NextResponse.json({
        success: true,
        counted: false,
        viewCount: normalizedKnownViewCount,
      });
    }

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

    const supabaseAdmin = createAdminClient();
    let nextViewCount: number | null = null;

    const atomicResult = await supabaseAdmin.rpc(COMMUNITY_VIEW_INCREMENT_RPC, {
      p_post_id: postId,
    });

    if (atomicResult.error) {
      if (isMissingCommunityViewRpcError(atomicResult.error)) {
        console.warn(
          '[community/views] atomic RPC missing; using guarded fallback until migration is applied.'
        );
        const fallbackResult = await incrementCommunityPostViewCountFallback(postId);
        if (fallbackResult.notFound) {
          return NextResponse.json(
            { success: false, error: '게시글을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        nextViewCount = fallbackResult.viewCount;
      } else {
        throw atomicResult.error;
      }
    } else {
      nextViewCount = normalizeViewCount(atomicResult.data);
    }

    if (nextViewCount === null) {
      return NextResponse.json({ success: false, error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      viewCount: nextViewCount,
      counted: true,
    });

    response.cookies.set(cookieName, '1', {
      httpOnly: true,
      maxAge: COMMUNITY_VIEW_COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[community/views] error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
