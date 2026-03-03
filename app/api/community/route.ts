import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const limit = 15;

        let query = supabase
            .from('community_posts')
            .select(`
        *,
        profiles(name, avatar_url),
        linked_experience:experiences(id, title, image_url, price)
      `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
            console.error('API Error fetching community posts:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let nextOffset = null;
        if (data && data.length === limit) {
            nextOffset = offset + limit;
        }

        return NextResponse.json({ data, nextOffset });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
