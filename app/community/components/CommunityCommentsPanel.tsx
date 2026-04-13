'use client';

import React, { useEffect, useState } from 'react';

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
    const [currentViewCount, setCurrentViewCount] = useState(() => Math.max(Number(viewCount || 0), 1));

    useEffect(() => {
        let isMounted = true;

        void fetch('/api/community/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
            body: JSON.stringify({ postId }),
        })
            .then(async (response) => {
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) {
                    throw new Error(data?.error || 'view tracking failed');
                }

                if (isMounted && Number.isFinite(Number(data.viewCount))) {
                    setCurrentViewCount(Number(data.viewCount));
                }
            })
            .catch((error) => {
                console.warn('[CommunityCommentsPanel] view tracking failed:', error);
            });

        return () => {
            isMounted = false;
        };
    }, [postId]);

    return (
        <>
            <div className="flex items-center gap-4 text-slate-400 text-sm font-semibold border-t border-slate-100 pt-5 mt-5 px-5 flex-wrap">
                <span data-testid="community-view-summary-count">조회 {currentViewCount || 0}</span>
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
