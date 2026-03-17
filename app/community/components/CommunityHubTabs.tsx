'use client';

import Link from 'next/link';
import React from 'react';
import { useSearchParams } from 'next/navigation';

import { COMMUNITY_HUB_OPTIONS, getCommunityHubMeta } from '../hubMeta';
import { buildCommunityListHref, resolveCommunityFormat, resolveCommunityHub, resolveCommunitySort } from '../queryParams';

export default function CommunityHubTabs() {
    const searchParams = useSearchParams();
    const currentHub = resolveCommunityHub(searchParams.get('hub'));
    const currentFormat = resolveCommunityFormat(searchParams.get('format'), searchParams.get('category'));
    const currentQuery = searchParams.get('q') || '';
    const currentSort = resolveCommunitySort(searchParams.get('sort'));

    return (
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1 no-scrollbar md:gap-3">
            {COMMUNITY_HUB_OPTIONS.map((hub) => {
                const meta = getCommunityHubMeta(hub);
                const isActive = currentHub === hub;
                const href = buildCommunityListHref({
                    hub,
                    format: currentFormat,
                    q: currentQuery,
                    sort: currentSort,
                });

                return (
                    <Link
                        key={hub}
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`min-w-[92px] rounded-[18px] border px-3 py-2.5 text-left transition-all md:min-w-[152px] md:rounded-[24px] md:px-4 md:py-4 ${
                            isActive
                                ? `${meta.accentClassName} shadow-[0_12px_24px_rgba(15,23,42,0.08)]`
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <div className={`text-[9px] font-black uppercase tracking-[0.14em] ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                            {meta.eyebrow}
                        </div>
                        <div className="mt-1.5 text-[13px] font-semibold leading-tight text-slate-900 md:mt-2 md:text-[18px]">
                            {meta.label}
                        </div>
                        <p className="mt-1.5 hidden text-[12px] leading-5 text-slate-500 md:block">
                            {meta.description}
                        </p>
                    </Link>
                );
            })}
        </div>
    );
}
