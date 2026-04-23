'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { useLanguage } from '@/app/context/LanguageContext';
import { COMMUNITY_BOARD_OPTIONS, resolveCommunityBoard } from '../boardMeta';
import { buildCommunityBoardListHref, resolveCommunitySort } from '../queryParams';
import { usePendingNavigation } from '../hooks/usePendingNavigation';

export default function CommunityBoardTabs() {
  const searchParams = useSearchParams();
  const currentBoard = resolveCommunityBoard(searchParams.get('board'));
  const currentSort = resolveCommunitySort(searchParams.get('sort'));
  const { t } = useLanguage();
  const { navigate, pendingHref } = usePendingNavigation();

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      {COMMUNITY_BOARD_OPTIONS.map((board) => {
        const href = buildCommunityBoardListHref({ board, sort: currentSort });
        const isNavigating = pendingHref === href;
        const isActive = currentBoard === board;
        const label = board === 'japan' ? t('community_board_japan') : t('community_board_korea');

        return (
          <button
            key={board}
            type="button"
            data-testid={`community-board-tab-${board}`}
            onClick={() => navigate(href)}
            disabled={isNavigating}
            aria-busy={isNavigating}
            className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl border px-4 py-2 text-[13px] font-semibold transition-all md:px-5 md:py-3 md:text-[15px] ${
              isActive
                ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)]'
                : 'border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:text-slate-900'
            } ${isNavigating ? 'cursor-progress scale-[0.98] opacity-80' : 'active:scale-[0.98]'} disabled:pointer-events-none`}
          >
            {isNavigating && <Loader2 size={13} className="animate-spin" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

