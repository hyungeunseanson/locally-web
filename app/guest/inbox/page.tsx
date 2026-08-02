'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import Spinner from '@/app/components/ui/Spinner';
import { Send, User, Loader2, ImagePlus, ArrowLeft, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가 (import 맨 아래)
import { detectChatPolicySignals } from '@/app/utils/chatPolicySignals';
import {
  isAdminSupportInquiry,
  isDeletedInquiryMessage,
  isOfficialInquirySupportMessage,
} from '@/app/utils/inquiry';
import { createClient } from '@/app/utils/supabase/client';
import { getHostPublicProfile } from '@/app/utils/profile';
import { useAutoResizeTextarea } from '@/app/hooks/useAutoResizeTextarea';
import {
  OFFICIAL_SUPPORT_AVATAR_SRC,
  OFFICIAL_SUPPORT_SENDER_NAME,
} from '@/app/utils/officialSender';

const CHAT_POLICY_WARNING_COPY = {
  ko: {
    title: '연락처·외부 링크 공유는 제재 대상입니다.',
    body: '전화번호, 이메일, URL 등이 포함된 메시지는 운영팀에 전달될 수 있습니다.',
  },
  en: {
    title: 'Sharing contact details or external links may lead to penalties.',
    body: 'Messages containing phone numbers, emails, or URLs may be reviewed by the team.',
  },
  ja: {
    title: '連絡先や外部リンクの共有は制裁対象となる場合があります。',
    body: '電話番号、メールアドレス、URL を含むメッセージは運営チームが確認することがあります。',
  },
  zh: {
    title: '分享联系方式或外部链接可能会导致处罚。',
    body: '包含电话号码、邮箱或 URL 的消息可能会被运营团队审核。',
  },
} as const;

function InboxContent() {
  const { t, lang } = useLanguage(); // 🟢 lang 추가 필수!
  const {
    inquiries,
    selectedInquiry,
    messages,
    currentUser,
    loadMessages,
    sendMessage,
    startNewChat,
    createInquiry,
    clearSelected,
    isLoading
  } = useChat('guest');

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useAutoResizeTextarea(inputText);
  const activeMessageThreadRef = useRef<string | null>(null);
  const hasPrimedThreadMessagesRef = useRef(false);
  const previousMessageIdsRef = useRef<string[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const [hostBootstrapSummary, setHostBootstrapSummary] = useState<{ name: string; avatarUrl: string | null } | null>(null);
  const [isBootstrappingHost, setIsBootstrappingHost] = useState(false);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<string[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldRedirectToLogin = !currentUser && !isLoading;

  useEffect(() => {
    if (!shouldRedirectToLogin) return;
    router.replace('/login?returnUrl=%2Fguest%2Finbox');
  }, [router, shouldRedirectToLogin]);

  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/account');
  };

  const hostId = searchParams.get('hostId');
  const expId = searchParams.get('expId');
  const inquiryId = searchParams.get('inquiryId');
  const hostName = searchParams.get('hostName');
  const hostAvatar = searchParams.get('hostAvatar');
  const expTitle = searchParams.get('expTitle');

  const [isUrlProcessed, setIsUrlProcessed] = useState(false);
  const chatPolicySignals = useMemo(() => detectChatPolicySignals(inputText), [inputText]);
  const chatPolicyWarningCopy = CHAT_POLICY_WARNING_COPY[lang] ?? CHAT_POLICY_WARNING_COPY.ko;

  // 🟢 [헬퍼] 보안 이미지 및 시간 포맷
  const secureUrl = (url: string | null | undefined) => {
    if (!url) return "/images/logo.png";
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    // 🟢 언어별 시간 포맷 적용
    const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };
    return new Date(dateString).toLocaleTimeString(localeMap[lang] || 'ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const currentThreadId = selectedInquiry?.id ? String(selectedInquiry.id) : null;

    if (!currentThreadId) {
      activeMessageThreadRef.current = null;
      hasPrimedThreadMessagesRef.current = false;
      previousMessageIdsRef.current = [];
      setAnimatedMessageIds([]);
      return;
    }

    if (activeMessageThreadRef.current !== currentThreadId) {
      activeMessageThreadRef.current = currentThreadId;
      hasPrimedThreadMessagesRef.current = false;
      previousMessageIdsRef.current = [];
      setAnimatedMessageIds([]);
    }

    const currentMessageIds = messages.map((message) => String(message.id));
    if (!hasPrimedThreadMessagesRef.current) {
      previousMessageIdsRef.current = currentMessageIds;
      if (currentMessageIds.length > 0) {
        hasPrimedThreadMessagesRef.current = true;
      }
      return;
    }

    const previousMessageIds = previousMessageIdsRef.current;
    const previousMessageIdSet = new Set(previousMessageIds);
    const nextAnimatedMessageIds = currentMessageIds.filter((messageId) => !previousMessageIdSet.has(messageId));

    previousMessageIdsRef.current = currentMessageIds;
    setAnimatedMessageIds(nextAnimatedMessageIds);
  }, [messages, selectedInquiry?.id]);

  useEffect(() => {
    setIsUrlProcessed(false);
  }, [hostId, expId, inquiryId, hostName, hostAvatar, expTitle]);

  useEffect(() => {
    setHostBootstrapSummary(null);
  }, [hostId]);

  useEffect(() => {
    if (!hostId || (hostName && hostAvatar)) {
      setIsBootstrappingHost(false);
      return;
    }

    let cancelled = false;
    setIsBootstrappingHost(true);

    const loadHostBootstrap = async () => {
      try {
        const [profileRes, hostAppRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .eq('id', hostId)
            .maybeSingle(),
          supabase
            .from('host_applications')
            .select('user_id, name, profile_photo, self_intro, languages, host_nationality')
            .eq('user_id', hostId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const summary = getHostPublicProfile(profileRes.data, hostAppRes.data, hostName || 'Host');
        setHostBootstrapSummary({
          name: summary.name,
          avatarUrl: summary.avatarUrl,
        });
      } catch (error) {
        console.error('[guest inbox] host bootstrap failed:', error);
      } finally {
        if (!cancelled) {
          setIsBootstrappingHost(false);
        }
      }
    };

    void loadHostBootstrap();

    return () => {
      cancelled = true;
    };
  }, [hostAvatar, hostId, hostName, supabase]);

  useEffect(() => {
    if (isLoading || isUrlProcessed) return;

    if (inquiryId) {
      const existingById = inquiries.find(i => String(i.id) === String(inquiryId));
      if (existingById) {
        if (selectedInquiry?.id !== existingById.id) {
          loadMessages(existingById.id);
        }
        setIsUrlProcessed(true);
        return;
      }

      if (!hostId && !expId) {
        setIsUrlProcessed(true);
        return;
      }
    }

    // hostId만 있고 expId 없는 경우: 서비스 매칭 채팅 자동 선택
    if (hostId && !expId) {
      const existing = inquiries.find(i => String(i.host_id) === String(hostId));
      if (existing && selectedInquiry?.id !== existing.id) {
        loadMessages(existing.id);
      }
      setIsUrlProcessed(true);
      return;
    }

    if (!hostId || !expId) {
      setIsUrlProcessed(true);
      return;
    }

    const existing = inquiries.find(
      i => String(i.host_id) === String(hostId) && String(i.experience_id) === String(expId)
    );

    if (existing) {
      if (selectedInquiry?.id !== existing.id) {
        loadMessages(existing.id);
      }
    } else {
      if ((!hostName || !hostAvatar) && isBootstrappingHost) {
        return;
      }
      if (selectedInquiry?.id !== 'new') {
        startNewChat(
          {
            id: hostId,
            name: hostName || hostBootstrapSummary?.name || 'Host',
            avatarUrl: hostAvatar || hostBootstrapSummary?.avatarUrl || undefined,
          },
          { id: expId, title: expTitle || 'Experience' }
        );
      }
    }
    setIsUrlProcessed(true);
  }, [isLoading, inquiries, hostId, expId, inquiryId, hostName, hostAvatar, expTitle, selectedInquiry, loadMessages, startNewChat, isUrlProcessed, hostBootstrapSummary, isBootstrappingHost]);

  const handleSelectInquiry = (inqId: number | string) => {
    loadMessages(inqId);
    if (hostId || expId || inquiryId) router.replace('/guest/inbox');
  };

  const handleSend = async (file?: File) => {
    if (!selectedInquiry || isSending) return;
    if (!inputText.trim() && !file) return;

    const draftText = inputText;
    const shouldOptimisticallyClear = selectedInquiry.id !== 'new' && !file && draftText.trim().length > 0;

    setIsSending(true);
    if (shouldOptimisticallyClear) {
      setInputText('');
    }
    try {
      if (selectedInquiry.id === 'new') {
        if (!selectedInquiry.host_id) {
          throw new Error('관리자 또는 호스트 정보가 없습니다.');
        }
        // 첫 문의 시 텍스트 필수 (이미지는 첫 문의 후 가능하도록 로직 유지 혹은 확장 가능)
        await createInquiry(selectedInquiry.host_id, selectedInquiry.experience_id, inputText);
      } else {
        await sendMessage(selectedInquiry.id, inputText, file);
      }
      if (!shouldOptimisticallyClear) {
        setInputText('');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Failed to send message", error);
      if (shouldOptimisticallyClear) {
        setInputText(draftText);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSend(file);
    }
  };

  const getDisplayHost = (inqOrSelected: {
    id?: string | number;
    host_id?: string | null;
    type?: string | null;
    host?: { id: string | null; name: string; avatar_url: string | null };
  } | null | undefined) => {
    if (isAdminSupportInquiry(inqOrSelected?.type)) {
      return {
        name: t('admin_name'),
        avatar: OFFICIAL_SUPPORT_AVATAR_SRC,
        id: null,
      };
    }
    if (inqOrSelected?.host) {
      return {
        name: inqOrSelected.host.name,
        avatar: inqOrSelected.host.avatar_url,
        id: inqOrSelected.host.id
      };
    }
    if (inqOrSelected?.id === 'new' && inqOrSelected?.host_id === hostId) {
      return {
        name: hostName || hostBootstrapSummary?.name || 'Host',
        avatar: hostAvatar || hostBootstrapSummary?.avatarUrl || null,
        id: hostId,
      };
    }
    return { name: 'Host', avatar: null, id: null };
  };

  const currentHostDisplay = selectedInquiry ? getDisplayHost(selectedInquiry) : { name: '', avatar: null, id: null };
  const selectedIsAdminSupport = isAdminSupportInquiry(selectedInquiry?.type);

  if ((isLoading && !currentUser) || shouldRedirectToLogin) {
    return <Spinner fullScreen />;
  }

  return (
    <div className="h-[100dvh] bg-white text-slate-900 font-sans flex flex-col overflow-hidden">
      <SiteHeader />

      {/* 🟢 데스크탑 제목 — main 밖에 위치해 flex-row 내부 첨범 방지 */}
      <div className="hidden md:block max-w-[1280px] w-full mx-auto px-6 pt-8 pb-0 shrink-0">
        <h1 className="text-[34px] font-black">{t('messages')}</h1>
      </div>

      {/* ── 메인 컨테이너 ── */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto flex flex-col md:flex-row md:px-6 md:py-6 md:gap-0 overflow-hidden min-h-0">

        {/* 제목 (모바일: 목록 화면에서만, 채팅창 열리면 숨김) */}
        {!selectedInquiry && (
          <div className="md:hidden px-4 pt-3 pb-1.5 shrink-0">
            <button
              onClick={handleMobileBack}
              className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
              aria-label={t('button_back')}
            >
              <ArrowLeft className="w-[14px] h-[14px] md:w-4 md:h-4" />
            </button>
            <h1 className="text-[18px] md:text-[20px] font-black tracking-tight mt-1.5 md:mt-2">{t('messages')}</h1>
          </div>
        )}

        {/* ──────────────── 좌측: 채팅 목록 ──────────────── */}
        <div className={`
          w-full md:w-[340px] lg:w-[420px] md:border md:border-slate-200 md:rounded-2xl
          flex flex-col overflow-hidden shrink-0
          ${selectedInquiry ? 'hidden md:flex' : 'flex flex-1'}
        `}>
          {/* 목록 헤더 (데스크탑만) */}
          <div className="hidden md:flex items-center px-5 py-4 border-b border-slate-100 bg-white shrink-0">
            <span className="font-bold text-[16px] text-slate-800">{t('msg_list')}</span>
          </div>

          <div
            data-testid="guest-inbox-guidance-strip"
            className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3 md:px-5"
          >
            <p className="text-[11px] font-bold text-slate-800 md:text-[12px]">{t('guest_inbox_notice_title')}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{t('guest_inbox_notice_desc')}</p>
          </div>

          {/* 목록 스크롤 */}
          <div className="flex-1 overflow-y-auto">
            {inquiries.length === 0 && (
              <div className="flex h-full min-h-[280px] items-center justify-center p-6 md:p-8">
                <div data-testid="guest-inbox-empty-state" className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-[16px] font-bold text-slate-900">{t('guest_inbox_empty_title')}</h2>
                  <p className="mt-2 text-[13px] leading-6 text-slate-500">{t('guest_inbox_empty_desc')}</p>
                  <p className="mt-2 text-[12px] leading-6 text-slate-400">{t('guest_inbox_empty_followup')}</p>
                  <div className="mt-5 flex flex-col gap-2.5">
                    <Link
                      href="/guest/trips"
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-[13px] font-bold text-white transition-colors hover:bg-slate-800"
                    >
                      {t('guest_inbox_empty_primary_cta')}
                    </Link>
                    <Link
                      href="/help"
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {t('guest_inbox_empty_secondary_cta')}
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {inquiries.map((inq) => {
              const display = getDisplayHost(inq);
              const isAdminSupport = isAdminSupportInquiry(inq.type);
              const lastTime = inq.updated_at
                ? new Date(inq.updated_at).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <div
                  key={inq.id}
                  onClick={() => handleSelectInquiry(inq.id)}
                  className={`relative px-3.5 md:px-5 py-3 md:py-4 cursor-pointer flex gap-2.5 md:gap-3.5 items-center border-b border-gray-100 last:border-b-0 transition-colors active:bg-gray-50 ${selectedInquiry?.id === inq.id ? 'bg-gray-50' : 'bg-white'}`}
                >
                  {/* 아바타 */}
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative ${isAdminSupport ? 'bg-white border border-slate-200' : 'bg-gray-100'}`}>
                    {isAdminSupport ? (
                      <Image src={OFFICIAL_SUPPORT_AVATAR_SRC} alt="Locally support" fill sizes="(max-width: 768px) 44px, 48px" unoptimized className="object-cover" />
                    ) : (
                      <Image src={secureUrl(display.avatar)} alt="host" fill sizes="(max-width: 768px) 44px, 48px" unoptimized className="object-cover" />
                    )}
                  </div>

                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-[13px] md:text-[15px] truncate pr-2 ${inq.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {isAdminSupport ? t('admin_name') : display.name}
                      </span>
                      <span className="text-[10px] md:text-[11px] text-gray-400 shrink-0">{lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] md:text-[13px] text-gray-500 truncate flex-1">{inq.content}</span>
                      {inq.unread_count > 0 && (
                        <span className="shrink-0 w-[18px] h-[18px] md:w-5 md:h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {inq.unread_count > 9 ? '9+' : inq.unread_count}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] md:text-[11px] text-gray-400 truncate block">{inq.experiences?.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ──────────────── 우측: 채팅창 ──────────────── */}
        {/* 🟢 이슈8: style={{ height: '100%' }} 제거 — flex-1으로 충분히 높이 결정됨, 인라인 스타일이 오히려 레이아웃 망침 */}
        <div className={`
          flex-1 flex flex-col min-h-0
          md:border md:border-slate-200 md:rounded-2xl md:ml-4
          overflow-hidden bg-white
          ${!selectedInquiry
            ? 'hidden md:flex'
            : 'fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+8px)] bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] z-[105] flex md:static md:inset-auto md:bottom-auto md:top-auto md:z-auto'
          }
        `}>
          {selectedInquiry ? (
            <>
              {/* 채팅 헤더 */}
              <div className="px-2.5 md:px-5 py-2 md:py-3.5 border-b border-gray-100 flex items-center gap-2 md:gap-3 bg-white shrink-0">
                <button
                  className="md:hidden p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                  aria-label={t('button_back')}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelected();
                    router.replace('/guest/inbox', { scroll: false });
                  }}
                >
                  <ArrowLeft className="w-4 h-4 md:w-[18px] md:h-[18px] text-gray-700" />
                </button>
                <div
                  data-testid="guest-inbox-header-profile-trigger"
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200 relative shrink-0">
                    {selectedIsAdminSupport ? (
                      <Image src={OFFICIAL_SUPPORT_AVATAR_SRC} alt="Locally support" fill sizes="(max-width: 768px) 28px, 32px" unoptimized className="object-cover" />
                    ) : (
                      <Image src={secureUrl(currentHostDisplay.avatar)} alt="host" fill sizes="(max-width: 768px) 28px, 32px" unoptimized className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] md:text-[15px] leading-tight truncate">
                      {selectedIsAdminSupport ? t('admin_chat_title') : currentHostDisplay.name}
                    </div>
                    <div className="text-[10px] md:text-[12px] text-gray-500 truncate">{selectedInquiry.experiences?.title}</div>
                  </div>
                </div>
              </div>

              {/* 메시지 영역 */}
              <div
                data-testid="guest-inbox-message-thread"
                className="flex-1 overflow-y-auto px-2.5 md:px-5 py-2.5 md:py-4 space-y-2.5 md:space-y-4 bg-gray-50"
                ref={scrollRef}
              >
                {messages.map((msg) => {
                  const isMe = String(msg.sender_id) === String(currentUser?.id);
                  const isDeletedMessage = isDeletedInquiryMessage(msg.type);
                  const isOfficialSupport = isOfficialInquirySupportMessage({
                    inquiryType: selectedInquiry.type,
                    senderId: msg.sender_id,
                    guestId: selectedInquiry.user_id,
                    hostId: selectedInquiry.host_id,
                  });
                  const shouldAnimateMessage = animatedMessageIds.includes(String(msg.id));
                  return (
                    <div
                      key={msg.id}
                      data-message-id={String(msg.id)}
                      data-official-support={isOfficialSupport ? 'true' : 'false'}
                      className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${shouldAnimateMessage ? `animate-in fade-in duration-300 ${isMe ? 'slide-in-from-right-2' : 'slide-in-from-left-2'}` : ''}`}
                    >
                      {!isMe && (
                        <div
                          data-testid={`guest-inbox-message-sender-trigger-${msg.id}`}
                          className="flex flex-col items-center mr-1.5"
                        >
                          <div className="w-[26px] h-[26px] md:w-7 md:h-7 rounded-full bg-gray-200 overflow-hidden relative border border-gray-200 shrink-0">
                            {selectedIsAdminSupport || isOfficialSupport ? (
                              <Image
                                src={OFFICIAL_SUPPORT_AVATAR_SRC}
                                alt="Locally support"
                                fill
                                sizes="(max-width: 768px) 26px, 28px"
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <Image
                                src={secureUrl(currentHostDisplay.avatar)}
                                alt="sender"
                                fill
                                sizes="(max-width: 768px) 26px, 28px"
                                unoptimized
                                className="object-cover"
                              />
                            )}
                          </div>
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
                        {!isMe && (
                          <span
                            className="text-[10px] md:text-[11px] text-gray-500 mb-0.5 ml-0.5"
                          >
                            {isOfficialSupport
                              ? OFFICIAL_SUPPORT_SENDER_NAME
                              : selectedIsAdminSupport
                                ? t('admin_name')
                                : (msg.sender?.name || currentHostDisplay.name)}
                          </span>
                        )}

                        <div className="flex items-end gap-1.5">
                          {isMe && (
                            <div className="flex flex-col items-end shrink-0">
                              {!msg.is_read ? (
                                <>
                                  <span className="text-[9px] md:text-[10px] font-bold text-blue-500">1</span>
                                  <span className="text-[9px] md:text-[10px] text-gray-400" suppressHydrationWarning>{formatTime(msg.created_at)}</span>
                                </>
                              ) : msg.read_at ? (
                                <span className="text-[9px] md:text-[10px] text-gray-400" suppressHydrationWarning>읽음 {formatTime(msg.read_at)}</span>
                              ) : (
                                <span className="text-[9px] md:text-[10px] text-gray-400" suppressHydrationWarning>{formatTime(msg.created_at)}</span>
                              )}
                            </div>
                          )}

                          <div className={`px-2.5 md:px-4 py-1.5 md:py-2.5 rounded-2xl text-[12px] md:text-[14px] leading-[1.45] md:leading-relaxed shadow-sm whitespace-pre-wrap break-words ${isDeletedMessage
                            ? 'bg-slate-100 border border-dashed border-slate-300 text-slate-500 italic'
                            : isMe
                              ? 'bg-black text-white rounded-tr-sm'
                              : 'bg-white border border-gray-200 rounded-tl-sm'
                            }`}>
                            {msg.type === 'image' && msg.image_url && (
                              <div className="mb-1 rounded-lg overflow-hidden">
                                <a href={msg.image_url} rel="noopener noreferrer">
                                  <Image src={msg.image_url} alt="chat-img" width={240} height={240} unoptimized className="w-full h-auto object-cover hover:opacity-90 transition-opacity" />
                                </a>
                              </div>
                            )}
                            {msg.content}
                          </div>

                          {!isMe && (
                            <span className="text-[9px] md:text-[10px] text-gray-400 mb-0.5 shrink-0" suppressHydrationWarning>{formatTime(msg.created_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 입력 바 */}
              <div className="px-2.5 md:px-5 py-2 md:py-3 bg-white border-t border-gray-100 shrink-0">
                {chatPolicySignals.matched && (
                  <div className="mb-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                    <div className="text-[11px] md:text-[12px] font-bold text-rose-700">{chatPolicyWarningCopy.title}</div>
                    <div className="mt-0.5 text-[10px] md:text-[11px] text-rose-600">{chatPolicyWarningCopy.body}</div>
                  </div>
                )}
                <div className="flex items-end gap-1.5 md:gap-3">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || selectedInquiry.id === 'new'}
                  className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-30"
                >
                  <ImagePlus className="w-[14px] h-[14px] md:w-4 md:h-4" />
                </button>

                <textarea
                  ref={composerRef}
                  rows={1}
                  data-testid="guest-chat-composer"
                  className="flex-1 min-h-9 max-h-28 resize-none overflow-y-hidden border border-gray-200 rounded-[18px] md:rounded-[22px] px-3.5 md:px-5 py-2 md:py-2.5 text-[12px] md:text-[14px] leading-5 md:leading-6 focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 disabled:cursor-not-allowed"
                  placeholder={t('msg_placeholder')}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isSending}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={(!inputText.trim()) || isSending}
                  className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center bg-black text-white rounded-full hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
                >
                  {isSending ? <Loader2 className="animate-spin w-[14px] h-[14px] md:w-[15px] md:h-[15px]" /> : <Send className="w-[14px] h-[14px] md:w-[15px] md:h-[15px]" />}
                </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center text-slate-400 flex-col gap-2">
              <div className="p-4 bg-slate-50 rounded-full"><User size={28} className="text-slate-300" /></div>
              <p className="text-sm md:text-base">{t('msg_select_chat')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function GuestInboxPage() {
  return (
    <Suspense fallback={<Spinner fullScreen />}>
      <InboxContent />
    </Suspense>
  );
}
