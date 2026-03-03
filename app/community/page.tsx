import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import CommunityCategoryTabs from './components/CommunityCategoryTabs';
import CommunityFeed from './CommunityFeed';
import { Edit3 } from 'lucide-react';
import Link from 'next/link';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
    const params = await searchParams;
    const categoryQuery = params?.category as string;

    let title = '커뮤니티 | Locally';
    if (categoryQuery === 'qna') title = '💡 질문과 답변 - 커뮤니티 | Locally';
    else if (categoryQuery === 'companion') title = '🤝 동행 찾기 - 커뮤니티 | Locally';
    else if (categoryQuery === 'info') title = '🗺️ 여행 꿀팁 - 커뮤니티 | Locally';

    return {
        title,
        description: '현지인과 여행자들이 생생한 정보를 나누고 동행을 구하는 로컬리 커뮤니티',
        openGraph: {
            title,
            description: '현지인과 여행자들이 정보를 나누고 동행을 구하는 로컬리 커뮤니티',
            type: 'website',
        }
    };
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const supabase = await createClient();
    const params = await searchParams;

    // 기본 디폴트 탭 (값이 없거나 이상하면 qna)
    let category = (params?.category as string) || 'qna';
    if (!['qna', 'companion', 'info'].includes(category)) {
        category = 'qna';
    }

    const limit = 15;
    let query = supabase
        .from('community_posts')
        .select(`
            *,
            profiles(name, avatar_url),
            linked_experience:experiences(id, title, image_url, price)
        `)
        .order('created_at', { ascending: false })
        .range(0, limit - 1);

    if (category) {
        query = query.eq('category', category);
    }

    const { data: initialData, error } = await query;

    let initialNextOffset = null;
    if (initialData && initialData.length === limit) {
        initialNextOffset = limit;
    }

    return (
        <main className="max-w-[768px] mx-auto min-h-screen bg-slate-50 flex flex-col md:border-x md:border-slate-100 shadow-sm relative">
            {/* Header Area (Sticky) */}
            <div className="sticky top-[80px] z-[90] bg-white/95 backdrop-blur-md pt-5 px-5 border-b border-slate-200">
                <div className="flex items-center justify-between mb-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">커뮤니티</h1>

                    {/* Write Button */}
                    <Link href="/community/write" className="flex items-center gap-1.5 text-[14px] font-bold text-white bg-slate-900 px-4 py-2 rounded-full hover:bg-slate-800 transition-colors shadow-sm cursor-pointer whitespace-nowrap group">
                        <Edit3 size={15} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" /> 글쓰기
                    </Link>
                </div>
                <CommunityCategoryTabs />
            </div>

            {/* Feed List Area */}
            <div className="flex-1 bg-white px-5 min-h-[500px]">
                <CommunityFeed
                    initialData={initialData || []}
                    initialNextOffset={initialNextOffset}
                    category={category}
                />
            </div>
        </main>
    );
}
