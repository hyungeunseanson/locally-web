import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateFriendlyComment } from '@/app/utils/bot/ai';

// 봇 유저 UUID 리스트 (추후 Supabase profiles에서 봇 계정을 생성하고 UUID를 입력하세요)
// 현재는 봇 계정이 없어도 테스트 통과를 위해 임시로 admin 또는 봇용 서비스 계정이라고 가정
const BOT_UUIDS: string[] = [
    // 'YOUR-BOT-UUID-1',
    // 'YOUR-BOT-UUID-2'
];

export async function GET(request: Request) {
    // 1. 보안 검증: 크론 스케줄러(Github Actions)만 호출 가능하게 시크릿 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    // 서비스 역할 클라이언트 생성 (RLS 우회하여 자유롭게 시스템 권한 수행)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 2. 최근 24시간 내에 올라오고 아직 댓글이 없는 게시물 1개를 찾음 (Q&A 또는 Info)
        const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: latestPost, error: fetchError } = await supabase
            .from('community_posts')
            .select('id, title, content, user_id')
            .gte('created_at', ONE_DAY_AGO)
            .eq('comment_count', 0)
            .in('category', ['qna', 'info'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!latestPost) {
            return NextResponse.json({ message: 'No suitable posts found for commenting' });
        }

        // 3. 봇 계정 무작위 선택 (BOT_UUIDS 미설정 시 스킵)
        if (BOT_UUIDS.length === 0) {
            return NextResponse.json({ skipped: true, reason: 'No bot users configured' });
        }
        const botId = BOT_UUIDS[Math.floor(Math.random() * BOT_UUIDS.length)];

        // 4. Gemini API를 통해 댓글 생성
        const commentContent = await generateFriendlyComment(latestPost.content, latestPost.title);

        if (!commentContent) {
            return NextResponse.json({ message: 'AI decided not to comment (empty response)' });
        }

        // 5. 생성된 댓글 저장
        const { error: insertError } = await supabase
            .from('community_comments')
            .insert({
                post_id: latestPost.id,
                user_id: botId,
                content: commentContent
            });

        if (insertError) throw insertError;

        // 6. 게시물의 댓글 수 증가
        const { error: updateError } = await supabase.rpc('increment_comment_count', { row_id: latestPost.id });
        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            message: 'Auto comment created',
            postId: latestPost.id
        });

    } catch (error: any) {
        console.error('[Bot Auto-Comment Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
