import Link from 'next/link';

import { buildCommunityDetailHref } from '../queryParams';
import { getCommunityHubMeta } from '../hubMeta';
import type { CommunityHighlightPost } from '../highlights';

interface MobileWidgetStripProps {
    weeklyQuestions: CommunityHighlightPost[];
    companionPulse: CommunityHighlightPost[];
    locallyPicks: CommunityHighlightPost[];
}

function HighlightCard({
    title,
    items,
}: {
    title: string;
    items: CommunityHighlightPost[];
}) {
    return (
        <div className="w-[196px] flex-shrink-0 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="mb-2.5 border-b border-gray-100 pb-2">
                <p className="text-[11px] font-extrabold text-gray-700">
                    {title}
                </p>
            </div>
            <ul className="space-y-2">
                {items.length === 0 && (
                    <li className="text-[11px] text-gray-400">표시할 글이 없습니다.</li>
                )}
                {items.map((item, idx) => (
                    <li key={item.id}>
                        <Link
                            href={buildCommunityDetailHref(item.id, {
                                hub: item.destination_hub ?? 'all',
                                format: item.post_format,
                                category: item.category,
                            })}
                            className="flex items-start gap-2 group"
                        >
                            <span className="text-[10px] font-black text-gray-300 mt-[1px]">{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                                <span className="block text-[11px] text-gray-700 line-clamp-2 group-hover:underline">
                                    {item.title}
                                </span>
                                {item.destination_hub && (
                                    <span className="mt-1 block text-[10px] font-semibold text-gray-400">
                                        {getCommunityHubMeta(item.destination_hub).shortLabel}
                                    </span>
                                )}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function MobileWidgetStrip({
    weeklyQuestions,
    companionPulse,
    locallyPicks,
}: MobileWidgetStripProps) {
    return (
        <div className="lg:hidden mb-4 -mx-4 px-4">
            <div className="flex items-start gap-2 overflow-x-auto no-scrollbar pb-1">
                <HighlightCard title="이번 주 인기 질문" items={weeklyQuestions} />
                <HighlightCard title="지금 올라오는 동행" items={companionPulse} />
                <HighlightCard title="로컬리 콘텐츠" items={locallyPicks} />
            </div>
        </div>
    );
}
