import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

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

        // Check Authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { category, title, content, images, image_paths, companion_date, companion_city, linked_exp_id } = body;
        const normalizedImages = Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string' && image.length > 0) : [];
        const normalizedImagePaths = Array.isArray(image_paths) ? image_paths.filter((imagePath): imagePath is string => typeof imagePath === 'string' && imagePath.length > 0) : [];
        const normalizedCompanionCity = typeof companion_city === 'string' ? companion_city.trim() : '';

        // Validate Required Fields
        if (!category || !title || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (!allowedCategories.has(category)) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }
        if (category === 'companion' && (!companion_date || !normalizedCompanionCity)) {
            return NextResponse.json({ error: 'Companion posts require date and city' }, { status: 400 });
        }

        // Insert new post into DB
        const { data, error } = await supabase
            .from('community_posts')
            .insert({
                user_id: user.id,
                category,
                title,
                content,
                images: normalizedImages,
                companion_date: companion_date || null,
                companion_city: normalizedCompanionCity || null,
                linked_exp_id: linked_exp_id || null
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error inserting community post:', error);
            await cleanupUploadedImages(normalizedImagePaths);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ✅ 핵심: 글 등록 후 /community 라우터 캐시 무효화
        // 이 호출이 없으면 피드로 돌아가도 Next.js가 구 버전 캐시를 서빙함
        revalidatePath('/community');

        return NextResponse.json({ id: data.id });
    } catch (err) {
        console.error('API Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
