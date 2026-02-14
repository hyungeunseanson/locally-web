'use client';

import React, { useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { 
  Search, ChevronDown, ChevronUp, MessageCircle, Mail,
  User, Briefcase, CreditCard, ShieldCheck, MapPin, Calendar, Globe 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client'; 
import { useToast } from '@/app/context/ToastContext';

// 📚 방대한 FAQ 데이터 (내용 보강됨)
const FAQ_DATA = {
  guest: [
    {
      category: '예약 및 결제',
      icon: <CreditCard size={24} strokeWidth={1.5}/>,
      items: [
        { q: "1인 예약 확정 옵션이 무엇인가요?", a: "로컬리 투어는 기본적으로 2인 이상 모집 시 출발합니다. 하지만 혼자 여행하시는 분들을 위해 '1인 출발 확정 옵션'을 제공합니다. 추가 비용을 내고 예약하시면 인원 미달 걱정 없이 출발이 확정되며, 만약 나중에 다른 게스트가 예약에 참여하게 되면 추가 결제하신 확정 비용은 100% 환불해 드립니다." },
        { q: "예약을 취소하면 언제 환불되나요?", a: "취소 요청 후 호스트 승인이 완료되면 즉시 환불 처리가 시작됩니다. 카드사에 따라 영업일 기준 3~5일 정도 소요될 수 있습니다. 24시간 전 취소 시 전액 환불됩니다." },
        { q: "결제 수단은 무엇을 지원하나요?", a: "현재 국내 신용카드 및 체크카드 결제를 지원하며, 카카오페이 등 간편 결제도 가능합니다. 해외 카드는 추후 지원 예정입니다." },
        { q: "예약 확정은 언제 되나요?", a: "호스트가 예약 요청을 확인하고 '수락' 버튼을 누르면 즉시 확정됩니다. 보통 24시간 이내에 확정 여부가 결정되며, 알림톡으로 안내해 드립니다." }
      ]
    },
    {
      category: '계정 및 보안',
      icon: <ShieldCheck size={24} strokeWidth={1.5}/>,
      items: [
        { q: "비밀번호를 잊어버렸어요.", a: "로그인 화면에서 '비밀번호 찾기'를 클릭하여 이메일 인증을 통해 비밀번호를 재설정할 수 있습니다." },
        { q: "호스트는 믿을 수 있는 사람인가요?", a: "로컬리의 모든 호스트는 엄격한 신원 인증(본인 확인, 전화번호 인증)을 거치며, 실제 투어 참여 게스트들의 후기로 투명하게 평판이 관리됩니다." },
        { q: "회원 탈퇴는 어떻게 하나요?", a: "마이페이지 > 계정 설정 하단에서 '회원 탈퇴'를 진행하실 수 있습니다. 탈퇴 시 모든 이용 기록은 삭제되며 복구할 수 없습니다." }
      ]
    },
    {
      category: '투어 이용 가이드',
      icon: <MapPin size={24} strokeWidth={1.5}/>,
      items: [
        { q: "투어 당일 지각하면 어떻게 되나요?", a: "투어는 정해진 시간에 출발하므로 지각 시 참여가 어려울 수 있습니다. 늦을 경우 반드시 호스트에게 미리 연락해 주세요. (당일 취소/환불 불가)" },
        { q: "준비물이 따로 있나요?", a: "각 투어 상세 페이지의 '포함 사항' 및 '준비물' 섹션을 확인해 주세요. 걷기 편한 신발과 물은 필수입니다!" },
        { q: "우천 시 투어는 어떻게 되나요?", a: "약한 비에는 정상 진행되나, 안전이 우려되는 악천후 시 호스트 판단하에 취소될 수 있습니다. 호스트 사유 취소 시 100% 환불됩니다." }
      ]
    }
  ],
  host: [
    {
      category: '호스트 시작하기',
      icon: <Briefcase size={24} strokeWidth={1.5}/>,
      items: [
        { q: "호스트 등록 조건이 있나요?", a: "현지에 거주하며 여행자에게 특별한 경험을 제공하고 싶은 분이라면 누구나 환영합니다! 가이드 자격증이 없어도 '로컬 호스트'로 활동 가능합니다." },
        { q: "수수료는 얼마인가요?", a: "로컬리 플랫폼 수수료는 예약 금액의 20%입니다. (프로모션 기간 제외)" },
        { q: "정산은 언제 되나요?", a: "투어 진행 완료일 기준, 다음주 금요일에 등록하신 계좌로 일괄 입금됩니다." }
      ]
    },
    {
      category: '운영 및 관리',
      icon: <Calendar size={24} strokeWidth={1.5}/>,
      items: [
        { q: "일정 관리는 어떻게 하나요?", a: "호스트 대시보드 > 일정 관리 탭에서 투어 가능한 날짜와 시간을 자유롭게 열고 닫을 수 있습니다." },
        { q: "게스트와 연락은 어떻게 하나요?", a: "예약 확정 시 생성되는 '1:1 채팅방'을 통해 안전하게 소통하실 수 있습니다. 개인 연락처 노출 없이 대화 가능합니다." }
      ]
    },
    {
      category: '글로벌 호스팅',
      icon: <Globe size={24} strokeWidth={1.5}/>,
      items: [
        { q: "외국어 능력이 필수인가요?", a: "외국인 게스트를 대상으로 한다면 필수입니다. 한국인 대상 투어라면 한국어만 가능해도 충분합니다." },
        { q: "해외 거주자도 등록 가능한가요?", a: "네, 전 세계 어디서든 로컬리 호스트로 활동하실 수 있습니다. 현지 계좌 또는 페이팔 연동이 필요할 수 있습니다." }
      ]
    }
  ]
};

export default function HelpCenterPage() {
  const [activeTab, setActiveTab] = useState<'guest' | 'host'>('guest');
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  const toggleItem = (catIdx: number, itemIdx: number) => {
    const key = `${catIdx}-${itemIdx}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 검색 로직
  const filteredData = FAQ_DATA[activeTab].map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.q.includes(searchTerm) || item.a.includes(searchTerm)
    )
  })).filter(category => category.items.length > 0);

  // 1:1 문의 로직 (기존 유지)
  const handleAdminSupport = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("로그인이 필요한 서비스입니다.");
      router.push('/login');
      return;
    }

    const content = prompt("문의하실 내용을 입력해주세요. 관리자가 확인 후 답변드립니다.");
    if (!content) return;

    try {
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', true);

      if (adminError) throw adminError;
      if (!admins || admins.length === 0) {
        throw new Error("현재 상담 가능한 관리자가 없습니다.");
      }

      const randomAdmin = admins[Math.floor(Math.random() * admins.length)];

      const { data: room, error: roomError } = await supabase
        .from('inquiries') 
        .insert({
          host_id: randomAdmin.id,
          user_id: user.id,
          content: content,
          type: 'admin_support' 
        })
        .select()
        .single();

      if (roomError) throw roomError;

      await supabase
        .from('inquiry_messages')
        .insert({
          inquiry_id: room.id,
          sender_id: user.id,
          content: content
        });

      if (confirm("문의가 접수되었습니다. 메시지함으로 이동하시겠습니까?")) {
        router.push('/guest/inbox');
      }
    } catch (e: any) {
      console.error("문의 접수 실패:", e);
      showToast("문의 접수 실패: " + e.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-6 py-24">
        
        {/* 헤더 섹션 (뉴스룸 스타일) */}
        <div className="text-center mb-24">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">
            Help Center
          </h1>
          <div className="relative max-w-2xl mx-auto group">
            <input 
              type="text" 
              placeholder="Search for answers..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full h-16 pl-6 pr-14 bg-white border-b-2 border-gray-300 rounded-none text-2xl font-bold placeholder:text-gray-300 focus:outline-none focus:border-black transition-colors"
            />
            <button className="absolute right-0 top-1/2 -translate-y-1/2 p-2">
              <Search size={28} className="text-gray-400 group-focus-within:text-black transition-colors" />
            </button>
          </div>
        </div>

        {/* 탭 전환 버튼 */}
        <div className="flex justify-center mb-20">
          <div className="flex gap-8 border-b border-gray-200 pb-1">
            <button 
              onClick={() => setActiveTab('guest')} 
              className={`text-lg font-bold pb-4 transition-all relative ${activeTab === 'guest' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
            >
              For Guests
              {activeTab === 'guest' && <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-black"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('host')} 
              className={`text-lg font-bold pb-4 transition-all relative ${activeTab === 'host' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
            >
              For Hosts
              {activeTab === 'host' && <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-black"></span>}
            </button>
          </div>
        </div>

        {/* FAQ 리스트 */}
        <div className="space-y-20">
          {filteredData.map((category, catIdx) => (
            <div key={catIdx}>
              {/* 카테고리 제목 */}
              <div className="flex items-center gap-3 mb-8 border-b border-black pb-4">
                <span className="p-2 border border-black rounded-full">{category.icon}</span>
                <h2 className="text-2xl font-bold tracking-tight">{category.category}</h2>
              </div>
              
              {/* 질문 목록 */}
              <div className="space-y-0">
                {category.items.map((item, itemIdx) => {
                  const isOpen = openItems[`${catIdx}-${itemIdx}`];
                  return (
                    <div key={itemIdx} className="border-b border-gray-200">
                      <button 
                        onClick={() => toggleItem(catIdx, itemIdx)} 
                        className="w-full py-6 flex justify-between items-start text-left group hover:bg-gray-50 transition-colors px-4 -mx-4 rounded-lg"
                      >
                        <span className="text-lg font-medium text-[#222222] pr-8 group-hover:underline decoration-2 underline-offset-4">{item.q}</span>
                        <div className="pt-1 text-gray-400 group-hover:text-black transition-colors">
                          {isOpen ? <ChevronUp size={20} strokeWidth={2.5}/> : <ChevronDown size={20} strokeWidth={2.5}/>}
                        </div>
                      </button>
                      
                      {/* 답변 내용 */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 pb-8' : 'max-h-0 opacity-0'}`}>
                        <div className="px-4 text-base text-[#484848] leading-relaxed max-w-3xl font-light">
                          {item.a}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 하단 지원 섹션 */}
        <div className="mt-32 bg-[#F7F7F7] p-12 md:p-16 text-center rounded-2xl">
          <h3 className="text-3xl font-black mb-4 tracking-tight">Need more help?</h3>
          <p className="text-[#717171] mb-10 max-w-md mx-auto font-medium">
            원하시는 답변을 찾지 못하셨나요? <br/>
            로컬리 지원팀에게 직접 문의해 보세요.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <button 
              onClick={handleAdminSupport}
              className="bg-black text-white px-8 py-4 font-bold uppercase tracking-widest hover:bg-[#333] transition-colors flex items-center justify-center gap-3 shadow-lg"
            >
              <MessageCircle size={18} /> Chat Support
            </button>
            <a 
              href="mailto:help@locally.com" 
              className="bg-white border-2 border-black text-black px-8 py-4 font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
            >
              <Mail size={18} /> Email Us
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}