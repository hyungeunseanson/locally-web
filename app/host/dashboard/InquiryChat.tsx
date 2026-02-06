'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/hooks/useChat'; // ✅ 같은 훅 사용
import { Send, User } from 'lucide-react';

export default function InquiryChat() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('host');
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (selectedInquiry) {
      sendMessage(selectedInquiry.id, replyText);
      setReplyText('');
    }
  };

  return (
    <div className="flex gap-6 h-[600px]">
      {/* 목록 */}
      <div className="w-1/3 border-r border-slate-200 pr-4 overflow-y-auto">
        {inquiries.map((inq) => (
          <div key={inq.id} onClick={() => loadMessages(inq.id)} className={`p-4 rounded-xl cursor-pointer mb-2 ${selectedInquiry?.id === inq.id ? 'bg-slate-100 border-black' : 'hover:bg-slate-50'}`}>
            <div className="text-xs font-bold text-slate-500 mb-1">{inq.experiences?.title}</div>
            <div className="font-bold text-sm truncate">{inq.content}</div>
            <div className="text-xs text-slate-400 mt-2">{new Date(inq.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      {/* 채팅창 */}
      <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
        {selectedInquiry ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white font-bold">{selectedInquiry.experiences?.title}</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id;
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
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} className="bg-black text-white p-2.5 rounded-xl"><Send size={18}/></button>
            </div>
          </>
        ) : <div className="flex-1 flex items-center justify-center text-slate-400">문의를 선택하세요.</div>}
      </div>
    </div>
  );
}