import type {
  CommunityCategory,
  CommunityFilterCategory,
  CommunityPostFormat,
  CommunityPostFormatFilter,
} from '@/app/types/community';

export type CommunityCategoryMeta = {
  label: string;
  shortLabel: string;
  tabLabel: string;
  searchLabel: string;
  badgeClassName: string;
  detailChipClassName: string;
  isContent: boolean;
};

export type CommunityFormatMeta = {
  id: CommunityPostFormat;
  label: string;
  shortLabel: string;
  tabLabel: string;
  helperTitle: string;
  helperDescription: string;
  templateTitlePlaceholder: string;
  templateBodyPlaceholder: string;
};

export const COMMUNITY_CATEGORY_META: Record<CommunityCategory, CommunityCategoryMeta> = {
  qna: {
    label: '질문',
    shortLabel: '질문',
    tabLabel: '질문',
    searchLabel: '질문',
    badgeClassName: 'bg-amber-50 text-amber-700 border border-amber-200',
    detailChipClassName: 'bg-amber-50 text-amber-700 border border-amber-200',
    isContent: false,
  },
  companion: {
    label: '동행',
    shortLabel: '동행',
    tabLabel: '동행',
    searchLabel: '동행',
    badgeClassName: 'bg-sky-50 text-sky-700 border border-sky-200',
    detailChipClassName: 'bg-sky-50 text-sky-700 border border-sky-200',
    isContent: false,
  },
  info: {
    label: '여행 꿀팁',
    shortLabel: '꿀팁',
    tabLabel: '여행 꿀팁',
    searchLabel: '여행 꿀팁',
    badgeClassName: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    detailChipClassName: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    isContent: false,
  },
  locally_content: {
    label: '로컬리 콘텐츠',
    shortLabel: '로컬리 콘텐츠',
    tabLabel: '로컬리 콘텐츠',
    searchLabel: '로컬리 콘텐츠',
    badgeClassName: 'bg-neutral-950/90 text-white border border-neutral-900',
    detailChipClassName: 'bg-neutral-900 text-white border border-neutral-800',
    isContent: true,
  },
};

export const COMMUNITY_FORMAT_META: Record<CommunityPostFormat, CommunityFormatMeta> = {
  question: {
    id: 'question',
    label: '질문',
    shortLabel: '질문',
    tabLabel: '질문',
    helperTitle: '여행 전 고민을 짧고 선명하게 적어보세요.',
    helperDescription: '언제 가는지, 누구와 가는지, 예산, 제일 헷갈리는 포인트를 적으면 답변이 빨라집니다.',
    templateTitlePlaceholder: '도쿄 2박 3일 첫 여행인데 숙소를 어디로 잡는 게 좋을까요?',
    templateBodyPlaceholder: '언제 가는지\n누구와 가는지\n예산\n가장 고민되는 포인트',
  },
  companion: {
    id: 'companion',
    label: '동행',
    shortLabel: '동행',
    tabLabel: '동행',
    helperTitle: '날짜와 도시를 먼저 적어야 바로 연결됩니다.',
    helperDescription: '인원, 일정, 원하는 분위기를 같이 적으면 맞는 사람을 찾기 쉬워집니다.',
    templateTitlePlaceholder: '오사카·교토 4월 12일 저녁 같이 맛집 돌 분 계실까요?',
    templateBodyPlaceholder: '인원\n대략 일정\n원하는 분위기\n간단한 자기소개',
  },
  live_tip: {
    id: 'live_tip',
    label: '여행 꿀팁',
    shortLabel: '여행 꿀팁',
    tabLabel: '여행 꿀팁',
    helperTitle: '오늘 현지에서 본 정보를 짧게 남겨주세요.',
    helperDescription: '언제, 어디, 무슨 상황인지 명확히 적으면 저장 가치가 높은 글이 됩니다.',
    templateTitlePlaceholder: '후쿠오카 공항 입국 줄 지금 40분 정도 걸립니다',
    templateBodyPlaceholder: '언제\n어디\n무슨 상황인지\n참고하면 좋은 한 줄',
  },
  locally_pick: {
    id: 'locally_pick',
    label: '로컬리 콘텐츠',
    shortLabel: '로컬리 콘텐츠',
    tabLabel: '로컬리 콘텐츠',
    helperTitle: '운영팀이나 로컬이 저장해둘 만한 정리 글을 올리는 공간입니다.',
    helperDescription: '스크랩 가치가 높은 루트, 지역 추천, 요약형 콘텐츠를 올리는 용도입니다.',
    templateTitlePlaceholder: '도쿄 첫 여행 저장용 동선 정리',
    templateBodyPlaceholder: '핵심 포인트\n추천 동선\n꼭 체크할 것\n현지 팁',
  },
};

export const COMMUNITY_FILTER_CATEGORY_OPTIONS: Array<{
  id: CommunityFilterCategory;
  label: string;
}> = [
  { id: 'all', label: '전체 보기' },
  { id: 'qna', label: COMMUNITY_CATEGORY_META.qna.searchLabel },
  { id: 'companion', label: COMMUNITY_CATEGORY_META.companion.searchLabel },
  { id: 'info', label: COMMUNITY_CATEGORY_META.info.searchLabel },
  { id: 'locally_content', label: COMMUNITY_CATEGORY_META.locally_content.searchLabel },
];

export const COMMUNITY_FORMAT_FILTER_OPTIONS: Array<{
  id: CommunityPostFormatFilter;
  label: string;
}> = [
  { id: 'all', label: '전체' },
  { id: 'question', label: COMMUNITY_FORMAT_META.question.tabLabel },
  { id: 'companion', label: COMMUNITY_FORMAT_META.companion.tabLabel },
  { id: 'live_tip', label: COMMUNITY_FORMAT_META.live_tip.tabLabel },
  { id: 'locally_pick', label: COMMUNITY_FORMAT_META.locally_pick.tabLabel },
];

export function getCommunityCategoryMeta(category: CommunityCategory): CommunityCategoryMeta {
  return COMMUNITY_CATEGORY_META[category];
}

export function getCommunityFormatMeta(format: CommunityPostFormat): CommunityFormatMeta {
  return COMMUNITY_FORMAT_META[format];
}

export function getCommunityFormatFromCategory(category: CommunityCategory): CommunityPostFormat {
  switch (category) {
    case 'companion':
      return 'companion';
    case 'info':
      return 'live_tip';
    case 'locally_content':
      return 'locally_pick';
    case 'qna':
    default:
      return 'question';
  }
}

export function getCommunityCategoryFromFormat(format: CommunityPostFormat): CommunityCategory {
  switch (format) {
    case 'companion':
      return 'companion';
    case 'live_tip':
      return 'info';
    case 'locally_pick':
      return 'locally_content';
    case 'question':
    default:
      return 'qna';
  }
}

export function isLocallyContentCategory(
  category: CommunityCategory | CommunityFilterCategory | string | null | undefined
): boolean {
  return category === 'locally_content';
}

export function isLocallyPickFormat(format: CommunityPostFormat | CommunityPostFormatFilter | string | null | undefined): boolean {
  return format === 'locally_pick';
}
