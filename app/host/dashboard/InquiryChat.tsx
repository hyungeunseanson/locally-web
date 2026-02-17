'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat'; 
import UserProfileModal from '@/app/components/UserProfileModal'; 
import { Send, User, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

export default function InquiryChat() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('host');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async () => {
    if (selectedInquiry && replyText.trim() && !isSending) {
      setIsSending(true);
      await sendMessage(selectedInquiry.id, replyText);
      setReplyText('');
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px] w-full">
      <UserProfileModal 
        userId={modalUserId || ''} 
        isOpen={!!modalUserId} 
        onClose={() => setModalUserId(null)} 
        role="guest" 
      />

      {/* 좌측 리스트 */}
      <div className="w-[300px] shrink-0 border-r border-slate-200 pr-4 overflow-y-auto max-h-[700px]">
        {inquiries.length === 0 && <div className="text-slate-400 text-sm text-center py-10">문의가 없습니다.</div>}
        
        {inquiries.map((inq) => (
          <div 
            key={inq.id} 
            onClick={() => loadMessages(inq.id)} 
            className={`relative p-4 rounded-xl cursor-pointer mb-2 transition-all ${
              selectedInquiry?.id === inq.id ? 'bg-slate-100 border border-slate-300' : 'hover:bg-slate-50 border border-transparent'
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

      {/* 우측 채팅방 */}
      <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden h-[700px]">
        {selectedInquiry ? (
          <>
            {/* 헤더 */}
            <div 
              className="p-4 border-b border-slate-200 bg-white flex items-center gap-3 shadow-sm z-10 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setModalUserId(selectedInquiry.user_id)}
            >
              <div className="relative w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                <Image 
                  src={secureUrl(selectedInquiry.guest?.avatar_url)} 
                  alt="guest"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <div className="font-bold text-slate-900">{selectedInquiry.guest?.name || '게스트'}</div>
                <div className="text-xs text-slate-500">{selectedInquiry.experiences?.title}</div>
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
                          <span className="text-[10px] text-slate-400 min-w-[50px] text-right mb-1" suppressHydrationWarning>
                            {formatTime(msg.created_at)}
                          </span>
                        )}

                        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                          isMe 
                            ? 'bg-black text-white rounded-tr-none' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}>
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

            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
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
                onClick={handleSend} 
                disabled={!replyText.trim() || isSending} 
                className="bg-black text-white p-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <User size={48} className="text-slate-200 mb-2"/>
            <p>좌측에서 대화를 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}