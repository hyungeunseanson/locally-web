'use client';

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

interface LikeButtonProps {
    postId: string;
    initialCount: number;
    onOpenLogin?: () => void;
}

export default function LikeButton({ postId, initialCount, onOpenLogin }: LikeButtonProps) {
    const { user, isLoading: authLoading } = useAuth();
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(initialCount);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResolvingLiked, setIsResolvingLiked] = useState(false);

    useEffect(() => {
        setCount(initialCount);
    }, [initialCount, postId]);

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            setLiked(false);
            setIsResolvingLiked(false);
            return;
        }

        let isMounted = true;
        setIsResolvingLiked(true);

        void fetch(`/api/community/likes?post_id=${encodeURIComponent(postId)}`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
        })
            .then(async (response) => {
                const data = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(data?.error || 'Failed to resolve like status');
                }

                if (isMounted) {
                    setLiked(Boolean(data?.authenticated && data?.liked));
                }
            })
            .catch((error) => {
                console.error('[LikeButton] failed to resolve like state:', error);
                if (isMounted) {
                    setLiked(false);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsResolvingLiked(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [authLoading, postId, user]);

    const handleLike = async () => {
        if (!user) {
            onOpenLogin?.();
            return;
        }
        if (authLoading || isSubmitting || isResolvingLiked) return;

        const wasLiked = liked;
        const previousCount = count;
        setLiked(!wasLiked);
        setCount(c => wasLiked ? c - 1 : c + 1);
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/community/likes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    knownLikeCount: previousCount,
                })
            });
            const data = await res.json();
            const hasServerLikeState =
                typeof data?.liked === 'boolean' && Number.isFinite(Number(data?.likeCount));

            if (!res.ok && !(res.status === 409 && hasServerLikeState)) {
                throw new Error(data.error);
            }
            setLiked(data.liked);
            setCount(data.likeCount);
        } catch {
            setLiked(wasLiked);
            setCount(previousCount);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isDisabled = authLoading || isSubmitting || isResolvingLiked;

    return (
        <button
            onClick={handleLike}
            data-testid="community-like-button"
            disabled={isDisabled}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] transition-all border ${liked
                    ? 'bg-rose-50 border-rose-200 text-[#FF385C]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                } disabled:cursor-default disabled:opacity-70`}
        >
            <Heart
                size={18}
                strokeWidth={2.5}
                fill={liked ? '#FF385C' : 'none'}
                className="transition-all"
            />
            <span>{count}</span>
        </button>
    );
}
