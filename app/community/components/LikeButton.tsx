'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

interface LikeButtonProps {
    postId: string;
    initialCount: number;
    initialLiked: boolean;
    onOpenLogin?: () => void;
}

export default function LikeButton({ postId, initialCount, initialLiked, onOpenLogin }: LikeButtonProps) {
    const { user } = useAuth();
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [isLoading, setIsLoading] = useState(false);

    const handleLike = async () => {
        if (!user) {
            onOpenLogin?.();
            return;
        }
        if (isLoading) return;

        const wasLiked = liked;
        const previousCount = count;
        setLiked(!wasLiked);
        setCount(c => wasLiked ? c - 1 : c + 1);
        setIsLoading(true);

        try {
            const res = await fetch('/api/community/likes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: postId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setLiked(data.liked);
            setCount(data.likeCount);
        } catch {
            setLiked(wasLiked);
            setCount(previousCount);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[14px] transition-all border ${liked
                    ? 'bg-rose-50 border-rose-200 text-[#FF385C]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
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
