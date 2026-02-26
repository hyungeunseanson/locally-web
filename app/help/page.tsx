'use client';

import React, { useEffect, useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import {
  Search, ChevronDown, ChevronUp, MessageCircle, Mail,
  User, Briefcase, CreditCard, ShieldCheck, MapPin, Calendar, Globe, ArrowLeft
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가

export default function HelpCenterPage() {
  const { t } = useLanguage(); // 🟢 추가
  const pathname = usePathname();

  // 🟢 FAQ 데이터 (t 함수 사용을 위해 컴포넌트 내부로 이동)
  const FAQ_DATA = {
    guest: [
      {
        category: t('faq_cat_booking'),
        icon: <CreditCard size={24} strokeWidth={1.5} />,
        items: [
          { q: t('q_g_booking_1'), a: t('a_g_booking_1') },
          { q: t('q_g_booking_2'), a: t('a_g_booking_2') },
          { q: t('q_g_booking_3'), a: t('a_g_booking_3') },
          { q: t('q_g_booking_4'), a: t('a_g_booking_4') },
          { q: t('q_g_booking_5'), a: t('a_g_booking_5') }
        ]
      },
      {
        category: t('faq_cat_experience'),
        icon: <MapPin size={24} strokeWidth={1.5} />,
        items: [
          { q: t('q_g_exp_1'), a: t('a_g_exp_1') },
          { q: t('q_g_exp_2'), a: t('a_g_exp_2') },
          { q: t('q_g_exp_3'), a: t('a_g_exp_3') },
          { q: t('q_g_exp_4'), a: t('a_g_exp_4') },
          { q: t('q_g_exp_5'), a: t('a_g_exp_5') },
          { q: t('q_g_exp_6'), a: t('a_g_exp_6') },
          { q: t('q_g_exp_7'), a: t('a_g_exp_7') }
        ]
      },
      {
        category: t('faq_cat_cancellation'),
        icon: <ShieldCheck size={24} strokeWidth={1.5} />,
        items: [
          { q: t('q_g_cancel_1'), a: t('a_g_cancel_1') },
          { q: t('q_g_cancel_2'), a: t('a_g_cancel_2') },
          { q: t('q_g_cancel_3'), a: t('a_g_cancel_3') },
          { q: t('q_g_cancel_4'), a: t('a_g_cancel_4') },
          { q: t('q_g_cancel_5'), a: t('a_g_cancel_5') }
        ]
      },
      {
        category: t('faq_cat_account'),
        icon: <User size={24} strokeWidth={1.5} />,
        items: [
          { q: t('q_g_account_1'), a: t('a_g_account_1') },
          { q: t('q_g_account_2'), a: t('a_g_account_2') },
          { q: t('q_g_account_3'), a: t('a_g_account_3') }
        ]
      }
    ],
    host: [
      {
        category: t('faq_cat_start'),
        icon: <Briefcase size={24} strokeWidth={1.5} />,
        items: [
          { q: t('q_h_start_1'), a: t('a_h_start_1') },
          { q: t('q_h_start_2'), a: t('a_h_start_2') },
          { q: t('q_h_start_3'), a: t('a_h_start_3') },
          { q: t('q_h_start_4'), a: t('a_h_start_4') },
          { q: t('q_h_start_5'), a: t('a_h_start_5') },
          { q: t('q_h_start_6'), a: t('a_h_start_6') },
          { q: t('q_h_start_7'), a: t('a_h_start_7') },
          { q: t('q_h_start_8'), a: t('a_h_start_8') },
          { q: t('q_h_start_9'), a: t('a_h_start_9') }
        ]
      },
      {
        category: t('faq_cat_operation'),
        icon: <Calendar size={24} strokeWidth={1.5} />,
        items: [
          { q: t('q_h_oper_1'), a: t('a_h_oper_1') },
          { q: t('q_h_oper_2'), a: t('a_h_oper_2') },
          { q: t('q_h_oper_3'), a: t('a_h_oper_3') },
          { q: t('q_h_oper_4'), a: t('a_h_oper_4') },
          { q: t('q_h_oper_5'), a: t('a_h_oper_5') }
        ]
      }
    ]
  };
  const [activeTab, setActiveTab] = useState<'guest' | 'host'>(
    pathname?.startsWith('/host') ? 'host' : 'guest'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (pathname?.startsWith('/host')) {
      setActiveTab('host');
    } else {
      setActiveTab('guest');
    }
  }, [pathname]);

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

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(pathname?.startsWith('/host') ? '/host/menu' : '/account');
  };

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
        .maybeSingle();

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

      <main className="max-w-[1040px] mx-auto px-4 md:px-6 py-12 md:py-24">
        <div className="md:hidden mb-6">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* 헤더 섹션 (뉴스룸 스타일) */}
        <div className="text-center mb-12 md:mb-24">
          <h1 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter mb-4 md:mb-8">
            {t('help_title')}
          </h1>
          <div className="relative max-w-2xl mx-auto group">
            <input
              type="text"
              placeholder={t('help_search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 md:h-16 pl-4 md:pl-6 pr-12 md:pr-14 bg-white border-b-2 border-gray-300 rounded-none text-lg md:text-2xl font-bold placeholder:text-gray-300 focus:outline-none focus:border-black transition-colors"
            />
            <button className="absolute right-0 top-1/2 -translate-y-1/2 p-2">
              <Search size={28} className="text-gray-400 group-focus-within:text-black transition-colors" />
            </button>
          </div>
        </div>

        {/* 탭 전환 버튼 */}
        <div className="flex justify-center mb-10 md:mb-20">
          <div className="flex gap-4 md:gap-8 border-b border-gray-200 pb-1">
            <button
              onClick={() => setActiveTab('guest')}
              className={`text-sm md:text-lg font-bold pb-3 md:pb-4 transition-all relative ${activeTab === 'guest' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t('tab_guest')}
              {activeTab === 'guest' && <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-black"></span>}
            </button>
            <button
              onClick={() => setActiveTab('host')}
              className={`text-sm md:text-lg font-bold pb-3 md:pb-4 transition-all relative ${activeTab === 'host' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t('tab_host')}
              {activeTab === 'host' && <span className="absolute bottom-[-5px] left-0 w-full h-[2px] bg-black"></span>}
            </button>
          </div>
        </div>

        {/* FAQ 리스트 */}
        <div className="space-y-12 md:space-y-20">
          {filteredData.map((category, catIdx) => (
            <div key={catIdx}>
              {/* 카테고리 제목 */}
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-8 border-b border-black pb-3 md:pb-4">
                <span className="p-1.5 md:p-2 border border-black rounded-full">{category.icon}</span>
                <h2 className="text-lg md:text-2xl font-bold tracking-tight">{category.category}</h2>
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
                        <span className="text-sm md:text-lg font-medium text-[#222222] pr-6 md:pr-8 group-hover:underline decoration-2 underline-offset-4">{item.q}</span>
                        <div className="pt-1 text-gray-400 group-hover:text-black transition-colors">
                          {isOpen ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
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
          <h3 className="text-xl md:text-3xl font-black mb-3 md:mb-4 tracking-tight">{t('help_bottom_title')}</h3>
          <p className="text-[#717171] mb-10 max-w-md mx-auto font-medium">
            {t('help_bottom_desc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <button
              onClick={handleAdminSupport}
              className="bg-black text-white px-8 py-4 font-bold uppercase tracking-widest hover:bg-[#333] transition-colors flex items-center justify-center gap-3 shadow-lg"
            >
              <MessageCircle size={18} /> {t('btn_chat_support')}
            </button>
            <a
              href="mailto:help@locally.com"
              className="bg-white border-2 border-black text-black px-8 py-4 font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
            >
              <Mail size={18} /> {t('btn_email_us')}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
