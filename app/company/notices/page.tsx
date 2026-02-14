'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 공지사항 데이터
const NOTICES = [
  {
    id: 1,
    title: 'Locally 서비스 이용약관 개정 안내',
    date: '2026.02.10',
    content: '안녕하세요, Locally 팀입니다.\n\n더 나은 서비스 제공을 위해 서비스 이용약관이 일부 개정될 예정입니다.\n\n[개정 내용]\n- 제 5조 3항: 환불 규정 명확화\n- 제 12조: 위치기반서비스 사업자 정보 변경\n\n[시행일]\n2026년 2월 20일\n\n감사합니다.'
  },
  {
    id: 2,
    title: '설 연휴 고객센터 운영 안내',
    date: '2026.01.20',
    content: '설 연휴 기간 동안 고객센터 운영 시간이 다음과 같이 조정됩니다.\n\n- 1월 28일 (수): 09:00 ~ 13:00\n- 1월 29일 (목): 휴무\n- 1월 30일 (금): 휴무\n\n문의 사항은 1:1 문의를 남겨주시면 순차적으로 답변 드리겠습니다.'
  },
  {
    id: 3,
    title: '시스템 점검 안내 (2월 15일 새벽 2시~4시)',
    date: '2026.02.12',
    content: '안정적인 서비스를 위한 정기 점검이 진행됩니다.\n\n일시: 2026년 2월 15일 02:00 ~ 04:00 (2시간)\n영향: 점검 시간 동안 예약 및 결제 서비스 이용 제한\n\n이용에 불편을 드려 죄송합니다.'
  },
  {
    id: 4,
    title: '신규 지역 "부산" 오픈 기념 이벤트 당첨자 발표',
    date: '2026.01.05',
    content: '부산 지역 오픈 기념 이벤트에 참여해주신 모든 분들께 감사드립니다.\n\n당첨자 명단은 아래 링크에서 확인하실 수 있습니다.\n(당첨자에게는 개별 메시지가 발송되었습니다.)'
  },
];

export default function NoticesPage() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggleNotice = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-[#222222]">
      <SiteHeader />

      <main className="max-w-[1000px] mx-auto px-6 py-20">
        {/* 헤더 */}
        <div className="mb-16">
            <div className="text-sm font-bold text-[#717171] mb-2 uppercase tracking-wider">Notices</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">공지사항</h1>
            <p className="text-lg text-[#717171] font-light max-w-2xl">
                Locally의 새로운 소식과 업데이트를 확인하세요.
            </p>
        </div>

        {/* 리스트 */}
        <div className="border-t border-black"> {/* 상단 굵은 선 */}
          {NOTICES.map((notice) => (
            <div key={notice.id} className="border-b border-[#DDDDDD]">
              <button
                onClick={() => toggleNotice(notice.id)}
                className="w-full py-8 flex items-start justify-between text-left group hover:bg-gray-50 transition-colors px-2 -mx-2 rounded-lg"
              >
                <div className="flex-1 pr-8">
                  <h3 className="text-xl font-bold mb-2 group-hover:underline decoration-2 underline-offset-4 decoration-black">
                    {notice.title}
                  </h3>
                  <p className="text-sm text-[#717171]">{notice.date}</p>
                </div>
                <div className="pt-1">
                  {openId === notice.id ? (
                    <ChevronUp size={24} strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={24} strokeWidth={2.5} className="group-hover:text-black text-[#222222]" />
                  )}
                </div>
              </button>

              {/* 내용 (아코디언) */}
              <div
                className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
                  openId === notice.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="pb-8 text-base text-[#222222] leading-relaxed whitespace-pre-wrap font-light pl-1">
                  {notice.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}