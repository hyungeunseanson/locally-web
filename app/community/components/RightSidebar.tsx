'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, ChevronRight } from 'lucide-react';

const MOCK_EXPERIENCES = [
    {
        id: 1,
        title: '건축가와 함께하는 북촌 골목 산책',
        image: 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=120&h=80&fit=crop',
        price: '₩45,000',
        rating: '4.98',
    },
    {
        id: 2,
        title: '현지인과 을지로 힙한 뒷골목 투어',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&h=80&fit=crop',
        price: '₩38,000',
        rating: '4.95',
    },
    {
        id: 3,
        title: '서울 전통시장 음식 탐방 & 요리 체험',
        image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=120&h=80&fit=crop',
        price: '₩52,000',
        rating: '4.97',
    },
];

const MOCK_HOT_POSTS = [
    '삿포로 3박 4일 맛집 루트 공유합니다 🍜',
    '도쿄 혼자 여행 처음인데 조언 구해요!',
    '오사카 → 교토 → 나라 당일치기 가능한가요?',
    '후쿠오카 고등어 요리 진짜 맛있는 집 찾았어요',
    '겨울 삿포로 여행 방한 준비물 총정리',
];

export default function RightSidebar() {
    const router = useRouter();

    return (
        <div className="sticky top-28 space-y-5">
            {/* 위젯 1: 글쓰기 CTA */}
            <button
                onClick={() => router.push('/community/write')}
                className="w-full rounded-xl font-bold py-3.5 bg-gradient-to-r from-[#FF385C] to-[#E31C5F] text-white shadow-sm hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-[15px]"
            >
                <Edit3 size={17} strokeWidth={2.5} />
                커뮤니티 글쓰기
            </button>

            {/* 위젯 2: 주간 인기 체험 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-[14px] font-extrabold text-gray-900 mb-4 flex items-center gap-1.5">
                    🔥 주간 인기 로컬리 체험
                </h3>
                <div className="space-y-3">
                    {MOCK_EXPERIENCES.map((exp, idx) => (
                        <Link key={exp.id} href={`/experiences/${exp.id}`}>
                            <div className="flex items-center gap-3 group cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors">
                                <div className="relative flex-shrink-0">
                                    <div className="w-[60px] h-[44px] rounded-lg overflow-hidden bg-gray-100">
                                        <img
                                            src={exp.image}
                                            alt={exp.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </div>
                                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-black flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug">
                                        {exp.title}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[11px] font-bold text-[#FF385C]">{exp.price}</span>
                                        <span className="text-[10px] text-gray-400">· ★ {exp.rating}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                <Link href="/experiences" className="mt-3 flex items-center justify-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-gray-800 transition-colors pt-3 border-t border-gray-100">
                    체험 전체 보기 <ChevronRight size={14} />
                </Link>
            </div>

            {/* 위젯 3: 지금 뜨는 라운지 글 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-[14px] font-extrabold text-gray-900 mb-4 flex items-center gap-1.5">
                    💬 지금 뜨는 라운지 글
                </h3>
                <ul className="space-y-2.5">
                    {MOCK_HOT_POSTS.map((title, idx) => (
                        <li key={idx}>
                            <Link
                                href="/community?category=info"
                                className="flex items-start gap-2 group"
                            >
                                <span className="text-[11px] font-black text-gray-300 mt-[2px] w-4 flex-shrink-0">{idx + 1}</span>
                                <span className="text-[13px] text-gray-700 leading-snug group-hover:underline group-hover:text-gray-900 transition-colors line-clamp-2">
                                    {title}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            {/* 위젯 4: 로컬리 앱 CTA */}
            <div className="bg-gray-900 rounded-2xl p-5 text-white">
                <p className="text-[13px] font-black mb-1">로컬리 앱에서 더 편리하게</p>
                <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">실시간 알림, 동행 빠른 연결,<br />맞춤 체험 추천까지</p>
                <Link
                    href="/"
                    className="block w-full text-center bg-white text-gray-900 text-[12px] font-bold py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    앱 다운로드 →
                </Link>
            </div>
        </div>
    );
}
