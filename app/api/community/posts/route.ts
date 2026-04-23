import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { sanitizeText } from '@/app/utils/sanitize';
import { revalidatePath, revalidateTag } from 'next/cache';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createCommunityInsertPayload } from '@/app/community/feedSelect';
import {
    isMissingAnonymousColumnError,
    isMissingCommunityBoardColumnError,
    isMissingCommunityModelColumnError,
} from '@/app/community/anonymousColumn';
import { getLegacyHubSeedForBoard, resolveCommunityBoard } from '@/app/community/boardMeta';
import { getCommunityCategoryFromFormat } from '@/app/community/categoryMeta';
import type { CommunityBoard, CommunityHub, CommunityPostFormat, CommunitySourceLocale } from '@/app/types/community';

async function cleanupUploadedImages(imagePaths: string[]) {
    if (imagePaths.length === 0) return;

    try {
        const supabaseAdmin = createAdminClient();
        const { error } = await supabaseAdmin.storage.from('images').remove(imagePaths);

        if (error) {
            console.error('Community post image cleanup failed:', error);
        }
    } catch (error) {
        console.error('Community post image cleanup threw unexpectedly:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const allowedCategories = new Set(['qna', 'companion', 'info', 'locally_content']);
        const anonymousAllowedCategories = new Set(['qna', 'companion', 'info']);
        const allowedFormats = new Set(['question', 'companion', 'live_tip', 'locally_pick']);
        const allowedHubs = new Set(['tokyo', 'osaka_kyoto', 'fukuoka', 'jp_other', 'seoul', 'busan', 'jeju']);
        const allowedLocales = new Set(['ko', 'ja', 'en', 'zh']);
        const allowedBoards = new Set(['japan', 'korea']);

        // Check Authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            category,
            title,
            content,
            images,
            image_paths,
            companion_date,
            companion_city,
            linked_exp_id,
            is_anonymous,
            destination_hub,
            post_format,
            source_locale,
            board_country,
        } = body;
        const normalizedImages = Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string' && image.length > 0) : [];
        const normalizedImagePaths = Array.isArray(image_paths) ? image_paths.filter((imagePath): imagePath is string => typeof imagePath === 'string' && imagePath.length > 0) : [];
        const normalizedCompanionCity = typeof companion_city === 'string' ? companion_city.trim() : '';
        const normalizedBoard = typeof board_country === 'string' && allowedBoards.has(board_country)
            ? resolveCommunityBoard(board_country) as CommunityBoard
            : null;
        const normalizedHub = normalizedBoard
            ? null
            : typeof destination_hub === 'string' && allowedHubs.has(destination_hub)
                ? destination_hub as CommunityHub
                : null;
        const normalizedFormat = normalizedBoard
            ? 'question'
            : typeof post_format === 'string' && allowedFormats.has(post_format)
                ? post_format as CommunityPostFormat
                : undefined;
        const normalizedLocale = typeof source_locale === 'string' && allowedLocales.has(source_locale) ? source_locale as CommunitySourceLocale : 'ko';
        const resolvedCategory = normalizedBoard
            ? 'qna'
            : normalizedFormat
                ? getCommunityCategoryFromFormat(normalizedFormat)
                : category;
        const normalizedIsAnonymous = Boolean(is_anonymous) && anonymousAllowedCategories.has(resolvedCategory);

        // Validate Required Fields
        if (!title || !content || (!normalizedBoard && !category)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        // [Security] 제목/본문 길이 제한 — DB overflow 및 이메일 페이로드 블로팅 방지
        if (title.trim().length > 200) {
            return NextResponse.json({ error: '제목은 200자를 초과할 수 없습니다.' }, { status: 400 });
        }
        if (content.trim().length > 10000) {
            return NextResponse.json({ error: '본문은 10000자를 초과할 수 없습니다.' }, { status: 400 });
        }
        if (!allowedCategories.has(resolvedCategory)) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }
        if (resolvedCategory === 'companion' && (!companion_date || !normalizedCompanionCity)) {
            return NextResponse.json({ error: 'Companion posts require date and city' }, { status: 400 });
        }
        if (resolvedCategory === 'locally_content') {
            const { isAdmin } = await resolveAdminAccess(supabase, {
                userId: user.id,
                email: user.email,
            });
            if (!isAdmin) {
                await cleanupUploadedImages(normalizedImagePaths);
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Insert new post into DB — [XSS] 서버사이드 HTML 태그 제거
        const insertPayload = createCommunityInsertPayload({
            userId: user.id,
            category: resolvedCategory,
            title: sanitizeText(title),
            content: sanitizeText(content),
            images: normalizedImages,
            isAnonymous: normalizedIsAnonymous,
            companionDate: companion_date || null,
            companionCity: normalizedCompanionCity || null,
            linkedExpId: linked_exp_id || null,
            destinationHub: normalizedHub,
            postFormat: normalizedFormat,
            sourceLocale: normalizedLocale,
            boardCountry: normalizedBoard,
        });

        const attemptInsert = async (payload: Record<string, unknown>) => supabase
            .from('community_posts')
            .insert(payload)
            .select('id')
            .single();

        let currentPayload: Record<string, unknown> = insertPayload;
        let { data, error } = await attemptInsert(currentPayload);

        if (error && isMissingCommunityBoardColumnError(error)) {
            const preBoardPayload = { ...currentPayload };
            delete preBoardPayload.board_country;
            if (normalizedBoard && !preBoardPayload.destination_hub) {
                preBoardPayload.destination_hub = getLegacyHubSeedForBoard(normalizedBoard);
            }
            currentPayload = preBoardPayload;
            const retryResult = await attemptInsert(currentPayload);
            data = retryResult.data;
            error = retryResult.error;
        }

        if (error && isMissingCommunityModelColumnError(error)) {
            const legacyCompatiblePayload = { ...currentPayload };
            delete legacyCompatiblePayload.destination_hub;
            delete legacyCompatiblePayload.post_format;
            delete legacyCompatiblePayload.source_locale;
            currentPayload = legacyCompatiblePayload;
            const retryResult = await attemptInsert(currentPayload);
            data = retryResult.data;
            error = retryResult.error;
        }

        if (error && isMissingAnonymousColumnError(error)) {
            const legacyPayload = { ...currentPayload };
            delete legacyPayload.is_anonymous;
            currentPayload = legacyPayload;
            const retryResult = await attemptInsert(currentPayload);
            data = retryResult.data;
            error = retryResult.error;
        }

        if (error) {
            console.error('Error inserting community post:', error);
            await cleanupUploadedImages(normalizedImagePaths);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ✅ 핵심: 글 등록 후 /community 라우터 캐시 무효화
        // 이 호출이 없으면 피드로 돌아가도 Next.js가 구 버전 캐시를 서빙함
        revalidatePath('/community');
        revalidateTag('community-board-feed', 'max');
        if (normalizedBoard) {
            revalidateTag(`community-board-feed-${normalizedBoard}`, 'max');
        }

        return NextResponse.json({ id: data?.id });
    } catch (err) {
        console.error('API Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
