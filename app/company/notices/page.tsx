'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 공지사항 데이터 (실제로는 DB에서 가져올 수 있음)
const NOTICES = [
  { 
    id: 1, 
    category: '안내',
    title: 'Locally 서비스 이용약관 개정 안내', 
    date: '2026.02.10', 
    content: '안녕하세요, Locally 팀입니다.\n\n더 나은 서비스 제공을 위해 서비스 이용약관이 일부 개정될 예정입니다.\n\n[개정 내용]\n- 제 5조 3항: 환불 규정 명확화\n- 제 12조: 위치기반서비스 사업자 정보 변경\n\n감사합니다.'
  },
  { 
    id: 2, 
    category: '이벤트',
    title: '신규 지역 "부산" 오픈 기념 20% 할인 이벤트', 
    date: '2026.01.20', 
    content: '부산 지역 오픈 기념!\n\n부산 지역 모든 체험 상품을 20% 할인된 가격에 만나보세요.\n기간: 2026.01.20 ~ 2026.02.20'
  },
  { 
    id: 3, 
    category: '점검',
    title: '시스템 점검 안내 (2월 15일 새벽 2시~4시)', 
    date: '2026.02.12', 
    content: '안정적인 서비스를 위한 정기 점검이 진행됩니다.\n점검 시간 동안 예약 및 결제 서비스 이용이 제한됩니다.'
  },
  { 
    id: 4, 
    category: '안내',
    title: '설 연휴 고객센터 운영 안내', 
    date: '2026.01.05', 
    content: '설 연휴 기간 동안 고객센터 운영 시간이 조정됩니다.\n문의 사항은 1:1 문의를 남겨주시면 순차적으로 답변 드리겠습니다.'
  },
];

export default function NoticesPage() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggleNotice = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      
      {/* 헤더 섹션 */}
      <div className="bg-slate-50 border-b border-slate-100 py-20 px-6 text-center">
        <h1 className="text-3xl md:text-4xl font-black mb-3 tracking-tight text-slate-900">공지사항</h1>
        <p className="text-slate-500 font-medium">Locally의 새로운 소식과 중요한 안내사항을 전해드립니다.</p>
      </div>

      {/* 리스트 섹션 */}
      <div className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <div className="space-y-4">
          {NOTICES.map((notice) => (
            <div 
              key={notice.id} 
              className={`border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 ${openId === notice.id ? 'shadow-lg border-slate-300 bg-white' : 'hover:border-slate-300 bg-white'}`}
            >
              {/* 제목 부분 (클릭 가능) */}
              <button 
                onClick={() => toggleNotice(notice.id)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      notice.category === '이벤트' ? 'bg-rose-100 text-rose-600' :
                      notice.category === '점검' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {notice.category}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{notice.date}</span>
                  </div>
                  <h3 className={`font-bold text-lg transition-colors ${openId === notice.id ? 'text-blue-600' : 'text-slate-900'}`}>
                    {notice.title}
                  </h3>
                </div>
                <div className={`text-slate-400 transition-transform duration-300 ${openId === notice.id ? 'rotate-180' : ''}`}>
                  <ChevronDown size={20} />
                </div>
              </button>

              {/* 내용 부분 (펼쳐짐) */}
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openId === notice.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-6 pt-0 border-t border-slate-100 bg-slate-50/50">
                  <div className="pt-6 text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">
                    {notice.content}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}