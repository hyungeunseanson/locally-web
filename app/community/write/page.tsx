import React from 'react';
import { Metadata } from 'next';
import PostEditor from './PostEditor';

export const metadata: Metadata = {
    title: '글쓰기 - 커뮤니티 | Locally',
    description: '로컬리 커뮤니티에 새로운 게시글이나 질문, 동행 구하기 글을 작성합니다.',
    robots: { index: false, follow: false } // 글쓰기 페이지는 구글 검색에 노출될 필요 없음
};

export default function WritePage() {
    return (
        <PostEditor />
    );
}
