'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ChevronDown, ChevronUp } from 'lucide-react';

const NOTICES = [
  { 
    id: 1, 
    tag: '안내',
    title: 'Locally 서비스 이용약관 개정 안내', 
    date: '2026.02.10', 
    content: '안녕하세요, Locally 팀입니다.\n\n더 나은 서비스 제공을 위해 서비스 이용약관이 일부 개정될 예정입니다.\n\n[개정 내용]\n- 제 5조 3항: 환불 규정 명확화\n- 제 12조: 위치기반서비스 사업자 정보 변경\n\n감사합니다.'
  },
  { 
    id: 2, 
    tag: '이벤트',
    title: '신규 지역 "부산" 오픈 기념 20% 할인 이벤트', 
    date: '2026.01.20', 
    content: '부산 지역 오픈 기념!\n\n부산 지역 모든 체험 상품을 20% 할인된 가격에 만나보세요.\n기간: 2026.01.20 ~ 2026.02.20'
  },
  { 
    id: 3, 
    tag: '점검',
    title: '시스템 점검 안내 (2월 15일 새벽 2시~4시)', 
    date: '2026.02.12', 
    content: '안정적인 서비스를 위한 정기 점검이 진행됩니다.\n점검 시간 동안 예약 및 결제 서비스 이용이 제한됩니다.'
  },
  { 
    id: 4, 
    tag: '안내',
    title: '설 연휴 고객센터 운영 안내', 
    date: '2026.01.05', 
    content: '설 연휴 기간 동안 고객센터 운영 시간이 조정됩니다.\n문의 사항은 1:1 문의를 남겨주시면 순차적으로 답변 드리겠습니다.'
  },
];

export default function NoticesPage() {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />
      
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-10">공지사항</h1>
        
        <div className="border-t border-slate-200">
          {NOTICES.map((notice) => (
            <div key={notice.id} className="border-b border-slate-100">
              <button 
                onClick={() => setOpenId(openId === notice.id ? null : notice.id)}
                className="w-full py-6 flex items-start text-left hover:bg-slate-50 transition-colors px-3 -mx-3 rounded-lg group"
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      notice.tag === '이벤트' ? 'bg-rose-50 text-rose-600' : 
                      notice.tag === '점검' ? 'bg-amber-50 text-amber-600' : 
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {notice.tag}
                    </span>
                    <span className="text-xs text-slate-400">{notice.date}</span>
                  </div>
                  <h3 className={`text-base font-medium transition-colors ${openId === notice.id ? 'text-blue-600' : 'text-slate-800 group-hover:text-slate-900'}`}>
                    {notice.title}
                  </h3>
                </div>
                <div className="pt-1 text-slate-300">
                  {openId === notice.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>
              
              {/* 내용 펼침 */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openId === notice.id ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                <div className="bg-slate-50 p-5 rounded-xl text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mx-2">
                  {notice.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}