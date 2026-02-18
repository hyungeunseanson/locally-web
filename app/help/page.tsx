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

// 📚 방대한 FAQ 데이터 (최종 보강판)
const FAQ_DATA = {
  guest: [
    {
      category: '예약 및 결제 (Booking)',
      icon: <CreditCard size={24} strokeWidth={1.5}/>,
      items: [
        { q: "원하는 날짜가 안 보여요.", a: "로컬리의 호스트들은 전문 가이드가 아닌, 본업이 있는 현지인들이라 스케줄이 유동적일 수 있습니다. 만약 달력에 원하는 날짜가 없다면 '호스트에게 문의하기'를 통해 메시지를 보내보세요! 호스트가 일정을 확인하고 시간을 조율해 드릴 수도 있습니다." },
        { q: "프라이빗(단독) 투어도 가능한가요?", a: "네, 물론입니다. 예약 시 '프라이빗 투어' 옵션을 선택해 주세요. (옵션이 없는 경우 호스트에게 메시지로 문의) 호스트가 오직 당신만을 위한 체험을 준비해 드립니다." },
        { q: "1인 예약 확정 옵션이 무엇인가요?", a: "기본적으로 2인 이상 모집 시 출발하지만, 혼자 여행하시는 분들을 위해 '1인 출발 확정' 옵션을 제공합니다. 추가 비용을 내고 예약하시면 인원 미달 걱정 없이 출발이 확정되며, 추후 다른 게스트가 합류하면 추가 결제하신 비용은 100% 환불됩니다." },
        { q: "결제 수단은 무엇을 지원하나요?", a: "현재 국내 신용카드 및 체크카드 결제를 지원하며, 카카오페이, 네이버페이 등 간편 결제도 가능합니다. 해외 발행 카드는 비자(Visa), 마스터(Master) 카드를 지원하며 추후 더 다양한 결제 수단을 도입할 예정입니다." },
        { q: "일행과 따로 결제할 수 있나요?", a: "가능합니다. 각자 예약하되, 같은 시간대를 선택해 주세요. 예약 후 호스트에게 '일행입니다'라고 메시지를 남겨주시면 함께 진행할 수 있도록 준비해 드립니다." }
      ]
    },
    {
      category: '투어 이용 (Experience)',
      icon: <MapPin size={24} strokeWidth={1.5}/>,
      items: [
        { q: "외국어를 못하는데 참여할 수 있나요?", a: "걱정하지 마세요! 언어 장벽 없이 편안하게 즐기실 수 있습니다. 로컬리 호스트와의 모든 소통은 당신의 언어로 이루어지니 안심하세요." },
        { q: "호스트와 연락은 어떻게 하나요?", a: "예약이 확정되면 '메시지' 탭에서 호스트와 1:1 대화방이 열립니다. 투어 장소, 준비물, 시간 등 궁금한 점을 자유롭게 물어보세요." },
        { q: "투어 당일 지각하면 어떻게 되나요?", a: "투어는 정해진 시간에 출발하므로 지각 시 참여가 어려울 수 있으며, 이 경우 당일 취소로 간주되어 환불이 불가합니다. 늦을 것 같다면 반드시 호스트에게 미리 연락해 주세요." },
        { q: "식사나 음료 비용은 포함인가요?", a: "대부분의 투어에는 식비가 포함되어 있지 않습니다. 현지 맛집을 탐방하며 각자 주문한 메뉴를 결제하거나, 호스트가 먼저 결제하고 투어 종료 시 정산(더치페이)하는 방식을 주로 사용합니다. 예약 전 '포함 사항'을 꼭 확인해 주세요." },
        { q: "사진 촬영이 가능한가요?", a: "자유롭게 촬영하셔도 좋습니다! 호스트에게 인생샷을 부탁해 보세요. 단, 미술관 내부나 특정 상점 등 촬영이 제한된 구역에서는 호스트의 안내를 따라 주시고, 타인의 초상권은 지켜주시는 센스 부탁드립니다." },
        { q: "고령자나 아이도 참여할 수 있나요?", a: "네, 남녀노소 누구나 환영합니다. 다만 많이 걷는 투어거나 술을 마시는 투어의 경우 제한이 있을 수 있습니다. 동반자가 있다면 호스트에게 미리 메시지를 보내주세요. 걷기 편한 코스로 조정하거나 아이를 위한 배려를 준비해 드릴 수 있습니다." },
        { q: "투어 중 화장실 이용이나 휴식은?", a: "로컬리 투어는 패키지여행처럼 빡빡하지 않습니다. 걷다가 힘들거나 화장실이 급하면 언제든 호스트에게 말씀해 주세요. 현지인만 아는 깨끗한 화장실 위치나 분위기 좋은 벤치에서 잠시 쉬어갈 수 있습니다." }
      ]
    },
    {
      category: '취소 및 환불 (Cancellation & Refund)',
      icon: <ShieldCheck size={24} strokeWidth={1.5}/>,
      items: [
        { q: "투어 당일 지각하면 어떻게 되나요?", a: "투어는 정해진 시간에 출발하므로 늦으실 경우 참여가 어려울 수 있습니다. (당일 취소/환불 불가) 약속 시간 10분 전 도착을 권장하며, 늦을 것 같다면 반드시 호스트에게 미리 연락해 주세요." },
        { q: "우천 시 투어는 어떻게 되나요?", a: "약한 비에는 낭만적인 우중 투어로 진행됩니다. 하지만 태풍 등 안전이 우려되는 악천후 시에는 호스트 판단하에 취소될 수 있으며, 이 경우 수수료 없이 100% 전액 환불해 드립니다." },
        { q: "환불 규정이 궁금해요.", a: "투어일 기준 20일 전 100%, 7일 전 70%, 1일 전 40% 환불되며 당일 취소는 환불이 불가합니다. 호스트 사유로 취소될 경우 시점에 관계없이 전액 환불됩니다." },
        { q: "예약을 취소하면 언제 환불되나요?", a: "취소 요청 후 시스템에서 처리가 완료되면 즉시 카드사로 취소 요청이 전송됩니다. 카드사에 따라 영업일 기준 3~5일 정도 소요될 수 있습니다. 체크카드의 경우 보통 2일 이내에 입금됩니다." },
        { q: "날짜 변경은 가능한가요?", a: "예약 확정 후 날짜 변경은 원칙적으로 불가능하며, 기존 예약을 취소하고 다시 예약하셔야 합니다. 이 경우 기존 예약 취소 시점에 따른 환불 수수료가 발생할 수 있으니 주의해 주세요." }
      ]
    },
    {
      category: '계정 관리 (Account)',
      icon: <User size={24} strokeWidth={1.5}/>,
      items: [
        { q: "호스트는 믿을 수 있는 사람인가요?", a: "로컬리의 모든 호스트는 엄격한 신원 인증(본인 확인, 전화번호 인증, 계좌 점유 인증)을 거칩니다. 또한, 실제 투어 참여 게스트들의 솔직한 후기로 평판이 투명하게 관리되고 있어 안심하셔도 됩니다." },
        { q: "비밀번호를 잊어버렸어요.", a: "로그인 화면 하단의 '비밀번호 찾기'를 통해 이메일 인증 후 재설정하실 수 있습니다." },
        { q: "회원 탈퇴는 어떻게 하나요?", a: "마이페이지 > 계정 설정 하단에서 탈퇴 가능합니다. 탈퇴 시 모든 여행 기록과 쿠폰은 소멸되며 복구할 수 없습니다." }
      ]
    }
  ],
  host: [
    {
      category: '호스트 시작하기 (Start)',
      icon: <Briefcase size={24} strokeWidth={1.5}/>,
      items: [
        { q: "호스트 등록 조건이 있나요?", a: "자격증은 필요 없습니다! 현지에 거주하며 나만의 취향과 이야기를 공유하고 싶은 분이라면 누구나 환영합니다. 맛집 탐방, 산책, 쇼핑 등 당신의 일상이 누군가에게는 특별한 여행이 됩니다." },
        { q: "등록 비용이 드나요?", a: "아니요, 호스트 등록 및 투어 상품 등록은 전액 무료입니다. 예약이 확정되어 수익이 발생할 때만 소정의 수수료가 부과됩니다." },
        { q: "수수료는 얼마인가요?", a: "로컬리 플랫폼 수수료는 예약 금액의 20%입니다. 이 수수료에는 결제 대행 수수료, 서버 유지비, 마케팅 비용, 세금, 부가 비용 등이 포함되어 있습니다." },
        { q: "수익은 얼마나 되나요?", a: "투어 요금은 호스트님이 직접 설정합니다. 인기 호스트의 경우 월 수백만 원의 부수입을 올리기도 합니다. 로컬리 수수료(20%)를 제외한 금액이 정산됩니다." },
        { q: "외국어를 잘해야 하나요?", a: "외국인 대상 투어라면 필수지만, 한국인 여행자를 대상으로 한다면 한국어만 하셔도 충분합니다. 언어 능력보다는 친절함과 현지 지식이 더 중요합니다." },
        { q: "어떤 투어를 만들 수 있나요?", a: "맛집 투어, 골목 산책, 등산, 쿠킹 클래스, 사진 촬영 등 현지에서 할 수 있는 모든 활동이 가능합니다. 거창하지 않아도 됩니다. 현지인만 아는 '진짜' 경험을 공유해 주세요." },
        { q: "프로필 사진은 꼭 본인이어야 하나요?", a: "네, 게스트에게 신뢰를 주기 위해 본인의 얼굴이 잘 나온 사진을 권장합니다. 풍경이나 동물 사진보다는, 호스트님의 밝은 미소가 담긴 사진이 예약률을 높이는 데 도움이 됩니다." },
        { q: "정산은 언제 되나요?", a: "투어가 완료된 날짜를 기준으로, 4주 후 등록하신 계좌로 일괄 입금됩니다. (공휴일인 경우 그 다음 영업일 지급)" },
        { q: "해외 거주자도 등록 가능한가요?", a: "네, 전 세계 어디서든 로컬리 호스트로 활동하실 수 있습니다. 해외 계좌로 정산을 받으실 경우 페이팔(PayPal), 라인(Line), 또는 와이즈(Wise) 연동이 필요할 수 있습니다." }
      ]
    },
    {
      category: '운영 노하우 (Operation)',
      icon: <Calendar size={24} strokeWidth={1.5}/>,
      items: [
        { q: "일정 관리는 어떻게 하나요?", a: "호스트 대시보드에서 가능한 날짜와 시간만 열어두시면 됩니다. 본업이 바쁠 때는 언제든 예약을 막아두실 수 있어 유연한 활동이 가능합니다." },
        { q: "최소 출발 인원은 어떻게 설정하나요?", a: "상품 등록 시 ‘1인 출발 확정 금액’을 설정할 수 있습니다." },
        { q: "게스트와 연락은 어떻게 하나요?", a: "개인 연락처 노출 없이, 로컬리 앱 내 '1:1 메시지' 기능을 통해 안전하게 소통합니다. 예약 확정 전에도 문의 메시지를 받을 수 있습니다." },
        { q: "노쇼(No-Show)가 발생하면요?", a: "걱정 마세요. 예약 확정 시 결제가 완료되므로, 게스트가 나타나지 않더라도 규정에 따라 정산금을 지급받으실 수 있습니다." }
        { q: "진상 게스트는 어떻게 대처하나요?", a: "투어 진행 중 무례하거나 안전을 위협하는 행동을 하는 게스트가 있다면 즉시 로컬리 고객센터로 신고해 주세요. 사실 확인 후 해당 게스트의 이용 제한 조치를 취하며, 호스트님을 보호하기 위해 최선을 다하겠습니다." }
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