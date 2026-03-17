'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { COMMUNITY_HUB_OPTIONS, getCommunityHubMeta } from '../hubMeta';
import { buildCommunityListHref } from '../queryParams';
import { resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '../queryParams';

export default function CommunityHubTabs() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentHub = resolveCommunityHub(searchParams.get('hub'));
    const currentFormat = resolveCommunityFormat(searchParams.get('format'), searchParams.get('category'));
    const currentQuery = searchParams.get('q') || '';
    const currentSort = resolveCommunitySort(searchParams.get('sort'));

    const handleHubClick = (hub: typeof currentHub) => {
        router.push(buildCommunityListHref({
            hub,
            format: currentFormat,
            q: currentQuery,
            sort: currentSort,
        }));
    };

    return (
        <div className="flex items-stretch gap-3 overflow-x-auto pb-1 no-scrollbar">
            {COMMUNITY_HUB_OPTIONS.map((hub) => {
                const meta = getCommunityHubMeta(hub);
                const isActive = currentHub === hub;

                return (
                    <button
                        key={hub}
                        type="button"
                        onClick={() => handleHubClick(hub)}
                        className={`min-w-[172px] rounded-[24px] border bg-gradient-to-br px-4 py-4 text-left transition-all ${
                            isActive
                                ? `${meta.accentClassName} shadow-[0_14px_30px_rgba(15,23,42,0.08)]`
                                : 'border-slate-200 from-white via-white to-slate-50 text-slate-600 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]'
                        }`}
                    >
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{meta.eyebrow}</div>
                        <div className="mt-2 text-[18px] font-semibold text-slate-900">{meta.label}</div>
                        <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{meta.description}</p>
                    </button>
                );
            })}
        </div>
    );
}
