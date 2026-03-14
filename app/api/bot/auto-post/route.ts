import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAutoPost } from '@/app/utils/bot/ai';

const BOT_UUIDS: string[] = [
    // 'YOUR-BOT-UUID-1',
];

export async function GET(request: Request) {
    // 1. 보안 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 2. AI로 새 글 생성
        const postData = await generateAutoPost();

        // 3. 봇 작성자 결정 (지정 없으면 슈퍼 어드민 계정 등으로 대체해야 함. 
        // 서비스 활성화 전에는 UUID를 명시해야 정상 작동하며, 없으면 에러 로깅 후 종료)
        let botId;
        if (BOT_UUIDS.length > 0) {
            botId = BOT_UUIDS[Math.floor(Math.random() * BOT_UUIDS.length)];
        } else {
            return NextResponse.json({ skipped: true, reason: 'No bot users configured' });
        }

        // 4. 게시물 저장
        const { data: insertedPost, error: insertError } = await supabase
            .from('community_posts')
            .insert({
                user_id: botId,
                title: postData.title,
                content: postData.content,
                category: postData.category || 'info',
                images: [], // 봇은 당분간 텍스트 전용
                view_count: Math.floor(Math.random() * 50) + 12 // 적당히 초기 조회수 주입 (선택사항)
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            message: 'Auto post created',
            postId: insertedPost.id
        });

    } catch (error: any) {
        console.error('[Bot Auto-Post Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
