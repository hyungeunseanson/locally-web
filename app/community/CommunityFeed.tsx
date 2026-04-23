'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquareDashed } from 'lucide-react';
import Link from 'next/link';

import type { CommunityBoard } from '@/app/types/community';
import { parseCommunityFeedResponse, type CommunityFeedPost } from './feedSelect';
import PostListCard from './components/PostListCard';

interface CommunityFeedProps {
  initialData: CommunityFeedPost[];
  initialNextOffset: number | null;
  board: CommunityBoard;
  sort: 'latest' | 'popular';
  canWrite: boolean;
}

function EmptyState({ board, canWrite }: { board: CommunityBoard; canWrite: boolean }) {
  const writeHref = `/community/write?board=${board}`;

  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
      <MessageSquareDashed className="mx-auto mb-4 h-12 w-12 text-gray-300" strokeWidth={1.5} />
      <p className="mb-1 text-[16px] font-semibold text-gray-500">아직 게시글이 없어요</p>
      <p className="mb-6 text-sm text-gray-400">첫 글의 주인공이 되어보세요.</p>
      {canWrite && (
        <Link
          href={writeHref}
          className="inline-flex rounded-full bg-[#111111] px-6 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.14)] transition-all hover:bg-black active:scale-95"
        >
          글 작성하기
        </Link>
      )}
    </div>
  );
}

export default function CommunityFeed({
  initialData,
  initialNextOffset,
  board,
  sort,
  canWrite,
}: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityFeedPost[]>(initialData);
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPosts(initialData);
    setNextOffset(initialNextOffset);
  }, [board, initialData, initialNextOffset, sort]);

  const loadMore = useCallback(async () => {
    if (isLoading || nextOffset === null) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (board !== 'japan') params.set('board', board);
      if (sort !== 'latest') params.set('sort', sort);
      params.set('offset', String(nextOffset));

      const response = await fetch(`/api/community?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || '커뮤니티 피드를 불러오지 못했습니다.');
      }

      const parsed = parseCommunityFeedResponse(payload);
      setPosts((prev) => {
        const prevIds = new Set(prev.map((post) => post.id));
        return [...prev, ...parsed.data.filter((post) => !prevIds.has(post.id))];
      });
      setNextOffset(parsed.nextOffset);
    } catch (error) {
      console.error('Failed to load more board posts', error);
    } finally {
      setIsLoading(false);
    }
  }, [board, isLoading, nextOffset, sort]);

  return (
    <div className="pb-24">
      {posts.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {posts.map((post) => (
            <PostListCard key={post.id} post={post} board={board} sort={sort} />
          ))}
        </div>
      ) : (
        <EmptyState board={board} canWrite={canWrite} />
      )}

      {nextOffset !== null && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            data-testid="community-load-more-button"
            onClick={loadMore}
            disabled={isLoading}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[13px] font-semibold text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            더보기
          </button>
        </div>
      )}
    </div>
  );
}
