import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createCommunityInsertPayload } from '@/app/community/feedSelect';
import { isMissingAnonymousColumnError, isMissingCommunityModelColumnError } from '@/app/community/anonymousColumn';
import { getCommunityCategoryFromFormat } from '@/app/community/categoryMeta';
import type { CommunityHub, CommunityPostFormat, CommunitySourceLocale } from '@/app/types/community';

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
        } = body;
        const normalizedImages = Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string' && image.length > 0) : [];
        const normalizedImagePaths = Array.isArray(image_paths) ? image_paths.filter((imagePath): imagePath is string => typeof imagePath === 'string' && imagePath.length > 0) : [];
        const normalizedCompanionCity = typeof companion_city === 'string' ? companion_city.trim() : '';
        const normalizedHub = typeof destination_hub === 'string' && allowedHubs.has(destination_hub) ? destination_hub as CommunityHub : null;
        const normalizedFormat = typeof post_format === 'string' && allowedFormats.has(post_format) ? post_format as CommunityPostFormat : undefined;
        const normalizedLocale = typeof source_locale === 'string' && allowedLocales.has(source_locale) ? source_locale as CommunitySourceLocale : 'ko';
        const resolvedCategory = normalizedFormat ? getCommunityCategoryFromFormat(normalizedFormat) : category;
        const normalizedIsAnonymous = Boolean(is_anonymous) && anonymousAllowedCategories.has(resolvedCategory);

        // Validate Required Fields
        if (!category || !title || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

        // Insert new post into DB
        const insertPayload = createCommunityInsertPayload({
            userId: user.id,
            category: resolvedCategory,
            title,
            content,
            images: normalizedImages,
            isAnonymous: normalizedIsAnonymous,
            companionDate: companion_date || null,
            companionCity: normalizedCompanionCity || null,
            linkedExpId: linked_exp_id || null,
            destinationHub: normalizedHub,
            postFormat: normalizedFormat,
            sourceLocale: normalizedLocale,
        });

        const attemptInsert = async (payload: Record<string, unknown>) => supabase
            .from('community_posts')
            .insert(payload)
            .select('id')
            .single();

        let currentPayload: Record<string, unknown> = insertPayload;
        let { data, error } = await attemptInsert(currentPayload);

        if (error && isMissingCommunityModelColumnError(error)) {
            const {
                destination_hub: _ignoredDestinationHub,
                post_format: _ignoredPostFormat,
                source_locale: _ignoredSourceLocale,
                ...legacyCompatiblePayload
            } = currentPayload;
            currentPayload = legacyCompatiblePayload;
            const retryResult = await attemptInsert(currentPayload);
            data = retryResult.data;
            error = retryResult.error;
        }

        if (error && isMissingAnonymousColumnError(error)) {
            const { is_anonymous: _ignoredAnonymous, ...legacyPayload } = currentPayload;
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

        return NextResponse.json({ id: data?.id });
    } catch (err) {
        console.error('API Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
