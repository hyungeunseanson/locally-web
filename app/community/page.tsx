import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import SiteHeader from '@/app/components/SiteHeader';
import type { CommunityBoard } from '@/app/types/community';
import CommunityFeed from './CommunityFeed';
import CommunityAdSlot from './components/CommunityAdSlot';
import CommunityBoardTabs from './components/CommunityBoardTabs';
import MobileSortBar from './components/MobileSortBar';
import { getCommunityBoardLabel, getCommunityBoardPageTitle } from './boardMeta';
import type { CommunityFeedPost } from './feedSelect';
import { resolvePublicCommunityBoardState } from './queryParams';
import { fetchCommunityBoardFeed } from './boardFeed.server';
import CommunityWriteCta from './components/CommunityWriteCta';
import CommunityPageHero from './components/CommunityPageHero';

type SearchParamMap = { [key: string]: string | string[] | undefined };

export const revalidate = 60;

function buildBoardCanonicalPath(board: CommunityBoard) {
  return board === 'japan' ? '/community' : `/community?board=${board}`;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParamMap> }): Promise<Metadata> {
  const params = await searchParams;
  const { board } = resolvePublicCommunityBoardState({
    board: params?.board as string,
    sort: params?.sort as string,
  });
  const boardLabel = getCommunityBoardLabel(board, 'ko');
  const title = `${boardLabel} | ${getCommunityBoardPageTitle('ko')}`;
  const description = `${boardLabel} 정보를 나누는 Locally 커뮤니티 게시판입니다.`;
  const canonicalPath = buildBoardCanonicalPath(board);
  const canonicalUrl = buildAbsoluteUrl(canonicalPath);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<SearchParamMap> }) {
  const params = await searchParams;
  const { board, sort } = resolvePublicCommunityBoardState({
    board: params?.board as string,
    sort: params?.sort as string,
  });
  let initialData: CommunityFeedPost[] = [];
  let initialNextOffset: number | null = null;

  try {
    const feed = await fetchCommunityBoardFeed({ board, sort });
    initialData = feed.data;
    initialNextOffset = feed.nextOffset;
  } catch (error) {
    console.error('[CommunityPage] feed query failed:', error);
  }

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[#F7F7F9]">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <CommunityPageHero board={board} />

          <div className="mb-4">
            <CommunityBoardTabs />
          </div>

          <div className="mb-4 hidden md:flex items-center justify-between gap-3">
            <div />
            <div className="grid grid-cols-2 gap-2 rounded-full border border-[#E7E7E7] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {[
                { id: 'latest' as const, label: '최신순' },
                { id: 'popular' as const, label: '인기순' },
              ].map((item) => {
                const href = item.id === 'latest'
                  ? (board === 'japan' ? '/community' : `/community?board=${board}`)
                  : `${board === 'japan' ? '/community' : `/community?board=${board}`}${board === 'japan' ? '?' : '&'}sort=popular`;

                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={`flex h-10 min-w-[88px] items-center justify-center rounded-full px-4 text-[13px] font-semibold transition-all ${
                      sort === item.id
                        ? 'bg-[#111111] text-white shadow-[0_8px_16px_rgba(15,23,42,0.14)]'
                        : 'text-[#4B4B4B]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <CommunityWriteCta board={board} variant="desktop" />
          </div>

          <MobileSortBar currentBoard={board} currentSort={sort} />

          <CommunityFeed
            initialData={initialData}
            initialNextOffset={initialNextOffset}
            board={board}
            sort={sort}
          />

          <div className="mt-6">
            <CommunityAdSlot
              testId="community-list-bottom-ad"
              variant="bottom"
              placement="community-list-bottom"
              title="로컬리 커뮤니티 광고"
            />
          </div>
        </div>
      </div>

      <CommunityWriteCta board={board} variant="mobile" />
    </>
  );
}
