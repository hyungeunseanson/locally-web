import Link from 'next/link';
import { Edit3, ChevronRight } from 'lucide-react';

import type { CommunityCategory, CommunityHubFilter, CommunityPostFormatFilter } from '@/app/types/community';
import type { CommunityHighlightPost } from '../highlights';
import { getCommunityHubMeta } from '../hubMeta';
import { buildCommunityDetailHref, buildCommunityListHref } from '../queryParams';
import { COMMUNITY_OPEN, isLocallyContentCategory } from '../categoryMeta';

interface RightSidebarProps {
    category: CommunityCategory;
    hub: CommunityHubFilter;
    format: CommunityPostFormatFilter;
    canWriteLocallyContent: boolean;
    weeklyQuestions: CommunityHighlightPost[];
    companionPulse: CommunityHighlightPost[];
    locallyPicks: CommunityHighlightPost[];
}

function SidebarList({
    title,
    items,
    moreHref,
}: {
    title: string;
    items: CommunityHighlightPost[];
    moreHref: string;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="h-[10px] bg-gradient-to-b from-[#E5E5E5] via-[#EFEFEF] to-transparent" />
            <div className="p-5 pt-3">
                <h3 className="mb-4 text-[16px] font-semibold tracking-[-0.02em] text-[#222222]">{title}</h3>
                <ul className="space-y-3">
                    {items.length === 0 && (
                        <li className="text-[12px] text-gray-400">표시할 글이 없습니다.</li>
                    )}
                    {items.map((post, idx) => (
                        <li key={post.id}>
                            <Link
                                href={buildCommunityDetailHref(post.id, {
                                    hub: post.destination_hub ?? 'all',
                                    format: post.post_format,
                                    category: post.category,
                                })}
                                className="flex items-start gap-2 group"
                            >
                                <span className="mt-[2px] w-4 flex-shrink-0 text-[11px] font-black text-gray-300">{idx + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <span className="block line-clamp-2 text-[13px] leading-snug text-gray-700 transition-colors group-hover:text-gray-900 group-hover:underline">
                                        {post.title}
                                    </span>
                                    {post.destination_hub && (
                                        <span className="mt-1 block text-[11px] font-medium text-gray-400">
                                            {getCommunityHubMeta(post.destination_hub).label}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
                <Link
                    href={moreHref}
                    className="mt-3 flex items-center justify-center gap-1 border-t border-gray-100 pt-3 text-[13px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
                >
                    더 보기 <ChevronRight size={14} />
                </Link>
            </div>
        </div>
    );
}

export default function RightSidebar({
    category,
    hub,
    format,
    canWriteLocallyContent,
    weeklyQuestions,
    companionPulse,
    locallyPicks,
}: RightSidebarProps) {
    const showWriteButton = COMMUNITY_OPEN
        ? (!isLocallyContentCategory(category) || canWriteLocallyContent)
        : canWriteLocallyContent;
    const writeParams = new URLSearchParams();
    writeParams.set('category', category);
    if (hub !== 'all') writeParams.set('hub', hub);
    if (format !== 'all') writeParams.set('format', format);

    return (
        <div className="sticky top-28 space-y-5">
            {showWriteButton && (
                <Link
                    href={`/community/write?${writeParams.toString()}`}
                    role="button"
                    className="w-full rounded-xl bg-[#111111] py-3.5 text-[15px] font-bold text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)] transition-all duration-200 hover:bg-black active:scale-95 flex items-center justify-center gap-2"
                >
                    <Edit3 size={17} strokeWidth={2.5} />
                    커뮤니티 글쓰기
                </Link>
            )}

            {COMMUNITY_OPEN && (
                <SidebarList
                    title="이번 주 인기 질문"
                    items={weeklyQuestions}
                    moreHref={buildCommunityListHref({ hub, format: 'question' })}
                />
            )}
            {COMMUNITY_OPEN && (
                <SidebarList
                    title="지금 올라오는 동행"
                    items={companionPulse}
                    moreHref={buildCommunityListHref({ hub, format: 'companion' })}
                />
            )}
            <SidebarList
                title="로컬리 콘텐츠"
                items={locallyPicks}
                moreHref={buildCommunityListHref({ hub, format: 'locally_pick' })}
            />
        </div>
    );
}
