import React from 'react';
import Link from 'next/link';

interface LinkedExperience {
    id: number;
    title: string;
    image_url?: string;
    price: number;
}

export default function LinkedExperienceChip({ exp }: { exp: LinkedExperience }) {
    return (
        <Link href={`/experiences/${exp.id}`}>
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    {exp.image_url ? (
                        <img src={exp.image_url} alt={exp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Img</div>
                    )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-bold text-gray-900 truncate leading-tight mb-1">{exp.title}</span>
                    <span className="text-xs font-semibold text-gray-600">₩{exp.price.toLocaleString()}</span>
                </div>
                <div className="px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-full mr-1">
                    상품 보기
                </div>
            </div>
        </Link>
    );
}
