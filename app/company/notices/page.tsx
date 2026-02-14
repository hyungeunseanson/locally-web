'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

const NOTICES = [
  { id: 1, title: 'Locally 서비스 이용약관 개정 안내', date: '2026-02-10', isNew: true },
  { id: 2, title: '설 연휴 고객센터 운영 안내', date: '2026-01-20', isNew: false },
  { id: 3, title: '시스템 점검 안내 (2월 15일 새벽 2시~4시)', date: '2026-02-12', isNew: true },
  { id: 4, title: '신규 지역 "부산" 오픈 기념 이벤트 당첨자 발표', date: '2026-01-05', isNew: false },
];

export default function NoticesPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      <div className="flex-1 max-w-4xl mx-auto px-6 py-20 w-full">
        <h1 className="text-3xl font-black mb-2">공지사항</h1>
        <p className="text-slate-500 mb-10">로컬리의 새로운 소식과 안내사항을 확인하세요.</p>
        
        <div className="border-t border-slate-200">
          {NOTICES.map((notice) => (
            <div key={notice.id} className="flex justify-between items-center py-6 border-b border-slate-100 hover:bg-slate-50 transition-colors px-2 cursor-pointer">
              <div className="flex items-center gap-3">
                {notice.isNew && <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded">NEW</span>}
                <span className="text-slate-900 font-medium hover:underline">{notice.title}</span>
              </div>
              <span className="text-sm text-slate-400">{notice.date}</span>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}