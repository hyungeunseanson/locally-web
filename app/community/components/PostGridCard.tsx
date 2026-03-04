'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CommunityPost } from '@/app/types/community';
import { Heart, MessageSquare } from 'lucide-react';

interface PostGridCardProps {
    post: CommunityPost;
}

/**
 * 인스타그램형 그리드 카드 — 로컬리 콘텐츠 탭 전용
 * 이미지만 꽉 채워 표시, hover 시 하트/댓글 오버레이
 */
export default function PostGridCard({ post }: PostGridCardProps) {
    const [hovered, setHovered] = useState(false);
    const thumbnail = post.images?.[0] ?? null;

    return (
        <Link href={`/community/${post.id}`} className="block">
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
                    /* 이미지 없는 콘텐츠: 그라데이션 배경 + 제목 */
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-3">
                        <p className="text-[12px] font-semibold text-gray-500 text-center line-clamp-3 leading-snug">
                            {post.title}
                        </p>
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
