'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat';
import UserProfileModal from '@/app/components/UserProfileModal';
import { Send, User, Loader2, ImagePlus, ArrowLeft } from 'lucide-react';
import Spinner from '@/app/components/ui/Spinner';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';

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

  const { t } = useLanguage();

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const guestIdFromUrl = searchParams.get('guestId');
  const expIdFromUrl = searchParams.get('expId');
  const [pendingChatCreated, setPendingChatCreated] = useState(false);

  const [modalUserId, setModalUserId] = useState<string | null>(null);

  // 자동 채팅방 열기 (URL 파라미터)
  useEffect(() => {
    if (!guestIdFromUrl || isLoading) return;

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
  }, [guestIdFromUrl, expIdFromUrl, inquiries, selectedInquiry, isLoading, pendingChatCreated, loadMessages, refresh]);

  // 스크롤 자동 하단 이동
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const secureUrl = (url: string | null | undefined) => {
    if (!url) return '/images/logo.png';
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const handleSend = async (file?: File) => {
    if (!selectedInquiry || isSending) return;
    if (!replyText.trim() && !file) return;
    setIsSending(true);
    try {
      await sendMessage(selectedInquiry.id, replyText, file);
      setReplyText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to send', err);
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
            return (
              <div
                key={inq.id}
                onClick={() => loadMessages(inq.id)}
                className={`relative px-4 md:px-5 py-3.5 md:py-4 cursor-pointer flex gap-3 md:gap-3.5 items-center border-b border-gray-100 last:border-b-0 transition-colors active:bg-gray-50 ${selectedInquiry?.id === inq.id ? 'bg-gray-50' : 'bg-white'}`}
              >
                {/* 아바타 */}
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-full shrink-0 overflow-hidden relative bg-slate-100 border border-slate-200">
                  {inq.guest?.avatar_url
                    ? <Image src={secureUrl(inq.guest.avatar_url)!} alt="guest" fill className="object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User size={18} className="text-slate-400" /></div>
                  }
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`text-[14px] md:text-[15px] truncate pr-2 ${inq.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                      {inq.guest?.name || '게스트'}
                    </span>
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
                onClick={() => {
                  clearSelected();
                  if (guestIdFromUrl) {
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
                    ? <Image src={secureUrl(selectedInquiry.guest.avatar_url)!} alt="guest" fill className="object-cover" />
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
                return (
                  <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div
                        className="flex flex-col items-center mr-1.5 cursor-pointer"
                        onClick={() => setModalUserId(msg.sender_id)}
                      >
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-200 overflow-hidden relative border border-gray-200 shrink-0">
                          {selectedInquiry.guest?.avatar_url
                            ? <Image src={secureUrl(selectedInquiry.guest.avatar_url)!} alt="guest" fill className="object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><User size={12} className="text-slate-400" /></div>
                          }
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%] md:max-w-[76%]`}>
                      {!isMe && (
                        <span
                          className="text-[10px] md:text-[11px] text-gray-500 mb-0.5 ml-0.5 cursor-pointer"
                          onClick={() => setModalUserId(msg.sender_id)}
                        >
                          {selectedInquiry.guest?.name || '게스트'}
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

                        <div className={`px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-[13px] md:text-[14px] leading-relaxed shadow-sm break-words ${isMe
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
            <div className="px-3 py-2.5 md:px-5 md:py-3 bg-white border-t border-gray-100 flex items-center gap-2 md:gap-3 shrink-0">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-30"
              >
                <ImagePlus size={16} />
              </button>

              <input
                className="flex-1 h-10 md:h-11 border border-gray-200 rounded-full px-4 md:px-5 text-[13px] md:text-[14px] focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 disabled:cursor-not-allowed"
                placeholder={t('hp_inbox_reply_ph')}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={isSending}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
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
