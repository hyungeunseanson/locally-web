import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Edit3 } from 'lucide-react';

import { createClient } from '@/app/utils/supabase/server';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import SiteHeader from '@/app/components/SiteHeader';
import type { CommunityBoard } from '@/app/types/community';
import CommunityFeed from './CommunityFeed';
import CommunityAdSlot from './components/CommunityAdSlot';
import CommunityBoardTabs from './components/CommunityBoardTabs';
import MobileSortBar from './components/MobileSortBar';
import { getCommunityBoardLabel, getCommunityBoardPageTitle, getLegacyHubSeedForBoard } from './boardMeta';
import {
  buildCommunityFeedPosts,
  COMMUNITY_FEED_EXPERIENCE_SELECT,
  COMMUNITY_FEED_POST_SELECT,
  COMMUNITY_FEED_POST_SELECT_LEGACY,
  COMMUNITY_FEED_POST_SELECT_PRE_BOARD,
  COMMUNITY_FEED_PROFILE_SELECT,
  normalizeCommunityFeedPostRow,
  type CommunityFeedExperience,
  type CommunityFeedPostRow,
  type CommunityFeedProfile,
} from './feedSelect';
import {
  isMissingAnonymousColumnError,
  isMissingCommunityBoardColumnError,
  isMissingCommunityModelColumnError,
} from './anonymousColumn';
import { resolvePublicCommunityBoardState, type CommunitySort } from './queryParams';

const PAGE_LIMIT = 15;

type SearchParamMap = { [key: string]: string | string[] | undefined };

export const dynamic = 'force-dynamic';

function buildBoardCanonicalPath(board: CommunityBoard) {
  return board === 'japan' ? '/community' : `/community?board=${board}`;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParamMap> }): Promise<Metadata> {
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const { board } = resolvePublicCommunityBoardState({
    board: params?.board as string,
    sort: params?.sort as string,
  });
  const boardLabel = getCommunityBoardLabel(board, locale);
  const title = `${boardLabel} | ${getCommunityBoardPageTitle(locale)} | Locally`;
  const description = `${boardLabel} 정보를 나누는 Locally 커뮤니티 게시판입니다.`;
  const canonicalPath = buildBoardCanonicalPath(board);
  const canonicalUrl = buildLocalizedAbsoluteUrl(locale, canonicalPath);

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
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', canonicalPath),
        en: buildLocalizedAbsoluteUrl('en', canonicalPath),
        ja: buildLocalizedAbsoluteUrl('ja', canonicalPath),
        zh: buildLocalizedAbsoluteUrl('zh', canonicalPath),
      },
    },
  };
}

async function fetchBoardPosts({
  supabase,
  board,
  sort,
  offset = 0,
  limit = PAGE_LIMIT,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  board: CommunityBoard;
  sort: CommunitySort;
  offset?: number;
  limit?: number;
}) {
  const buildQuery = (selectClause: string, useLegacyBoardFallback = false) => {
    let query = supabase
      .from('community_posts')
      .select(selectClause)
      .range(offset, offset + limit - 1);

    if (useLegacyBoardFallback) {
      query = query
        .eq('category', 'qna')
        .eq('destination_hub', getLegacyHubSeedForBoard(board));
    } else {
      query = query.eq('board_country', board);
    }

    if (sort === 'popular') {
      query = query
        .order('like_count', { ascending: false })
        .order('comment_count', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    return query;
  };

  const initialResult = await buildQuery(COMMUNITY_FEED_POST_SELECT);
  let postsError = initialResult.error;
  let postsData = (initialResult.data ?? null) as unknown as CommunityFeedPostRow[] | null;

  if (postsError && isMissingCommunityBoardColumnError(postsError)) {
    const preBoardResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_PRE_BOARD, true);
    postsError = preBoardResult.error;
    postsData = (preBoardResult.data ?? null) as unknown as CommunityFeedPostRow[] | null;
  }

  if (postsError && (isMissingAnonymousColumnError(postsError) || isMissingCommunityModelColumnError(postsError))) {
    const legacyResult = await buildQuery(COMMUNITY_FEED_POST_SELECT_LEGACY, true);
    postsError = legacyResult.error;
    postsData = ((legacyResult.data ?? []) as unknown as CommunityFeedPostRow[]).map((post) =>
      normalizeCommunityFeedPostRow({
        ...post,
        is_anonymous: false,
      })
    );
  }

  if (postsError) {
    console.error('[CommunityPage] feed query failed:', postsError);
    return { data: [], nextOffset: null };
  }

  const typedPosts = (postsData ?? []).map((post) => normalizeCommunityFeedPostRow(post));
  if (typedPosts.length === 0) {
    return { data: [], nextOffset: null };
  }

  const userIds = [...new Set(typedPosts.filter((post) => !post.is_anonymous).map((post) => post.user_id))];
  let typedProfiles: CommunityFeedProfile[] = [];
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(COMMUNITY_FEED_PROFILE_SELECT)
      .in('id', userIds);
    typedProfiles = (profiles ?? []) as CommunityFeedProfile[];
  }

  const expIds = [...new Set(typedPosts.map((post) => post.linked_exp_id).filter((value): value is number => typeof value === 'number'))];
  let typedExperiences: CommunityFeedExperience[] = [];
  if (expIds.length > 0) {
    const { data: experiences } = await supabase
      .from('experiences')
      .select(COMMUNITY_FEED_EXPERIENCE_SELECT)
      .in('id', expIds);
    typedExperiences = (experiences ?? []) as CommunityFeedExperience[];
  }

  return {
    data: buildCommunityFeedPosts(typedPosts, typedProfiles, typedExperiences),
    nextOffset: typedPosts.length === limit ? offset + limit : null,
  };
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<SearchParamMap> }) {
  const supabase = await createClient();
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const { data: { user } } = await supabase.auth.getUser();
  const { board, sort } = resolvePublicCommunityBoardState({
    board: params?.board as string,
    sort: params?.sort as string,
  });
  const boardLabel = getCommunityBoardLabel(board, locale);
  const { data: initialData, nextOffset: initialNextOffset } = await fetchBoardPosts({
    supabase,
    board,
    sort,
  });
  const canWrite = Boolean(user);
  const writeHref = `/community/write?board=${board}`;

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[#F7F7F9]">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-4 rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Community</p>
            <h1 className="mt-2 text-[22px] font-black text-slate-900 md:text-[28px]">{boardLabel}</h1>
            <p className="mt-2 text-[13px] leading-6 text-slate-500 md:text-[14px]">
              여행자들이 정보를 나누고 질문을 남기는 단순 게시판입니다.
            </p>
          </div>

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
            {canWrite ? (
              <Link
                href={writeHref}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-[13px] font-semibold text-white transition-all hover:bg-black"
              >
                글쓰기
              </Link>
            ) : <div />}
          </div>

          <MobileSortBar currentBoard={board} currentSort={sort} />

          <CommunityFeed
            initialData={initialData}
            initialNextOffset={initialNextOffset}
            board={board}
            sort={sort}
            canWrite={canWrite}
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

      {canWrite && (
        <Link
          href={writeHref}
          className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition-all hover:bg-black active:scale-95 md:hidden"
          aria-label="글쓰기"
        >
          <Edit3 size={20} strokeWidth={2.5} />
        </Link>
      )}
    </>
  );
}
