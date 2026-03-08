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
  const { t, lang } = useLanguage(); // 🟢 추가
  const pathname = usePathname();
  const supportCopy = (() => {
    if (lang === 'en') {
      return {
        noAdmin: 'There is no available support manager right now.',
        submitSuccess: 'Your inquiry has been received.',
        submitFailPrefix: 'Failed to submit inquiry: ',
        profileSyncDelay: 'Account sync is delayed. Please try again in 5 seconds.',
        unknownError: 'Unknown error',
        closeSr: 'Close',
        modalTitle: 'Contact Support',
        modalDesc: 'Our team will review it and reply in your inbox.',
        modalPlaceholder: 'Please enter your inquiry.',
        modalSubmitting: 'Sending...',
        modalSubmit: 'Send inquiry',
      };
    }

    if (lang === 'ja') {
      return {
        noAdmin: '現在対応可能なサポート担当者がいません。',
        submitSuccess: 'お問い合わせを受け付けました。',
        submitFailPrefix: 'お問い合わせ受付失敗: ',
        profileSyncDelay: 'アカウント同期が遅れています。5秒後にもう一度お試しください。',
        unknownError: '不明なエラー',
        closeSr: '閉じる',
        modalTitle: '1:1 お問い合わせ',
        modalDesc: '担当者が確認後、メッセージボックスで返信します。',
        modalPlaceholder: 'お問い合わせ内容を入力してください。',
        modalSubmitting: '送信中...',
        modalSubmit: 'お問い合わせ送信',
      };
    }

    if (lang === 'zh') {
      return {
        noAdmin: '当前没有可处理咨询的客服人员。',
        submitSuccess: '咨询已提交。',
        submitFailPrefix: '咨询提交失败：',
        profileSyncDelay: '账号同步稍有延迟，请在 5 秒后重试。',
        unknownError: '未知错误',
        closeSr: '关闭',
        modalTitle: '1:1 咨询',
        modalDesc: '管理员确认后会在消息箱中回复您。',
        modalPlaceholder: '请输入咨询内容。',
        modalSubmitting: '发送中...',
        modalSubmit: '提交咨询',
      };
    }

    return {
      noAdmin: '현재 상담 가능한 관리자가 없습니다.',
      submitSuccess: '문의가 접수되었습니다.',
      submitFailPrefix: '문의 접수 실패: ',
      profileSyncDelay: '계정 동기화에 지연이 발생했습니다. 5초 뒤 다시 시도해 주시기 바랍니다.',
      unknownError: '알 수 없는 오류',
      closeSr: '닫기',
      modalTitle: '1:1 문의하기',
      modalDesc: '관리자가 확인 후 메시지함으로 답변드립니다.',
      modalPlaceholder: '문의하실 내용을 입력해주세요.',
      modalSubmitting: '전송 중...',
      modalSubmit: '문의 접수',
    };
  })();

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
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpContent, setHelpContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 1:1 문의 제출
  const handleHelpSubmit = async () => {
    if (!helpContent.trim()) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: whitelistEntries, error: whitelistError } = await supabase
        .from('admin_whitelist')
        .select('email');

      if (whitelistError) throw whitelistError;

      const adminEmails = (whitelistEntries || [])
        .map((entry) => entry.email)
        .filter(Boolean);

      if (adminEmails.length === 0) {
        throw new Error(supportCopy.noAdmin);
      }

      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id')
        .in('email', adminEmails);

      if (adminError) throw adminError;
      if (!admins || admins.length === 0) {
        throw new Error(supportCopy.noAdmin);
      }

      const randomAdmin = admins[Math.floor(Math.random() * admins.length)];

      const { data: room, error: roomError } = await supabase
        .from('inquiries')
        .insert({
          host_id: randomAdmin.id,
          user_id: user.id,
          content: helpContent.trim(),
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
          content: helpContent.trim()
        });

      setHelpModalOpen(false);
      setHelpContent('');
      showToast(supportCopy.submitSuccess, 'success');
      router.push(`/guest/inbox?inquiryId=${room.id}`);
    } catch (e: unknown) {
      console.error("문의 접수 실패:", e);
      const dbError = e as { code?: string, message?: string };
      let message = e instanceof Error ? e.message : supportCopy.unknownError;

      if (dbError.code === '23503' && dbError.message?.includes('profiles')) {
        message = supportCopy.profileSyncDelay;
      }

      showToast(supportCopy.submitFailPrefix + message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />

      <main className="max-w-[1040px] mx-auto px-4 md:px-6 py-9 md:py-24">
        <div className="md:hidden mb-4">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* 헤더 섹션 (뉴스룸 스타일) */}
        <div className="text-center mb-10 md:mb-24">
          <h1 className="text-[32px] md:text-6xl lg:text-8xl font-black tracking-tighter leading-tight mb-3 md:mb-8">
            {t('help_title')}
          </h1>
          <div className="relative max-w-2xl mx-auto group">
            <input
              type="text"
              placeholder={t('help_search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 md:h-16 pl-3.5 md:pl-6 pr-11 md:pr-14 bg-white border-b-2 border-gray-300 rounded-none text-[15px] md:text-2xl font-bold placeholder:text-gray-300 focus:outline-none focus:border-black transition-colors"
            />
            <button className="absolute right-0 top-1/2 -translate-y-1/2 p-2">
              <Search className="w-6 h-6 md:w-7 md:h-7 text-gray-400 group-focus-within:text-black transition-colors" />
            </button>
          </div>
        </div>

        {/* 탭 전환 버튼 */}
        <div className="flex justify-center mb-8 md:mb-20">
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
        <div className="space-y-9 md:space-y-20">
          {filteredData.map((category, catIdx) => (
            <div key={catIdx}>
              {/* 카테고리 제목 */}
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-8 border-b border-black pb-2.5 md:pb-4">
                <span className="p-1.5 md:p-2 border border-black rounded-full">{category.icon}</span>
                <h2 className="text-[16px] md:text-2xl font-bold tracking-tight">{category.category}</h2>
              </div>

              {/* 질문 목록 */}
              <div className="space-y-0">
                {category.items.map((item, itemIdx) => {
                  const isOpen = openItems[`${catIdx}-${itemIdx}`];
                  return (
                    <div key={itemIdx} className="border-b border-gray-200">
                      <button
                        onClick={() => toggleItem(catIdx, itemIdx)}
                        className="w-full py-4 md:py-6 flex justify-between items-start text-left group hover:bg-gray-50 transition-colors px-4 -mx-4 rounded-lg"
                      >
                        <span className="text-[13px] md:text-lg font-medium text-[#222222] pr-6 md:pr-8 group-hover:underline decoration-2 underline-offset-4">{item.q}</span>
                        <div className="pt-1 text-gray-400 group-hover:text-black transition-colors">
                          {isOpen ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                        </div>
                      </button>

                      {/* 답변 내용 */}
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 pb-6 md:pb-8' : 'max-h-0 opacity-0'}`}>
                        <div className="px-4 text-[14px] md:text-base text-[#484848] leading-relaxed max-w-3xl font-light">
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
        <div className="mt-20 md:mt-32 bg-[#F7F7F7] p-7 md:p-16 text-center rounded-2xl">
          <h3 className="text-[18px] md:text-3xl font-black mb-2.5 md:mb-4 tracking-tight">{t('help_bottom_title')}</h3>
          <p className="text-[#717171] text-[13px] md:text-base mb-7 md:mb-10 max-w-md mx-auto font-medium">
            {t('help_bottom_desc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-6">
            <button
              onClick={() => setHelpModalOpen(true)}
              className="bg-black text-white px-6 md:px-8 py-3 md:py-4 text-[12px] md:text-[13px] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors flex items-center justify-center gap-2 md:gap-3 shadow-lg"
            >
              <MessageCircle size={18} /> {t('btn_chat_support')}
            </button>
            <a
              href="mailto:help@locally.com"
              className="bg-white border-2 border-black text-black px-6 md:px-8 py-3 md:py-4 text-[12px] md:text-[13px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 md:gap-3"
            >
              <Mail size={18} /> {t('btn_email_us')}
            </a>
          </div>
        </div>
      </main>

      {/* ── 1:1 문의 모달 ── */}
      {helpModalOpen && (
        <div
          className="fixed inset-0 z-[210] bg-black/35 backdrop-blur-[1px] flex items-end md:items-center md:justify-center md:p-4"
          onClick={() => { setHelpModalOpen(false); setHelpContent(''); }}
        >
          <div
            className="w-full h-[88dvh] bg-[#fcfcfc] rounded-t-[28px] px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+16px)] flex flex-col md:h-auto md:max-h-[78dvh] md:max-w-[560px] md:rounded-[28px] md:px-7 md:pt-6 md:pb-6 md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-1">
              <button onClick={() => { setHelpModalOpen(false); setHelpContent(''); }} className="p-1.5 text-slate-600">
                <span className="sr-only">{supportCopy.closeSr}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <h3 className="text-[19px] md:text-[24px] font-medium leading-tight tracking-[-0.01em] mb-1.5">{supportCopy.modalTitle}</h3>
            <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug md:leading-relaxed mb-4 md:mb-5">
              {supportCopy.modalDesc}
            </p>
            <textarea
              value={helpContent}
              onChange={(e) => setHelpContent(e.target.value)}
              placeholder={supportCopy.modalPlaceholder}
              className="w-full h-[122px] md:h-[170px] rounded-2xl border border-slate-300 bg-white px-4 py-3 md:px-5 md:py-4 text-[12px] md:text-[14px] font-normal text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:border-slate-500"
            />
            <div className="mt-auto md:mt-5">
              <button
                onClick={handleHelpSubmit}
                disabled={!helpContent.trim() || isSubmitting}
                className={`w-full rounded-2xl py-3 md:py-3.5 text-[13px] md:text-[15px] font-medium ${
                  !helpContent.trim() || isSubmitting
                    ? 'bg-slate-300 text-slate-50'
                    : 'bg-[#111827] text-white'
                }`}
              >
                {isSubmitting ? supportCopy.modalSubmitting : supportCopy.modalSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
