'use client';

import React, { useState } from 'react';

import CommentSection from './CommentSection';
import LikeButton from './LikeButton';

interface CommunityCommentsPanelProps {
    postId: string;
    viewCount: number;
    initialLikeCount: number;
    initialLiked: boolean;
    initialCommentCount: number;
    onOpenLogin?: () => void;
}

export default function CommunityCommentsPanel({
    postId,
    viewCount,
    initialLikeCount,
    initialLiked,
    initialCommentCount,
    onOpenLogin,
}: CommunityCommentsPanelProps) {
    const [commentCount, setCommentCount] = useState(initialCommentCount);

    return (
        <>
            <div className="flex items-center gap-4 text-slate-400 text-sm font-semibold border-t border-slate-100 pt-5 mt-5">
                <span>조회 {viewCount || 0}</span>
                <span data-testid="community-comment-summary-count">댓글 {commentCount || 0}</span>
                <div className="ml-auto">
                    <LikeButton
                        postId={postId}
                        initialCount={initialLikeCount}
                        initialLiked={initialLiked}
                        onOpenLogin={onOpenLogin}
                    />
                </div>
            </div>

            <div className="w-full h-2 bg-slate-50 border-y border-slate-100" />

            <section className="px-5 py-6">
                <h3 data-testid="community-comment-heading-count" className="text-[17px] font-bold text-slate-900 mb-6">
                    댓글 {commentCount || 0}
                </h3>
                <CommentSection
                    postId={postId}
                    onOpenLogin={onOpenLogin}
                    onCountChange={setCommentCount}
                />
            </section>
        </>
    );
}
