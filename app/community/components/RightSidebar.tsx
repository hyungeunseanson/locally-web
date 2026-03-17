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
            <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(255,241,244,0.7)_48%,_rgba(255,255,255,0.9)_100%)] px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FF385C]">Instagram Flow</div>
                <h3 className="mt-2 text-[18px] font-semibold text-slate-900">릴스에서 보고 왔다면 도시 질문부터 확인하세요.</h3>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">
                    저장한 릴스와 같은 주제의 질문, 동행, 운영팀 정리글을 한 화면에서 이어보는 구조입니다.
                </p>
            </div>

            {showWriteButton && (
                <Link
                    href={`/community/write?${writeParams.toString()}`}
                    role="button"
                    className="w-full rounded-xl font-bold py-3.5 bg-gradient-to-r from-[#FF385C] to-[#E31C5F] text-white shadow-sm hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-[15px]"
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
                title="✨ 운영팀 저장 글"
                items={locallyPicks}
                moreHref={buildCommunityListHref({ hub, format: 'locally_pick' })}
            />
        </div>
    );
}
