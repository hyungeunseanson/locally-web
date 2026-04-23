'use client';

import React, { useEffect, useRef, useState } from 'react';

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
    const initialViewCount = Math.max(Number(viewCount || 0), 1);
    const [currentViewCount, setCurrentViewCount] = useState(initialViewCount);
    const trackedPostIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (trackedPostIdRef.current === postId) {
            return;
        }

        trackedPostIdRef.current = postId;
        let isMounted = true;

        void fetch('/api/community/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
            body: JSON.stringify({
                postId,
                knownViewCount: initialViewCount,
            }),
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
    }, [initialViewCount, postId]);

    return (
        <section data-testid="community-comments-panel" className="mt-5 px-5 pb-6 pt-5">
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-400">
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

            <div className="pt-6">
                <h3 data-testid="community-comment-heading-count" className="text-[17px] font-bold text-slate-900 mb-6">
                    댓글 {commentCount || 0}
                </h3>
                <CommentSection
                    postId={postId}
                    onOpenLogin={onOpenLogin}
                    onCountChange={setCommentCount}
                />
            </div>
        </section>
    );
}
