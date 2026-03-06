import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const allowedCategories = new Set(['qna', 'companion', 'info']);

        // Check Authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { category, title, content, images, companion_date, companion_city, linked_exp_id } = body;

        // Validate Required Fields
        if (!category || !title || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (!allowedCategories.has(category)) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        // Insert new post into DB
        const { data, error } = await supabase
            .from('community_posts')
            .insert({
                user_id: user.id,
                category,
                title,
                content,
                images: images || [],
                companion_date: companion_date || null,
                companion_city: companion_city || null,
                linked_exp_id: linked_exp_id || null
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error inserting community post:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ✅ 핵심: 글 등록 후 /community 라우터 캐시 무효화
        // 이 호출이 없으면 피드로 돌아가도 Next.js가 구 버전 캐시를 서빙함
        revalidatePath('/community');

        return NextResponse.json({ id: data.id });
    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
