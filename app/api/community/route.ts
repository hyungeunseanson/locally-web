import { NextRequest, NextResponse } from 'next/server';

import { resolveCommunityBoard } from '@/app/community/boardMeta';
import {
    resolveCommunitySort,
} from '@/app/community/queryParams';
import { fetchCommunityBoardFeed } from '@/app/community/boardFeed.server';
import { fetchLegacyCommunityFeed } from '@/app/community/legacyFeed.server';

const PAGE_LIMIT = 15;

async function handleBoardFeed(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const board = resolveCommunityBoard(searchParams.get('board'));
    const sort = resolveCommunitySort(searchParams.get('sort'));
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    try {
        const payload = await fetchCommunityBoardFeed({
            board,
            sort,
            offset,
            limit: PAGE_LIMIT,
        });
        return NextResponse.json(payload);
    } catch (postsError) {
        console.error('API Error fetching board community posts:', postsError);
        return NextResponse.json(
            { error: postsError instanceof Error ? postsError.message : 'Failed to load community feed' },
            { status: 500 }
        );
    }
}

async function handleLegacyFeed(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    try {
        const payload = await fetchLegacyCommunityFeed({
            category: searchParams.get('category'),
            format: searchParams.get('format'),
            hub: searchParams.get('hub'),
            q: searchParams.get('q'),
            sort: searchParams.get('sort'),
            offset,
            limit: PAGE_LIMIT,
        });
        return NextResponse.json(payload);
    } catch (postsError) {
        console.error('API Error fetching legacy community posts:', postsError);
        return NextResponse.json(
            { error: postsError instanceof Error ? postsError.message : 'Failed to load community feed' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const hasLegacyParams = ['category', 'format', 'hub', 'q'].some((key) => searchParams.has(key));

        if (!hasLegacyParams) {
            return handleBoardFeed(request);
        }

        return handleLegacyFeed(request);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
