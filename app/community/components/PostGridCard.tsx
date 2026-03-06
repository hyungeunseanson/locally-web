'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CommunityPost } from '@/app/types/community';
import { Heart, MessageSquare } from 'lucide-react';

interface PostGridCardProps {
    post: CommunityPost;
    category: string;
    query: string;
    sort: 'latest' | 'popular';
}

/**
 * 인스타그램형 그리드 카드 — 로컬리 콘텐츠 탭 전용
 * 이미지만 꽉 채워 표시, hover 시 하트/댓글 오버레이
 */
export default function PostGridCard({ post, category, query, sort }: PostGridCardProps) {
    const [hovered, setHovered] = useState(false);
    const thumbnail = post.images?.[0] ?? null;
    const params = new URLSearchParams();
    params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    if (sort !== 'latest') params.set('sort', sort);

    return (
        <Link href={`/community/${post.id}?${params.toString()}`} className="block">
            <div
                className="relative aspect-square w-full overflow-hidden bg-gray-100 cursor-pointer"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={post.title}
                        className={`w-full h-full object-cover transition-transform duration-500 ${hovered ? 'scale-105' : 'scale-100'}`}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-slate-50 flex items-center justify-center p-3">
                        <img
                            src="/images/logo-black-transparent.png"
                            alt="Locally 로고"
                            className={`w-16 h-16 object-contain opacity-70 transition-transform duration-500 ${hovered ? 'scale-105' : 'scale-100'}`}
                            loading="lazy"
                        />
                    </div>
                )}

                {/* 호버 오버레이 */}
                <div
                    className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-4 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}
                >
                    <span className="flex items-center gap-1.5 text-white font-bold text-[14px]">
                        <Heart size={18} fill="white" />
                        {post.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1.5 text-white font-bold text-[14px]">
                        <MessageSquare size={18} fill="white" strokeWidth={0} />
                        {post.comment_count ?? 0}
                    </span>
                </div>
            </div>
        </Link>
    );
}
