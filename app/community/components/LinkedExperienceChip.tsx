import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface LinkedExperience {
    id: number;
    title: string;
    image_url?: string;
    price: number;
}

export default function LinkedExperienceChip({ exp }: { exp: LinkedExperience }) {
    return (
        <Link href={`/experiences/${exp.id}`} onClick={(e) => e.stopPropagation()}>
            <div className="mt-4 bg-[#F7F7F9] hover:bg-gray-100 border border-gray-200 rounded-xl p-3 flex items-center gap-3 transition-colors cursor-pointer group">
                {/* 썸네일 */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    {exp.image_url ? (
                        <img
                            src={exp.image_url}
                            alt={exp.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Img</div>
                    )}
                </div>

                {/* 텍스트 */}
                <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">연동 체험</span>
                    <span className="text-sm font-bold text-gray-900 truncate leading-tight">{exp.title}</span>
                    <span className="text-xs font-semibold text-[#FF385C] mt-0.5">₩{exp.price.toLocaleString()}</span>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-full group-hover:bg-black flex-shrink-0 transition-colors">
                    보기 <ExternalLink size={11} />
                </div>
            </div>
        </Link>
    );
}
