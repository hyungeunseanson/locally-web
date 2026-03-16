import type { CommunityCategory, CommunityFilterCategory } from '@/app/types/community';

export type CommunityCategoryMeta = {
  label: string;
  shortLabel: string;
  tabLabel: string;
  searchLabel: string;
  badgeClassName: string;
  detailChipClassName: string;
  isContent: boolean;
};

export const COMMUNITY_CATEGORY_META: Record<CommunityCategory, CommunityCategoryMeta> = {
  qna: {
    label: 'Q&A',
    shortLabel: 'Q&A',
    tabLabel: '💡 Q&A',
    searchLabel: 'Q&A',
    badgeClassName: 'bg-amber-50 text-amber-700 border border-amber-200',
    detailChipClassName: 'bg-amber-50 text-amber-700 border border-amber-200',
    isContent: false,
  },
  companion: {
    label: '동행 찾기',
    shortLabel: '동행',
    tabLabel: '🤝 동행 찾기',
    searchLabel: '동행',
    badgeClassName: 'bg-sky-50 text-sky-700 border border-sky-200',
    detailChipClassName: 'bg-sky-50 text-sky-700 border border-sky-200',
    isContent: false,
  },
  info: {
    label: '현지 꿀팁',
    shortLabel: '꿀팁',
    tabLabel: '🗺️ 현지 꿀팁',
    searchLabel: '꿀팁',
    badgeClassName: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    detailChipClassName: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    isContent: false,
  },
  locally_content: {
    label: '로컬리 콘텐츠',
    shortLabel: '로컬리 콘텐츠',
    tabLabel: '✨ 로컬리 콘텐츠',
    searchLabel: '콘텐츠',
    badgeClassName: 'bg-neutral-950/90 text-white border border-neutral-900',
    detailChipClassName: 'bg-neutral-900 text-white border border-neutral-800',
    isContent: true,
  },
};

export const COMMUNITY_FILTER_CATEGORY_OPTIONS: Array<{
  id: CommunityFilterCategory;
  label: string;
}> = [
  { id: 'all', label: '전체보기' },
  { id: 'qna', label: COMMUNITY_CATEGORY_META.qna.searchLabel },
  { id: 'companion', label: COMMUNITY_CATEGORY_META.companion.searchLabel },
  { id: 'info', label: COMMUNITY_CATEGORY_META.info.searchLabel },
  { id: 'locally_content', label: COMMUNITY_CATEGORY_META.locally_content.searchLabel },
];

export const COMMUNITY_TAB_OPTIONS: Array<{
  id: CommunityFilterCategory;
  label: string;
}> = [
  { id: 'all', label: '전체보기' },
  { id: 'qna', label: COMMUNITY_CATEGORY_META.qna.tabLabel },
  { id: 'companion', label: COMMUNITY_CATEGORY_META.companion.tabLabel },
  { id: 'info', label: COMMUNITY_CATEGORY_META.info.tabLabel },
  { id: 'locally_content', label: COMMUNITY_CATEGORY_META.locally_content.tabLabel },
];

export function getCommunityCategoryMeta(category: CommunityCategory): CommunityCategoryMeta {
  return COMMUNITY_CATEGORY_META[category];
}

export function isLocallyContentCategory(
  category: CommunityCategory | CommunityFilterCategory | string | null | undefined
): boolean {
  return category === 'locally_content';
}
