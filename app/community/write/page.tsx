import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import PostEditor from './PostEditor';
import { createClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { getCurrentLocale } from '@/app/utils/locale';
import type { CommunityCategory } from '@/app/types/community';
import { COMMUNITY_OPEN, getCommunityCategoryFromFormat } from '../categoryMeta';
import { resolveCommunityCategory, resolveCommunityFormat, resolveCommunityHub } from '../queryParams';

export const metadata: Metadata = {
    title: COMMUNITY_OPEN ? '글쓰기 - 커뮤니티 | Locally' : '로컬리 콘텐츠 작성 | Locally',
    description: COMMUNITY_OPEN
        ? '로컬리 커뮤니티에 새로운 게시글이나 질문, 동행 구하기 글을 작성합니다.'
        : '관리자용 로컬리 콘텐츠 발행면입니다. 검색 노출용 콘텐츠를 작성하고 점검할 수 있습니다.',
    robots: { index: false, follow: false } // 글쓰기 페이지는 구글 검색에 노출될 필요 없음
};

export default async function WritePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const locale = await getCurrentLocale();
    const requestedCategory = resolveCommunityCategory(params?.category as string);
    const requestedFormat = resolveCommunityFormat(params?.format as string, requestedCategory);
    const requestedHub = resolveCommunityHub(params?.hub as string);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let canWriteLocallyContent = false;
    if (user) {
        const adminAccess = await resolveAdminAccess(supabase, {
            userId: user.id,
            email: user.email,
        });
        canWriteLocallyContent = adminAccess.isAdmin;
    }

    if (!COMMUNITY_OPEN && !canWriteLocallyContent) {
        redirect('/community?format=locally_pick');
    }

    const initialFormat = !COMMUNITY_OPEN
        ? 'locally_pick'
        : requestedFormat === 'all'
            ? (requestedCategory === 'all' ? 'question' : requestedCategory === 'companion' ? 'companion' : requestedCategory === 'info' ? 'live_tip' : requestedCategory === 'locally_content' ? 'locally_pick' : 'question')
            : requestedFormat;
    const initialCategory: CommunityCategory = !COMMUNITY_OPEN
        ? 'locally_content'
        : getCommunityCategoryFromFormat(initialFormat);

    if (initialCategory === 'locally_content' && !canWriteLocallyContent) {
        redirect('/community?format=locally_pick');
    }

    return (
        <PostEditor
            initialCategory={initialCategory === 'locally_content' && !canWriteLocallyContent ? 'qna' : initialCategory}
            initialFormat={initialCategory === 'locally_content' && !canWriteLocallyContent ? 'question' : initialFormat}
            initialHub={requestedHub === 'all' ? null : requestedHub}
            initialLocale={locale}
            canWriteLocallyContent={canWriteLocallyContent}
        />
    );
}
