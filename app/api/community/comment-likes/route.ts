import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    void request;
    return NextResponse.json(
        { error: '댓글 좋아요 기능이 종료되었습니다.' },
        { status: 410 }
    );
}
