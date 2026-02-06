'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, User, ChevronRight, Calendar, Send, RefreshCw } from 'lucide-react';
import { useChat } from '@/app/hooks/useChat'; // ✅ 관리자용 훅 사용

export default function ChatMonitor() {
  // role='admin'으로 호출하여 type='admin'인 문의만 가져옴
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage, refresh } = useChat('admin');
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 메시지가 오면 스크롤 하단으로 이동
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
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <MessageCircle size={18}/> 1:1 문의함
            </h3>
            <p className="text-xs text-slate-500 mt-1">고객/호스트가 보낸 문의입니다.</p>
          </div>
          <button onClick={refresh} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500" title="새로고침">
            <RefreshCw size={16} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {inquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <MessageCircle size={32} className="mb-2 opacity-20"/>
              <div className="text-sm">접수된 문의가 없습니다.</div>
            </div>
          ) : (
            inquiries.map((inq) => (
              <div 
                key={inq.id} 
                onClick={() => loadMessages(inq.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inq.id ? 'bg-blue-50 border-l-4 border-l-black' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-sm text-slate-800 flex items-center gap-1">
                    {inq.guest?.full_name || '익명 사용자'}
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">ID:{String(inq.id).substring(0,4)}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(inq.updated_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{inq.content || '(사진/파일)'}</p>
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  {selectedInquiry.guest?.avatar_url ? (
                    <img src={selectedInquiry.guest.avatar_url} className="w-full h-full rounded-full object-cover"/>
                  ) : (
                    <User size={20} className="text-slate-400"/>
                  )}
                </div>
                <div>
                  <div className="font-bold text-lg text-slate-900">{selectedInquiry.guest?.full_name || '익명'}</div>
                  <div className="text-xs text-slate-400">문의 ID: {selectedInquiry.id} · {new Date(selectedInquiry.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id; // 내가 보낸 것 (관리자)
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-xl max-w-[70%] text-sm shadow-sm leading-relaxed ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                className="flex-1 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:bg-white transition-all"
                placeholder="답변을 입력하세요..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} className="bg-black text-white px-5 py-2 rounded-xl hover:bg-slate-800 transition-colors">
                <Send size={18}/>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageCircle size={64} className="mb-4 opacity-20"/>
            <p className="font-medium">좌측에서 답변할 문의를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}