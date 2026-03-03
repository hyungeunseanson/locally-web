import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = profile?.role === 'admin';

        let query = supabase
            .from('proxy_requests')
            .select('*, profiles(name, email, avatar_url)')
            .eq('id', id);

        if (!isAdmin) {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
        }

        // Fetch comments
        const { data: comments, error: commentsError } = await supabase
            .from('proxy_comments')
            .select('*, profiles(name, avatar_url)')
            .eq('request_id', id)
            .order('created_at', { ascending: true });

        if (commentsError) {
            console.error('Proxy Comments Fetch Error:', commentsError);
        }

        return NextResponse.json({
            success: true,
            data: {
                ...data,
                comments: comments ?? [],
            },
        });
    } catch (error: any) {
        console.error('API Proxy Request Detail GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = profile?.role === 'admin';
        const body = await request.json();
        const { status, payment_status } = body;

        let query = supabase.from('proxy_requests').update({});
        let updates: Record<string, any> = {};

        if (isAdmin) {
            if (status) updates.status = status;
            if (payment_status) updates.payment_status = payment_status;
        } else {
            // User can only cancel their request
            if (status === 'CANCELLED') updates.status = 'CANCELLED';
        }

        if (Object.keys(updates).length > 0) {
            query = supabase.from('proxy_requests').update(updates).eq('id', id);
            if (!isAdmin) {
                query = query.eq('user_id', user.id);
            }

            const { error: updateError } = await query;
            if (updateError) {
                throw updateError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Proxy Request PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
