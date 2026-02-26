'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat';
import UserProfileModal from '@/app/components/UserProfileModal';
import { Send, ShieldCheck, User, Loader2, ImagePlus, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
  } = useChat('host');

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const guestIdFromUrl = searchParams.get('guestId');

  const [modalUserId, setModalUserId] = useState<string | null>(null);

  // 자동 채팅방 열기 (URL 파라미터)
  useEffect(() => {
    if (guestIdFromUrl && inquiries.length > 0) {
      const targetInquiry = inquiries.find(inq =>
        String(inq.user_id) === String(guestIdFromUrl) ||
        String(inq.guest?.id) === String(guestIdFromUrl)
      );
      if (targetInquiry && selectedInquiry?.id !== targetInquiry.id) {
        loadMessages(targetInquiry.id);
      }
    }
  }, [guestIdFromUrl, inquiries, loadMessages, selectedInquiry]);

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
    <div className="flex gap-0 md:gap-4 h-full w-full relative min-h-0">
      <UserProfileModal
        userId={modalUserId || ''}
        isOpen={!!modalUserId}
        onClose={() => setModalUserId(null)}
        role="guest"
      />

      {/* ── 좌측: 문의 목록 ── */}
      <div className={`
        w-full md:w-[320px] lg:w-[380px] md:border md:border-slate-200 md:rounded-2xl
        flex flex-col overflow-hidden shrink-0
        ${selectedInquiry ? 'hidden md:flex' : 'flex flex-1'}
      `}>
        {/* 데스크탑 헤더 */}
        <div className="hidden md:flex items-center px-4 py-3 border-b border-slate-100 bg-white shrink-0">
          <span className="font-bold text-slate-800">문의 목록</span>
        </div>

        {/* 목록 스크롤 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-10 text-center text-slate-400 text-sm">로딩 중...</div>
          )}
          {!isLoading && inquiries.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-sm">문의가 없습니다.</div>
          )}
          {inquiries.map((inq) => {
            const lastTime = inq.updated_at
              ? new Date(inq.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div
                key={inq.id}
                onClick={() => loadMessages(inq.id)}
                className={`relative px-4 py-3.5 cursor-pointer flex gap-3 items-center border-b border-gray-100 last:border-b-0 transition-colors active:bg-gray-50 ${selectedInquiry?.id === inq.id ? 'bg-gray-50' : 'bg-white'}`}
              >
                {/* 아바타 */}
                <div className="w-11 h-11 rounded-full shrink-0 overflow-hidden relative bg-slate-100 border border-slate-200">
                  <Image
                    src={secureUrl(inq.guest?.avatar_url)}
                    alt="guest"
                    fill
                    className="object-cover"
                  />
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`text-[14px] truncate pr-2 ${inq.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                      {inq.guest?.name || '게스트'}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{lastTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[12px] text-gray-500 truncate flex-1">{inq.content}</span>
                    {inq.unread_count > 0 && (
                      <span className="shrink-0 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {inq.unread_count > 9 ? '9+' : inq.unread_count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 truncate block">{inq.experiences?.title}</span>
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
            <div className="px-3 py-2.5 md:px-4 md:py-3 border-b border-gray-100 flex items-center gap-2.5 bg-white shrink-0">
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
                <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200 relative shrink-0">
                  <Image
                    src={secureUrl(selectedInquiry.guest?.avatar_url)}
                    alt="guest"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[14px] leading-tight truncate">
                    {selectedInquiry.guest?.name || '게스트'}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{selectedInquiry.experiences?.title}</div>
                </div>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50" ref={scrollRef}>
              {messages.map((msg) => {
                const isMe = String(msg.sender_id) === String(currentUser?.id);
                return (
                  <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div
                        className="flex flex-col items-center mr-1.5 cursor-pointer"
                        onClick={() => setModalUserId(msg.sender_id)}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden relative border border-gray-200 shrink-0">
                          <Image
                            src={secureUrl(selectedInquiry.guest?.avatar_url)}
                            alt="guest"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
                      {!isMe && (
                        <span
                          className="text-[10px] text-gray-500 mb-0.5 ml-0.5 cursor-pointer"
                          onClick={() => setModalUserId(msg.sender_id)}
                        >
                          {selectedInquiry.guest?.name || '게스트'}
                        </span>
                      )}

                      <div className="flex items-end gap-1.5">
                        {isMe && (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[9px] font-bold text-blue-500">{msg.is_read ? '' : '1'}</span>
                            <span className="text-[9px] text-gray-400" suppressHydrationWarning>{formatTime(msg.created_at)}</span>
                          </div>
                        )}

                        <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm break-words ${isMe
                          ? 'bg-black text-white rounded-tr-sm'
                          : 'bg-white border border-gray-200 rounded-tl-sm'
                          }`}>
                          {msg.type === 'image' && msg.image_url && (
                            <div className="mb-1 rounded-lg overflow-hidden">
                              <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
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
                          <span className="text-[9px] text-gray-400 mb-0.5 shrink-0" suppressHydrationWarning>
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
            <div className="px-3 py-2.5 bg-white border-t border-gray-100 flex items-center gap-2 shrink-0">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="h-9 w-9 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-30"
              >
                <ImagePlus size={16} />
              </button>

              <input
                className="flex-1 h-10 border border-gray-200 rounded-full px-4 text-[13px] focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 disabled:cursor-not-allowed"
                placeholder="답장 입력..."
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
                className="h-9 w-9 flex items-center justify-center bg-black text-white rounded-full hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
              >
                {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center text-slate-400 flex-col gap-2">
            <div className="p-4 bg-slate-50 rounded-full"><User size={28} className="text-slate-300" /></div>
            <p className="text-sm">대화를 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
