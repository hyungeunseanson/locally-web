import Link from 'next/link';
import { Edit3, ChevronRight } from 'lucide-react';

import type { CommunityCategory, CommunityHubFilter, CommunityPostFormatFilter } from '@/app/types/community';
import type { CommunityHighlightPost } from '../highlights';
import { getCommunityHubMeta } from '../hubMeta';
import { buildCommunityDetailHref, buildCommunityListHref } from '../queryParams';
import { isLocallyContentCategory } from '../categoryMeta';

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
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-[14px] font-extrabold text-gray-900 mb-4">{title}</h3>
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
                            <span className="text-[11px] font-black text-gray-300 mt-[2px] w-4 flex-shrink-0">{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                                <span className="block text-[13px] text-gray-700 leading-snug group-hover:underline group-hover:text-gray-900 transition-colors line-clamp-2">
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
                className="mt-3 flex items-center justify-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-gray-800 transition-colors pt-3 border-t border-gray-100"
            >
                더 보기 <ChevronRight size={14} />
            </Link>
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
    const showWriteButton = !isLocallyContentCategory(category) || canWriteLocallyContent;
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

            <SidebarList
                title="🔥 이번 주 인기 질문"
                items={weeklyQuestions}
                moreHref={buildCommunityListHref({ hub, format: 'question' })}
            />
            <SidebarList
                title="🤝 지금 올라오는 동행"
                items={companionPulse}
                moreHref={buildCommunityListHref({ hub, format: 'companion' })}
            />
            <SidebarList
                title="✨ 로컬리 콘텐츠"
                items={locallyPicks}
                moreHref={buildCommunityListHref({ hub, format: 'locally_pick' })}
            />
        </div>
    );
}
