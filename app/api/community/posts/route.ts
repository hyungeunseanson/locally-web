import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

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

        return NextResponse.json({ id: data.id });
    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
