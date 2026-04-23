'use client';

import { useLanguage } from '@/app/context/LanguageContext';
import type { CommunityBoard } from '@/app/types/community';
import { getCommunityBoardLabel } from '../boardMeta';

const COMMUNITY_PAGE_DESCRIPTIONS = {
  ko: '여행자들이 정보를 나누고 질문을 남기는 단순 게시판입니다.',
  en: 'A simple board where travelers share tips and leave questions.',
  ja: '旅行者同士で情報を共有し、質問を残せるシンプルな掲示板です。',
  zh: '这是一个供旅行者分享信息和提出问题的简洁社区看板。',
} as const;

interface CommunityPageHeroProps {
  board: CommunityBoard;
}

export default function CommunityPageHero({ board }: CommunityPageHeroProps) {
  const { lang } = useLanguage();
  const locale = lang || 'ko';
  const boardLabel = getCommunityBoardLabel(board, locale);

  return (
    <div className="mb-4 rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm md:px-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Community</p>
      <h1 className="mt-2 text-[22px] font-black text-slate-900 md:text-[28px]">{boardLabel}</h1>
      <p className="mt-2 text-[13px] leading-6 text-slate-500 md:text-[14px]">
        {COMMUNITY_PAGE_DESCRIPTIONS[locale]}
      </p>
    </div>
  );
}
