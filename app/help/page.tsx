'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { 
  Search, ChevronDown, ChevronUp, MessageCircle, 
  User, Briefcase, CreditCard, ShieldCheck, Smile 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/app/hooks/useChat';

const FAQ_DATA = {
  guest: [
    {
      category: '예약 및 결제',
      icon: <CreditCard size={20}/>,
      items: [
        {
          q: "1인 예약 확정 옵션이 무엇인가요?",
          a: "로컬리 투어는 기본적으로 2인 이상 모집 시 출발합니다. 하지만 혼자 여행하시는 분들을 위해 '1인 출발 확정 옵션'을 제공합니다. 추가 비용을 내고 예약하시면 인원 미달 걱정 없이 출발이 확정되며, 만약 나중에 다른 게스트가 예약에 참여하게 되면 추가 결제하신 확정 비용은 100% 환불해 드립니다."
        },
        {
          q: "예약을 취소하면 환불받을 수 있나요?",
          a: "투어 시작 24시간 전까지 취소하시면 전액 환불해 드립니다. 단, 호스트가 이미 투어 준비를 마친 당일 취소나 노쇼(No-show)의 경우에는 환불이 어렵습니다. 자세한 내용은 각 투어 상세페이지의 환불 규정을 참고해 주세요."
        }
      ]
    },
    {
      category: '계정 및 보안',
      icon: <ShieldCheck size={20}/>,
      items: [
        {
          q: "호스트는 믿을 수 있는 사람인가요?",
          a: "로컬리의 모든 호스트는 엄격한 신원 인증 절차(여권 및 거주지 확인)를 거칩니다."
        }
      ]
    }
  ],
  host: [
    {
      category: '호스트 시작하기',
      icon: <Briefcase size={20}/>,
      items: [
        {
          q: "호스트 등록 조건이 있나요?",
          a: "현지에 거주하며 여행자에게 특별한 경험을 제공하고 싶은 분이라면 누구나 환영합니다!"
        }
      ]
    }
  ]
};

export default function HelpCenterPage() {
  const [activeTab, setActiveTab] = useState<'guest' | 'host'>('guest');
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  
  const { createAdminInquiry, currentUser } = useChat();
  const router = useRouter();

  const toggleItem = (catIdx: number, itemIdx: number) => {
    const key = `${catIdx}-${itemIdx}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredData = FAQ_DATA[activeTab].map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.q.includes(searchTerm) || item.a.includes(searchTerm)
    )
  })).filter(category => category.items.length > 0);

  const handleAdminSupport = async () => {
    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    const content = prompt("문의하실 내용을 입력해주세요. 관리자가 확인 후 답변드립니다.");
    if (!content) return;

    try {
      await createAdminInquiry(content);
      if (confirm("문의가 접수되었습니다. 메시지함으로 이동하시겠습니까?")) {
        router.push('/guest/inbox');
      }
    } catch (e: any) {
      alert("문의 접수 실패: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="bg-slate-50 py-16 px-6 text-center border-b border-slate-100">
        <h1 className="text-3xl md:text-4xl font-black mb-6 tracking-tight">무엇을 도와드릴까요?</h1>
        <div className="max-w-2xl mx-auto relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Search size={20} /></div>
          <input 
            type="text" 
            placeholder="질문 키워드를 입력해 보세요" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-12 pr-6 py-4 rounded-full border border-slate-300 shadow-sm text-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
          />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex justify-center mb-12">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button onClick={() => setActiveTab('guest')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'guest' ? 'bg-white shadow-sm text-black' : 'text-slate-500 hover:text-slate-700'}`}><User size={16}/> 여행자 (게스트)</button>
            <button onClick={() => setActiveTab('host')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'host' ? 'bg-white shadow-sm text-black' : 'text-slate-500 hover:text-slate-700'}`}><Briefcase size={16}/> 호스트</button>
          </div>
        </div>

        <div className="space-y-10">
          {filteredData.map((category, catIdx) => (
            <div key={catIdx}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                <span className="p-2 bg-slate-100 rounded-lg text-black">{category.icon}</span>
                {category.category}
              </h3>
              <div className="space-y-3">
                {category.items.map((item, itemIdx) => {
                  const isOpen = openItems[`${catIdx}-${itemIdx}`];
                  return (
                    <div key={itemIdx} className="border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors">
                      <button onClick={() => toggleItem(catIdx, itemIdx)} className="w-full flex justify-between items-center p-5 text-left bg-white hover:bg-slate-50 transition-colors">
                        <span className="font-bold text-slate-900">{item.q}</span>
                        {isOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                      </button>
                      {isOpen && <div className="p-5 pt-0 bg-white text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in zoom-in-95 duration-200"><div className="pt-4">{item.a}</div></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 border border-slate-200 rounded-3xl p-8 md:p-12 text-center bg-slate-50">
          <h3 className="text-2xl font-black mb-4">아직 해결되지 않으셨나요?</h3>
          <p className="text-slate-600 mb-8">로컬리 고객센터는 언제나 열려있습니다.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={handleAdminSupport}
              className="bg-black text-white px-8 py-3.5 rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
            >
              <MessageCircle size={20}/> 1:1 채팅 상담하기
            </button>
            <a href="mailto:help@locally.com" className="bg-white border border-slate-300 text-slate-900 px-8 py-3.5 rounded-xl font-bold hover:bg-slate-100 transition-colors inline-block flex items-center justify-center">이메일 문의하기</a>
          </div>
        </div>
      </main>
    </div>
  );
}