'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, User, ChevronRight, Calendar, Send } from 'lucide-react';
import { useChat } from '@/app/hooks/useChat'; // ✅ 관리자용 훅 사용

export default function ChatMonitor() {
  // role='admin'으로 호출하여 type='admin'인 문의만 가져옴
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('admin');
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
    <div className="flex h-full gap-6">
      {/* 왼쪽: 문의 목록 */}
      <div className="w-1/3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-2">
            <MessageCircle size={18}/> 1:1 문의함
          </h3>
          <p className="text-xs text-slate-500">고객/호스트가 보낸 문의입니다.</p>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {inquiries.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">접수된 문의가 없습니다.</div>
          ) : (
            inquiries.map((inq) => (
              <div 
                key={inq.id} 
                onClick={() => loadMessages(inq.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inq.id ? 'bg-slate-50 border-l-4 border-l-black' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-sm text-slate-800">{inq.guest?.full_name || '익명 사용자'}</span>
                  <span className="text-[10px] text-slate-400">{new Date(inq.updated_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{inq.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 채팅창 */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        {selectedInquiry ? (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div>
                <div className="font-bold text-lg">{selectedInquiry.guest?.full_name}</div>
                <div className="text-xs text-slate-400">문의 ID: {selectedInquiry.id}</div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id; // 내가 보낸 것 (관리자)
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-xl max-w-[70%] text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500"
                placeholder="답변을 입력하세요..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                <Send size={18}/>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageCircle size={64} className="mb-4 opacity-20"/>
            <p className="font-medium">문의를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}