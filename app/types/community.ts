import { Profile, Experience } from './index';

export type CommunityCategory = 'qna' | 'companion' | 'info' | 'locally_content';
export type CommunityFilterCategory = CommunityCategory | 'all';
export type CommunityPostFormat = 'question' | 'companion' | 'live_tip' | 'locally_pick';
export type CommunityPostFormatFilter = CommunityPostFormat | 'all';
export type CommunityHub = 'tokyo' | 'osaka_kyoto' | 'fukuoka' | 'jp_other' | 'seoul' | 'busan' | 'jeju';
export type CommunityHubFilter = CommunityHub | 'all';
export type CommunitySourceLocale = 'ko' | 'ja' | 'en' | 'zh';

export interface CommunityPost {
    id: string;
    user_id: string;
    category: CommunityCategory;
    post_format: CommunityPostFormat;
    destination_hub: CommunityHub | null;
    source_locale: CommunitySourceLocale;
    title: string;
    content: string;
    images: string[];
    is_anonymous: boolean;

    // 동행 전용
    companion_date?: string;
    companion_city?: string;

    // 연동 
    linked_exp_id?: number | null;
    linked_experience?: Experience; // JOIN Data

    // 통계
    view_count: number;
    like_count: number;
    comment_count: number;

    created_at: string;
    updated_at: string;

    // 프로필 조인 데이터
    profiles?: Profile;
}

export interface CommunityComment {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;

    // 프로필 조인 데이터
    profiles?: Profile;
}

export interface CommunityLike {
    id: string;
    post_id: string;
    user_id: string;
    created_at: string;
}
