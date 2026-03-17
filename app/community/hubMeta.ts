import type { CommunityHub, CommunityHubFilter } from '@/app/types/community';

export type CommunityHubMeta = {
  id: CommunityHub;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  accentClassName: string;
};

export const COMMUNITY_HUB_META: Record<CommunityHub, CommunityHubMeta> = {
  tokyo: {
    id: 'tokyo',
    label: '도쿄',
    shortLabel: '도쿄',
    eyebrow: 'TOKYO',
    description: '첫 일본 여행 질문이 가장 많이 모이는 허브',
    accentClassName: 'from-rose-100 via-white to-amber-50 border-rose-200',
  },
  osaka_kyoto: {
    id: 'osaka_kyoto',
    label: '오사카·교토',
    shortLabel: '오사카·교토',
    eyebrow: 'OSAKA · KYOTO',
    description: '동선과 맛집, 당일치기 고민이 가장 많은 허브',
    accentClassName: 'from-orange-100 via-white to-amber-50 border-orange-200',
  },
  fukuoka: {
    id: 'fukuoka',
    label: '후쿠오카',
    shortLabel: '후쿠오카',
    eyebrow: 'FUKUOKA',
    description: '혼행, 근교, 주말 동행 수요가 빠르게 도는 허브',
    accentClassName: 'from-emerald-100 via-white to-lime-50 border-emerald-200',
  },
  jp_other: {
    id: 'jp_other',
    label: '일본 소도시',
    shortLabel: '일본 소도시',
    eyebrow: 'SMALL CITY',
    description: '소도시 일정, 렌터카, 숨은 지역 팁이 모이는 허브',
    accentClassName: 'from-sky-100 via-white to-cyan-50 border-sky-200',
  },
  seoul: {
    id: 'seoul',
    label: '서울',
    shortLabel: '서울',
    eyebrow: 'SEOUL',
    description: '방한 여행자와 로컬이 만나는 도시 허브',
    accentClassName: 'from-violet-100 via-white to-fuchsia-50 border-violet-200',
  },
  busan: {
    id: 'busan',
    label: '부산',
    shortLabel: '부산',
    eyebrow: 'BUSAN',
    description: '바다, 카페, 당일 이동 팁이 강한 허브',
    accentClassName: 'from-cyan-100 via-white to-blue-50 border-cyan-200',
  },
  jeju: {
    id: 'jeju',
    label: '제주',
    shortLabel: '제주',
    eyebrow: 'JEJU',
    description: '드라이브, 자연, 일정 압축형 정보가 모이는 허브',
    accentClassName: 'from-lime-100 via-white to-emerald-50 border-lime-200',
  },
};

export const COMMUNITY_HUB_OPTIONS: CommunityHub[] = [
  'tokyo',
  'osaka_kyoto',
  'fukuoka',
  'jp_other',
  'seoul',
  'busan',
  'jeju',
];

export const COMMUNITY_HUB_FILTER_OPTIONS: Array<{
  id: CommunityHubFilter;
  label: string;
}> = [
  { id: 'all', label: '전체 허브' },
  ...COMMUNITY_HUB_OPTIONS.map((id) => ({
    id,
    label: COMMUNITY_HUB_META[id].label,
  })),
];

export function getCommunityHubMeta(hub: CommunityHub): CommunityHubMeta {
  return COMMUNITY_HUB_META[hub];
}
