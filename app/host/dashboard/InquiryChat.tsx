'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat'; 
import { Send, User } from 'lucide-react';

export default function InquiryChat() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('host');
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (selectedInquiry && replyText.trim()) {
      sendMessage(selectedInquiry.id, replyText);
      setReplyText('');
    }
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
            {/* 🔴 안 읽은 메시지 배지 (N) */}
            {inq.unread_count > 0 && (
              <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                N
              </div>
            )}

            {/* 상대방 이름과 사진 표시 (이제 제대로 나옵니다) */}
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden relative">
                 {/* role이 host면 guest 정보, guest면 host 정보 표시 */}
                 <img 
                   src={inq.guest?.avatar_url || "/default-avatar.png"} // 호스트 입장일 때
                   alt="profile" 
                   className="object-cover w-full h-full"
                 />
               </div>
               <div className="flex-1 min-w-0">
                 <div className="text-sm font-bold truncate">
                   {inq.guest?.name || '게스트'} {/* 호스트 입장일 때 */}
                 </div>
                 <div className="text-xs text-slate-500 truncate">{inq.experiences?.title}</div>
               </div>
            </div>

            <div className="text-sm text-slate-600 line-clamp-2 bg-white/50 p-2 rounded-lg">
              {inq.content}
            </div>
            <div className="text-xs text-slate-400 mt-2 text-right">
              {new Date(inq.updated_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden h-[700px]">
        {selectedInquiry ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white font-bold">{selectedInquiry.experiences?.title}</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                const isMe = String(msg.sender_id) === String(currentUser?.id);
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && <div className="w-8 h-8 bg-slate-200 rounded-full mr-2 flex items-center justify-center"><User size={16}/></div>}
                    <div className={`p-3 rounded-xl max-w-[80%] text-sm shadow-sm ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                      {msg.content}
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
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-black"
                // ✅ [수정] 한글 중복 방지
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') {
                    e.preventDefault(); 
                    handleSend();
                  }
                }}
              />
              <button onClick={handleSend} className="bg-black text-white p-2.5 rounded-xl"><Send size={18}/></button>
            </div>
          </>
        ) : <div className="flex-1 flex items-center justify-center text-slate-400">문의를 선택하세요.</div>}
      </div>
    </div>
  );
}