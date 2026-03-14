'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, ChevronRight } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import type { CommunityCategory } from '@/app/types/community';

// ─── 인기 체험 타입 ───────────────────────────────────────────────────────────
interface ExperienceItem { id: number; title: string; image_url: string | null; photos: string[] | null; price: number | null; }


const getTimeAgo = (dateStr: string) => {
    try {
        const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
        const diff = (new Date(dateStr).getTime() - new Date().getTime()) / 1000;
        if (Math.abs(diff) < 60) return '방금 전';
        if (Math.abs(diff) < 3600) return rtf.format(Math.floor(diff / 60), 'minute');
        if (Math.abs(diff) < 86400) return rtf.format(Math.floor(diff / 3600), 'hour');
        return rtf.format(Math.floor(diff / 86400), 'day');
    } catch { return dateStr.split('T')[0]; }
};

// ─── 실시간 최신글 타입 ───────────────────────────────────────────────────────
interface RecentPost { id: string; title: string; created_at: string; }
interface HotPost { id: string; title: string; category: string; }

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function RightSidebar({ category }: { category: CommunityCategory }) {
    const router = useRouter();
    const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
    const [hotPosts, setHotPosts] = useState<HotPost[]>([]);
    const [experiences, setExperiences] = useState<ExperienceItem[]>([]);

    useEffect(() => {
        const supabase = createClient();
        const fetchExperiences = async () => {
            const { data } = await supabase
                .from('experiences')
                .select('id, title, image_url, photos, price')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(3);
            if (data) setExperiences(data);
        };
        const fetchRecent = async () => {
            const { data } = await supabase
                .from('community_posts')
                .select('id, title, created_at')
                .order('created_at', { ascending: false })
                .limit(5);
            if (data) setRecentPosts(data);
        };
        const fetchHotPosts = async () => {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('community_posts')
                .select('id, title, category')
                .gte('created_at', since)
                .order('like_count', { ascending: false })
                .order('comment_count', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(5);
            if (data) setHotPosts(data);
        };
        fetchExperiences();
        fetchRecent();
        fetchHotPosts();

        // 실시간 신규 글 구독 → 새 글 올라오면 자동 갱신
        const channel = supabase.channel('community_realtime_sidebar')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
                fetchRecent();
                fetchHotPosts();
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    return (
        <div className="sticky top-28 space-y-5">

            {/* 위젯 1: 글쓰기 CTA */}
            <button
                onClick={() => router.push(`/community/write?category=${category}`)}
                className="w-full rounded-xl font-bold py-3.5 bg-gradient-to-r from-[#FF385C] to-[#E31C5F] text-white shadow-sm hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-[15px]"
            >
                <Edit3 size={17} strokeWidth={2.5} />
                커뮤니티 글쓰기
            </button>

            {/* 위젯 2: 주간 인기 체험 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-[14px] font-extrabold text-gray-900 mb-4">🔥 주간 인기 로컬리 체험</h3>
                <div className="space-y-3">
                    {experiences.length === 0 ? (
                        <p className="text-[12px] text-gray-400">표시할 체험이 없습니다.</p>
                    ) : experiences.map((exp, idx) => (
                        <Link key={exp.id} href={`/experiences/${exp.id}`}>
                            <div className="flex items-center gap-3 group cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors">
                                <div className="relative flex-shrink-0">
                                    <div className="w-[60px] h-[44px] rounded-lg overflow-hidden bg-gray-100">
                                        <img src={exp.photos?.[0] || exp.image_url || '/images/logo.png'} alt={exp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    </div>
                                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-black flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug">{exp.title}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[11px] font-bold text-[#FF385C]">₩{exp.price?.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                <Link href="/experiences" className="mt-3 flex items-center justify-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-gray-800 transition-colors pt-3 border-t border-gray-100">
                    체험 전체 보기 <ChevronRight size={14} />
                </Link>
            </div>

            {/* 위젯 3: 지금 뜨는 라운지 글 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-[14px] font-extrabold text-gray-900 mb-4">💬 지금 뜨는 라운지 글</h3>
                <ul className="space-y-2.5">
                    {hotPosts.map((post, idx) => (
                        <li key={idx}>
                            <Link href={`/community/${post.id}?category=${post.category}`} className="flex items-start gap-2 group">
                                <span className="text-[11px] font-black text-gray-300 mt-[2px] w-4 flex-shrink-0">{idx + 1}</span>
                                <span className="text-[13px] text-gray-700 leading-snug group-hover:underline group-hover:text-gray-900 transition-colors line-clamp-2">{post.title}</span>
                            </Link>
                        </li>
                    ))}
                    {hotPosts.length === 0 && (
                        <li className="text-[12px] text-gray-400">표시할 인기글이 없습니다.</li>
                    )}
                </ul>
            </div>

            {/* 위젯 4: ⚡ 실시간 업데이트 (앱 CTA 배너 완전 대체) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-[14px] font-extrabold text-gray-900 mb-4 flex items-center justify-between">
                    <span>⚡ 실시간 업데이트</span>
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                </h3>
                <ul className="space-y-3.5">
                    {recentPosts.length === 0 ? (
                        [...Array(4)].map((_, i) => (
                            <li key={i} className="flex items-center gap-2 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-gray-200 rounded-full flex-shrink-0" />
                                <span className="h-3 bg-gray-100 rounded-full flex-1" />
                                <span className="h-3 w-10 bg-gray-100 rounded-full flex-shrink-0" />
                            </li>
                        ))
                    ) : (
                        recentPosts.map((post) => (
                            <li key={post.id}>
                                <Link href={`/community/${post.id}`} className="flex items-center gap-2 group">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-800 line-clamp-1 group-hover:underline cursor-pointer flex-1 min-w-0">
                                        {post.title}
                                    </span>
                                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 ml-1" suppressHydrationWarning>
                                        {getTimeAgo(post.created_at)}
                                    </span>
                                </Link>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
}
