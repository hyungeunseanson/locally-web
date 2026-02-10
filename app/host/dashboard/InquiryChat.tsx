'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat'; 
import { Send, User } from 'lucide-react';
import Image from 'next/image';

export default function InquiryChat() {
  // 'host' 모드로 실행하여 게스트 정보를 가져옵니다.
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('host');
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 메시지 로드 시 스크롤 하단 이동
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (selectedInquiry && replyText.trim()) {
      sendMessage(selectedInquiry.id, replyText);
      setReplyText('');
    }
  };

  // 시간 포맷팅 헬퍼 함수
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  // 날짜 포맷팅 헬퍼 함수
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px] w-full">
      {/* 좌측 리스트 영역 */}
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
            {/* 🔴 안 읽은 메시지 배지 (N) - 기존 기능 유지 */}
            {inq.unread_count > 0 && (
              <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                N
              </div>
            )}

            {/* 상대방(게스트) 이름과 사진 표시 */}
            <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden relative border border-slate-200 shrink-0">
                 <Image 
                   src={inq.guest?.avatar_url || "/default-avatar.png"} 
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
            <div className="text-xs text-slate-400 mt-2 text-right">
              {formatDate(inq.updated_at)}
            </div>
          </div>
        ))}
      </div>

      {/* 우측 채팅방 영역 */}
      <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden h-[700px]">
        {selectedInquiry ? (
          <>
            {/* 🟢 [개선] 채팅방 헤더: 게스트 정보 표시 */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-3 shadow-sm z-10">
              <div className="relative w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                <Image 
                  src={selectedInquiry.guest?.avatar_url || "/default-avatar.png"}
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
                    
                    {/* 🟢 상대방 프로필 사진 (메시지 옆) */}
                    {!isMe && (
                      <div className="flex flex-col items-center mr-2">
                        <div className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden relative">
                          <Image 
                            src={msg.sender?.avatar_url || "/default-avatar.png"}
                            alt="sender"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                      {/* 🟢 보낸 사람 이름 */}
                      {!isMe && (
                        <span className="text-[11px] text-slate-500 mb-1 ml-1">
                          {msg.sender?.name || '게스트'}
                        </span>
                      )}

                      <div className="flex items-end gap-2">
                        {/* 내 메시지 시간 (왼쪽 표시) */}
                        {isMe && (
                          <span className="text-[10px] text-slate-400 min-w-[50px] text-right mb-1">
                            {formatTime(msg.created_at)}
                          </span>
                        )}

                        {/* 말풍선 */}
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                          isMe 
                            ? 'bg-black text-white rounded-tr-none' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>

                        {/* 상대방 메시지 시간 (오른쪽 표시) */}
                        {!isMe && (
                          <span className="text-[10px] text-slate-400 min-w-[50px] mb-1">
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 입력창 (기존 기능 유지) */}
            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <input 
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)} 
                placeholder="답장 입력..." 
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-black transition-colors"
                // ✅ 한글 중복 방지 로직 유지
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') {
                    e.preventDefault(); 
                    handleSend();
                  }
                }}
              />
              <button onClick={handleSend} className="bg-black text-white p-2.5 rounded-xl hover:bg-slate-800 transition-colors">
                <Send size={18}/>
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