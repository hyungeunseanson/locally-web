'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat';
import UserProfileModal from '@/app/components/UserProfileModal';
import { Send, User, Loader2, ImagePlus, ArrowLeft } from 'lucide-react';
import Spinner from '@/app/components/ui/Spinner';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { detectChatPolicySignals } from '@/app/utils/chatPolicySignals';
import {
  isDeletedInquiryMessage,
  isOfficialInquirySupportMessage,
  shouldApplyChatPolicySignals,
} from '@/app/utils/inquiry';
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

export default function InquiryChat() {
  const {
    inquiries,
    selectedInquiry,
    messages,
    currentUser,
    loadMessages,
    sendMessage,
    clearSelected,
    isLoading,
    refresh,
  } = useChat('host');

  const { t, lang } = useLanguage();

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useAutoResizeTextarea(replyText);
  const activeMessageThreadRef = useRef<string | null>(null);
  const hasPrimedThreadMessagesRef = useRef(false);
  const previousMessageIdsRef = useRef<string[]>([]);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const inquiryIdFromUrl = searchParams.get('inquiryId');
  const guestIdFromUrl = searchParams.get('guestId');
  const expIdFromUrl = searchParams.get('expId');
  const [pendingChatCreated, setPendingChatCreated] = useState(false);
  const chatPolicySignals = useMemo(
    () => shouldApplyChatPolicySignals(selectedInquiry?.type)
      ? detectChatPolicySignals(replyText)
      : { matched: false, categories: [] },
    [replyText, selectedInquiry?.type]
  );
  const chatPolicyWarningCopy = CHAT_POLICY_WARNING_COPY[lang] ?? CHAT_POLICY_WARNING_COPY.ko;

  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<string[]>([]);

  useEffect(() => {
    setPendingChatCreated(false);
  }, [guestIdFromUrl, expIdFromUrl, inquiryIdFromUrl]);

  // 자동 채팅방 열기 (URL 파라미터)
  useEffect(() => {
    if (isLoading) return;

    if (inquiryIdFromUrl) {
      const targetById = inquiries.find(inq => String(inq.id) === String(inquiryIdFromUrl));
      if (targetById && selectedInquiry?.id !== targetById.id) {
        loadMessages(targetById.id);
      }
      return;
    }

    if (!guestIdFromUrl) return;

    const targetInquiry = inquiries.find(inq =>
      String(inq.user_id) === String(guestIdFromUrl) ||
      String(inq.guest?.id) === String(guestIdFromUrl)
    );

    if (targetInquiry && selectedInquiry?.id !== targetInquiry.id) {
      loadMessages(targetInquiry.id);
    } else if (!targetInquiry && expIdFromUrl && !pendingChatCreated) {
      // 기존 문의 없음 → 서버 API로 문의방 생성 후 자동 연결
      setPendingChatCreated(true);
      fetch('/api/host/start-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guestIdFromUrl, expId: expIdFromUrl }),
      })
        .then(r => r.json())
        .then(result => {
          if (result.inquiryId) {
            refresh(); // inquiries 갱신 → useEffect 재실행 → targetInquiry 발견 → loadMessages
          }
        })
        .catch(err => console.error('[InquiryChat] start-chat error:', err));
    }
  }, [guestIdFromUrl, expIdFromUrl, inquiryIdFromUrl, inquiries, selectedInquiry, isLoading, pendingChatCreated, loadMessages, refresh]);

  // 스크롤 자동 하단 이동
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

  const secureUrl = (url: string | null | undefined) => {
    if (!url) return '/images/logo.png';
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const formatInquiryTimestamp = (dateString?: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWaitingHours = (dateString?: string | null) => {
    if (!dateString) return 0;
    return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60));
  };

  const replyNeededInquiries = useMemo(
    () => inquiries.filter((inquiry) => inquiry.unread_count > 0),
    [inquiries]
  );
  const oldestReplyNeededInquiry = useMemo(() => {
    if (replyNeededInquiries.length === 0) return null;
    return [...replyNeededInquiries]
      .filter((inquiry) => inquiry.updated_at)
      .sort((a, b) => new Date(a.updated_at || '').getTime() - new Date(b.updated_at || '').getTime())[0] || null;
  }, [replyNeededInquiries]);

  const handleSend = async (file?: File) => {
    if (!selectedInquiry || isSending) return;
    if (!replyText.trim() && !file) return;
    const draftText = replyText;
    const shouldOptimisticallyClear = !file && draftText.trim().length > 0;
    setIsSending(true);
    if (shouldOptimisticallyClear) {
      setReplyText('');
    }
    try {
      await sendMessage(selectedInquiry.id, replyText, file);
      if (!shouldOptimisticallyClear) {
        setReplyText('');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to send', err);
      if (shouldOptimisticallyClear) {
        setReplyText(draftText);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSend(file);
  };

  return (
    <div className="flex gap-0 md:gap-6 h-full w-full relative min-h-0 md:h-[min(780px,calc(100vh-220px))]">
      <UserProfileModal
        userId={modalUserId || ''}
        isOpen={!!modalUserId}
        onClose={() => setModalUserId(null)}
        role="guest"
      />

      {/* ── 좌측: 문의 목록 ── */}
      <div className={`
        w-full md:w-[340px] lg:w-[420px] md:border md:border-slate-200 md:rounded-2xl
        flex flex-col overflow-hidden shrink-0
        ${selectedInquiry ? 'hidden md:flex' : 'flex flex-1'}
      `}>
        {/* 데스크탑 헤더 */}
        <div className="hidden md:flex items-center px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <span className="font-bold text-[16px] text-slate-800">{t('hd_inbox_title')}</span>
        </div>

        {replyNeededInquiries.length > 0 && (
          <div className="border-b border-amber-100 bg-white px-4 py-3 md:px-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="text-[12px] font-semibold leading-5 text-amber-900">
                {t('host_inquiry_warning_strip')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-800">
                <span className="rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 font-semibold">
                  {t('host_inquiry_waiting_count')} {replyNeededInquiries.length}
                </span>
                {oldestReplyNeededInquiry?.updated_at && (
                  <span className="rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 font-semibold">
                    {t('host_inquiry_oldest_waiting')} {formatInquiryTimestamp(oldestReplyNeededInquiry.updated_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 목록 스크롤 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-10 text-center text-slate-400 text-sm md:text-base"><Spinner size={24} /></div>
          )}
          {!isLoading && inquiries.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-sm md:text-base">문의가 없습니다.</div>
          )}
          {inquiries.map((inq) => {
            const lastTime = inq.updated_at
              ? new Date(inq.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
              : '';
            const waitingHours = getWaitingHours(inq.updated_at);
            return (
              <div
                key={inq.id}
                onClick={() => loadMessages(inq.id)}
                className={`relative px-4 md:px-5 py-3.5 md:py-4 cursor-pointer flex gap-3 md:gap-3.5 items-center border-b border-gray-100 last:border-b-0 transition-colors active:bg-gray-50 ${selectedInquiry?.id === inq.id ? 'bg-gray-50' : 'bg-white'}`}
              >
                {/* 아바타 */}
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-full shrink-0 overflow-hidden relative bg-slate-100 border border-slate-200">
                  {inq.guest?.avatar_url
                    ? <Image src={secureUrl(inq.guest.avatar_url)!} alt="guest" fill sizes="(max-width: 768px) 44px, 48px" unoptimized className="object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User size={18} className="text-slate-400" /></div>
                  }
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <div className="flex min-w-0 items-center gap-1.5 pr-2">
                      <span className={`text-[14px] md:text-[15px] truncate ${inq.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {inq.guest?.name || '게스트'}
                      </span>
                      {inq.unread_count > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                          {t('host_inquiry_reply_needed_badge')}
                        </span>
                      )}
                      {inq.unread_count > 0 && waitingHours >= 12 && (
                        <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                          {t('host_inquiry_priority_badge')}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] md:text-[11px] text-gray-400 shrink-0">{lastTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[12px] md:text-[13px] text-gray-500 truncate flex-1">{inq.content}</span>
                    {inq.unread_count > 0 && (
                      <span className="shrink-0 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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

      {/* ── 우측: 채팅창 ── */}
      <div className={`
        flex-1 flex flex-col min-h-0
        md:border md:border-slate-200 md:rounded-2xl md:ml-0
        overflow-hidden bg-white
        ${!selectedInquiry
          ? 'hidden md:flex'
          : 'fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+8px)] bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] z-[105] flex md:static md:inset-auto md:bottom-auto md:top-auto md:z-auto'
        }
      `}>
        {selectedInquiry ? (
          <>
            {/* 채팅 헤더 */}
            <div className="px-3 py-2.5 md:px-5 md:py-4 border-b border-gray-100 flex items-center gap-2.5 md:gap-3 bg-white shrink-0">
              {/* 뒤로가기 */}
              <button
                className="md:hidden p-1.5 -ml-0.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                aria-label={t('button_back')}
                onClick={() => {
                  clearSelected();
                  if (guestIdFromUrl || inquiryIdFromUrl) {
                    router.replace(`${pathname}?tab=inquiries`, { scroll: false });
                  }
                }}
              >
                <ArrowLeft size={18} className="text-gray-700" />
              </button>
              {/* 게스트 정보 */}
              <div
                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                onClick={() => setModalUserId(selectedInquiry.user_id)}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200 relative shrink-0">
                  {selectedInquiry.guest?.avatar_url
                    ? <Image src={secureUrl(selectedInquiry.guest.avatar_url)!} alt="guest" fill sizes="(max-width: 768px) 32px, 40px" unoptimized className="object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User size={14} className="text-slate-400" /></div>
                  }
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[14px] md:text-[15px] leading-tight truncate">
                    {selectedInquiry.guest?.name || '게스트'}
                  </div>
                  <div className="text-[11px] md:text-[12px] text-gray-500 truncate">{selectedInquiry.experiences?.title}</div>
                </div>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4 space-y-3 md:space-y-4 bg-gray-50" ref={scrollRef}>
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
                        data-testid={`host-inquiry-message-sender-${msg.id}`}
                        className={`flex flex-col items-center mr-1.5 ${isOfficialSupport ? '' : 'cursor-pointer'}`}
                        onClick={isOfficialSupport ? undefined : () => setModalUserId(msg.sender_id)}
                      >
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-200 overflow-hidden relative border border-gray-200 shrink-0">
                          {isOfficialSupport
                            ? <Image src={OFFICIAL_SUPPORT_AVATAR_SRC} alt="Locally support" fill sizes="(max-width: 768px) 28px, 32px" unoptimized className="object-cover" />
                            : selectedInquiry.guest?.avatar_url
                            ? <Image src={secureUrl(selectedInquiry.guest.avatar_url)!} alt="guest" fill sizes="(max-width: 768px) 28px, 32px" unoptimized className="object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><User size={12} className="text-slate-400" /></div>
                          }
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%] md:max-w-[76%]`}>
                      {!isMe && (
                        <span
                          className={`text-[10px] md:text-[11px] text-gray-500 mb-0.5 ml-0.5 ${isOfficialSupport ? '' : 'cursor-pointer'}`}
                          onClick={isOfficialSupport ? undefined : () => setModalUserId(msg.sender_id)}
                        >
                          {isOfficialSupport ? OFFICIAL_SUPPORT_SENDER_NAME : (selectedInquiry.guest?.name || '게스트')}
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

                        <div className={`px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-[13px] md:text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap break-words ${isDeletedMessage
                          ? 'bg-slate-100 border border-dashed border-slate-300 text-slate-500 italic'
                          : isMe
                            ? 'bg-black text-white rounded-tr-sm'
                            : 'bg-white border border-gray-200 rounded-tl-sm'
                          }`}>
                          {msg.type === 'image' && msg.image_url && (
                            <div className="mb-1 rounded-lg overflow-hidden">
                              <a href={msg.image_url} rel="noopener noreferrer">
                                <Image
                                  src={msg.image_url}
                                  alt="chat-img"
                                  width={240}
                                  height={240}
                                  unoptimized
                                  className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                                />
                              </a>
                            </div>
                          )}
                          {msg.content}
                        </div>

                        {!isMe && (
                          <span className="text-[9px] md:text-[10px] text-gray-400 mb-0.5 shrink-0" suppressHydrationWarning>
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 입력 바 */}
            <div className="px-3 py-2.5 md:px-5 md:py-3 bg-white border-t border-gray-100 shrink-0">
              {chatPolicySignals.matched && (
                <div className="mb-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                  <div className="text-[11px] md:text-[12px] font-bold text-rose-700">{chatPolicyWarningCopy.title}</div>
                  <div className="mt-0.5 text-[10px] md:text-[11px] text-rose-600">{chatPolicyWarningCopy.body}</div>
                </div>
              )}
              <div className="flex items-end gap-2 md:gap-3">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-30"
              >
                <ImagePlus size={16} />
              </button>

              <textarea
                ref={composerRef}
                rows={1}
                data-testid="host-chat-composer"
                className="flex-1 min-h-10 md:min-h-11 max-h-28 resize-none overflow-y-hidden border border-gray-200 rounded-[20px] md:rounded-[22px] px-4 md:px-5 py-2 md:py-2.5 text-[13px] md:text-[14px] leading-5 md:leading-6 focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 disabled:cursor-not-allowed"
                placeholder={t('hp_inbox_reply_ph')}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={isSending}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={(!replyText.trim()) || isSending}
                className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center bg-black text-white rounded-full hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
              >
                {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center text-slate-400 flex-col gap-2">
            <div className="p-4 bg-slate-50 rounded-full"><User size={28} className="text-slate-300" /></div>
            <p className="text-sm md:text-base">{t('hd_inbox_select')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
