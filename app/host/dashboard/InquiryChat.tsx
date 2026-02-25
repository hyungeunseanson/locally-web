'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat';
import UserProfileModal from '@/app/components/UserProfileModal';
import { Send, User, Loader2, ImagePlus, ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

export default function InquiryChat() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('host');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const guestIdFromUrl = searchParams.get('guestId');

  // 자동 채팅방 열기
  useEffect(() => {
    if (guestIdFromUrl && inquiries.length > 0) {
      const targetInquiry = inquiries.find(inq =>
        String(inq.user_id) === String(guestIdFromUrl) ||
        String(inq.guest?.id) === String(guestIdFromUrl)
      );

      if (targetInquiry) {
        if (selectedInquiry?.id !== targetInquiry.id) {
          loadMessages(targetInquiry.id);
        }
      }
    }
  }, [guestIdFromUrl, inquiries, loadMessages, selectedInquiry]);

  const [modalUserId, setModalUserId] = useState<string | null>(null);

  const secureUrl = (url: string | null | undefined) => {
    if (!url) return "/default-avatar.png";
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (file?: File) => {
    if (!selectedInquiry || isSending) return;
    if (!replyText.trim() && !file) return;

    setIsSending(true);
    try {
      await sendMessage(selectedInquiry.id, replyText, file);
      setReplyText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Failed to send", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSend(file);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };

  return (
    <div className="flex gap-0 md:gap-6 h-full min-h-[400px] md:min-h-[600px] w-full relative">
      <UserProfileModal
        userId={modalUserId || ''}
        isOpen={!!modalUserId}
        onClose={() => setModalUserId(null)}
        role="guest"
      />

      {/* 좌측 리스트 (모바일: 전체폭, 데스크탑: 300px) */}
      <div className={`w-full md:w-[300px] shrink-0 md:border-r border-slate-200 md:pr-4 overflow-y-auto max-h-[700px] ${selectedInquiry ? 'hidden md:block' : 'block'}`}>
        {inquiries.length === 0 && <div className="text-slate-400 text-sm text-center py-10">문의가 없습니다.</div>}

        {inquiries.map((inq) => (
          <div
            key={inq.id}
            onClick={() => loadMessages(inq.id)}
            className={`relative p-4 rounded-xl cursor-pointer mb-2 transition-all ${selectedInquiry?.id === inq.id ? 'bg-slate-100 border border-slate-300' : 'hover:bg-slate-50 border border-transparent'
              }`}
          >
            {inq.unread_count > 0 && (
              <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                N
              </div>
            )}

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden relative border border-slate-200 shrink-0">
                <Image
                  src={secureUrl(inq.guest?.avatar_url)}
                  alt="profile"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate text-slate-900">
                  {inq.guest?.name || '게스트'}
                </div>
                <div className="text-xs text-slate-500 truncate">{inq.experiences?.title}</div>
              </div>
            </div>

            <div className="text-sm text-slate-600 line-clamp-2 bg-white/50 p-2 rounded-lg">
              {inq.content}
            </div>
            <div className="text-xs text-slate-400 mt-2 text-right" suppressHydrationWarning>
              {formatDate(inq.updated_at)}
            </div>
          </div>
        ))}
      </div>

      {/* 우측 채팅방 (모바일: 풀스크린 오버레이) */}
      <div className={`${selectedInquiry ? 'absolute inset-0 z-[100] md:relative md:z-auto' : 'hidden md:flex'} flex-1 flex flex-col bg-slate-50 md:rounded-2xl border border-slate-200 overflow-hidden h-full md:h-[700px]`}>
        {selectedInquiry ? (
          <>
            {/* 헤더 */}
            <div
              className="p-3 md:p-4 border-b border-slate-200 bg-white flex items-center gap-3 shadow-sm z-10 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setModalUserId(selectedInquiry.user_id)}
            >
              {/* 모바일 뒤로가기 버튼 */}
              <button
                className="md:hidden p-1.5 -ml-1 hover:bg-slate-100 rounded-full transition-colors"
                onClick={(e) => { e.stopPropagation(); loadMessages(null as any); }}
              >
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <div className="relative w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                <Image
                  src={secureUrl(selectedInquiry.guest?.avatar_url)}
                  alt="guest"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <div className="font-bold text-sm md:text-base text-slate-900">{selectedInquiry.guest?.name || '게스트'}</div>
                <div className="text-[10px] md:text-xs text-slate-500 truncate max-w-[200px]">{selectedInquiry.experiences?.title}</div>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                const isMe = String(msg.sender_id) === String(currentUser?.id);

                return (
                  <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>

                    {!isMe && (
                      <div className="flex flex-col items-center mr-2 cursor-pointer" onClick={() => setModalUserId(msg.sender_id)}>
                        <div className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden relative border border-slate-200">
                          <Image
                            src={secureUrl(selectedInquiry.guest?.avatar_url)}
                            alt="guest"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                      {!isMe && (
                        <span
                          className="text-[11px] text-slate-500 mb-1 ml-1 cursor-pointer hover:underline"
                          onClick={() => setModalUserId(msg.sender_id)}
                        >
                          {selectedInquiry.guest?.name || '게스트'}
                        </span>
                      )}

                      <div className="flex items-end gap-2">
                        {isMe && (
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-blue-500 mb-0.5">
                              {msg.is_read ? '' : '1'}
                            </span>
                            <span className="text-[10px] text-slate-400 min-w-[50px] text-right" suppressHydrationWarning>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${isMe
                            ? 'bg-black text-white rounded-tr-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                          }`}>
                          {/* 📸 이미지 렌더링 추가 */}
                          {msg.type === 'image' && msg.image_url && (
                            <div className="mb-2 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                              <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                                <Image src={msg.image_url} alt="chat-img" width={300} height={300} className="w-full h-auto object-cover hover:opacity-90 transition-opacity" />
                              </a>
                            </div>
                          )}
                          {msg.content}
                        </div>

                        {!isMe && (
                          <span className="text-[10px] text-slate-400 min-w-[50px] mb-1" suppressHydrationWarning>
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex gap-2 items-center">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="h-10 w-10 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors shrink-0 disabled:opacity-30"
              >
                <ImagePlus size={20} />
              </button>

              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="답장 입력..."
                disabled={isSending}
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-black transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={(!replyText.trim()) || isSending}
                className="bg-black text-white h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <User size={48} className="text-slate-200 mb-2" />
            <p className="text-sm">대화를 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}