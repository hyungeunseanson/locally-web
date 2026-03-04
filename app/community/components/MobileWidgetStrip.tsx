'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';

const MOCK_HOT_POSTS = [
    { title: '삿포로 3박 4일 맛집 루트 공유 🍜', href: '/community?category=info' },
    { title: '도쿄 혼자 여행 처음인데 조언!', href: '/community?category=qna' },
    { title: '오사카→교토→나라 당일치기 가능?', href: '/community?category=qna' },
    { title: '후쿠오카 고등어 요리 맛집 찾았어요', href: '/community?category=info' },
    { title: '겨울 삿포로 방한 준비물 총정리', href: '/community?category=info' },
];

interface RecentPost { id: string; title: string; }

/**
 * 모바일 전용 가로 스크롤 위젯 스트립
 * [⚡ 실시간 업데이트] 카드들 → [💬 지금 뜨는 라운지 글] 카드들 순서로 배치
 * lg 이상(데스크탑)에서는 hidden (RightSidebar가 담당)
 */
export default function MobileWidgetStrip() {
    const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);

    useEffect(() => {
        const supabase = createClient();
        const fetchRecent = async () => {
            const { data } = await supabase
                .from('community_posts')
                .select('id, title')
                .order('created_at', { ascending: false })
                .limit(5);
            if (data) setRecentPosts(data);
        };
        fetchRecent();

        const channel = supabase.channel('community_widget_strip')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
                fetchRecent();
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    return (
        <div className="lg:hidden mb-4 -mx-4 px-4">
            <div className="flex items-start gap-2 overflow-x-auto no-scrollbar pb-1">

                {/* ─── 섹션 1: 실시간 업데이트 ─── */}
                <div className="flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 w-[220px]">
                    <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="text-[11px] font-extrabold text-gray-700">⚡ 실시간 업데이트</span>
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse ml-auto flex-shrink-0" />
                    </div>
                    <ul className="space-y-2">
                        {recentPosts.length === 0
                            ? [...Array(4)].map((_, i) => (
                                <li key={i} className="flex items-center gap-1.5 animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-gray-200 rounded-full flex-shrink-0" />
                                    <span className="h-2.5 bg-gray-100 rounded-full flex-1" />
                                </li>
                            ))
                            : recentPosts.map((post) => (
                                <li key={post.id}>
                                    <Link href={`/community/${post.id}`} className="flex items-start gap-1.5 group">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0 mt-[5px]" />
                                        <span className="text-[11px] text-gray-700 line-clamp-1 group-hover:underline">{post.title}</span>
                                    </Link>
                                </li>
                            ))
                        }
                    </ul>
                </div>

                {/* ─── 섹션 2: 지금 뜨는 라운지 글 ─── */}
                <div className="flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 w-[220px]">
                    <p className="text-[11px] font-extrabold text-gray-700 mb-2.5">💬 지금 뜨는 라운지 글</p>
                    <ul className="space-y-2">
                        {MOCK_HOT_POSTS.map((item, idx) => (
                            <li key={idx}>
                                <Link href={item.href} className="flex items-start gap-1.5 group">
                                    <span className="text-[10px] font-black text-gray-300 flex-shrink-0 mt-[1px]">{idx + 1}</span>
                                    <span className="text-[11px] text-gray-700 line-clamp-1 group-hover:underline">{item.title}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

            </div>
        </div>
    );
}
