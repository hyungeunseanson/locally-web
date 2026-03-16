import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import PostEditor from './PostEditor';
import { createClient } from '@/app/utils/supabase/server';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import type { CommunityCategory } from '@/app/types/community';

export const metadata: Metadata = {
    title: '글쓰기 - 커뮤니티 | Locally',
    description: '로컬리 커뮤니티에 새로운 게시글이나 질문, 동행 구하기 글을 작성합니다.',
    robots: { index: false, follow: false } // 글쓰기 페이지는 구글 검색에 노출될 필요 없음
};

export default async function WritePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const requestedCategory = params?.category as CommunityCategory | undefined;
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

    if (requestedCategory === 'locally_content' && !canWriteLocallyContent) {
        redirect('/community?category=locally_content');
    }

    const initialCategory: CommunityCategory = requestedCategory && ['qna', 'companion', 'info', 'locally_content'].includes(requestedCategory)
        ? requestedCategory
        : 'qna';

    return (
        <PostEditor
            initialCategory={initialCategory === 'locally_content' && !canWriteLocallyContent ? 'qna' : initialCategory}
            canWriteLocallyContent={canWriteLocallyContent}
        />
    );
}
