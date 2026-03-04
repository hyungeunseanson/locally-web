import { Profile, Experience } from './index';

export type CommunityCategory = 'qna' | 'companion' | 'info' | 'locally_content';

export interface CommunityPost {
    id: string;
    user_id: string;
    category: CommunityCategory;
    title: string;
    content: string;
    images: string[];

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
    is_selected: boolean;
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
