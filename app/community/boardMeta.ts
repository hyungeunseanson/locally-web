import type { CommunityBoard, CommunityHub } from '@/app/types/community';

type CommunityBoardLocale = 'ko' | 'en' | 'ja' | 'zh';

export const COMMUNITY_BOARD_OPTIONS: CommunityBoard[] = ['japan', 'korea'];

const COMMUNITY_BOARD_LABELS: Record<CommunityBoardLocale, Record<CommunityBoard, string>> = {
  ko: {
    japan: '일본여행',
    korea: '한국여행',
  },
  en: {
    japan: 'Japan Travel',
    korea: 'Korea Travel',
  },
  ja: {
    japan: '日本旅行',
    korea: '韓国旅行',
  },
  zh: {
    japan: '日本旅行',
    korea: '韩国旅行',
  },
};

const COMMUNITY_BOARD_TITLES: Record<CommunityBoardLocale, string> = {
  ko: '여행 커뮤니티',
  en: 'Travel Community',
  ja: '旅行コミュニティ',
  zh: '旅行社区',
};

const LEGACY_HUB_SEED_BY_BOARD: Record<CommunityBoard, CommunityHub> = {
  japan: 'tokyo',
  korea: 'seoul',
};

const BOARD_BY_LEGACY_HUB_SEED: Partial<Record<CommunityHub, CommunityBoard>> = {
  tokyo: 'japan',
  seoul: 'korea',
};

export function resolveCommunityBoard(value: string | null | undefined): CommunityBoard {
  return value === 'korea' ? 'korea' : 'japan';
}

export function getCommunityBoardLabel(board: CommunityBoard, locale: CommunityBoardLocale): string {
  return COMMUNITY_BOARD_LABELS[locale]?.[board] ?? COMMUNITY_BOARD_LABELS.ko[board];
}

export function getCommunityBoardPageTitle(locale: CommunityBoardLocale): string {
  return COMMUNITY_BOARD_TITLES[locale] ?? COMMUNITY_BOARD_TITLES.ko;
}

export function getLegacyHubSeedForBoard(board: CommunityBoard): CommunityHub {
  return LEGACY_HUB_SEED_BY_BOARD[board];
}

export function inferCommunityBoardFromLegacyHub(value: unknown): CommunityBoard | null {
  if (typeof value !== 'string') return null;
  return BOARD_BY_LEGACY_HUB_SEED[value as CommunityHub] ?? null;
}

