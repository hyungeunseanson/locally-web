import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import CommunityCategoryTabs from './components/CommunityCategoryTabs';
import CommunityFeed from './CommunityFeed';
import RightSidebar from './components/RightSidebar';
import SiteHeader from '@/app/components/SiteHeader';
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

    const { data: initialData } = await query;

    let initialNextOffset = null;
    if (initialData && initialData.length === limit) {
        initialNextOffset = limit;
    }

    return (
        <>
            <SiteHeader />
            {/* 페이지 배경 */}
            <div className="min-h-screen bg-[#F7F7F9]">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* 반응형 2단 그리드: 좌측 8칸 + 우측 4칸 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* ─── 좌측 메인 피드 (8/12) ─── */}
                        <div className="col-span-1 lg:col-span-8">
                            {/* 상단 헤더: 카테고리 탭 */}
                            <div className="mb-4">
                                <CommunityCategoryTabs />
                            </div>

                            {/* 글쓰기 유도 넛지 */}
                            <Link href="/community/write">
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 cursor-text mb-5 hover:border-gray-200 hover:shadow-md transition-all duration-200">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <Edit3 size={16} className="text-gray-400" />
                                    </div>
                                    <span className="text-gray-400 text-[15px] font-medium select-none">어떤 여행을 계획 중이신가요?</span>
                                </div>
                            </Link>

                            {/* 피드 */}
                            <CommunityFeed
                                initialData={initialData || []}
                                initialNextOffset={initialNextOffset}
                                category={category}
                            />
                        </div>

                        {/* ─── 우측 사이드바 (4/12, 모바일 hidden) ─── */}
                        <div className="col-span-1 lg:col-span-4 hidden lg:flex flex-col">
                            <RightSidebar />
                        </div>
                    </div>
                </div>
            </div>

            <Link
                href="/community/write"
                className="block lg:hidden fixed bottom-20 right-4 w-14 h-14 bg-[#FF385C] text-white rounded-full shadow-lg z-50 flex items-center justify-center hover:bg-[#e0314f] active:scale-95 transition-all"
                aria-label="글쓰기"
            >
                <Edit3 size={22} strokeWidth={2.5} />
            </Link>
        </>
    );
}
