'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, User, ChevronRight, Calendar, Send, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useChat } from '@/app/hooks/useChat'; 

export default function ChatMonitor() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage, refresh, isLoading, error } = useChat('admin');
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

  const getGuestName = (guest: any) => {
    if (!guest) return '알 수 없는 사용자';
    return guest.full_name || guest.name || guest.email || '익명 고객';
  };

  return (
    <div className="flex h-full gap-6 w-full">
      {/* 왼쪽: 문의 목록 */}
      <div className="w-1/3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm relative">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <MessageCircle size={18}/> 1:1 문의함
            </h3>
            <p className="text-xs text-slate-500 mt-1">고객/호스트 1:1 상담 내역</p>
          </div>
          <button onClick={refresh} className="p-2 hover:bg-slate-200 rounded-full text-slate-500" title="새로고침">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-xs break-all">
            <div className="flex items-center gap-2 font-bold mb-1"><AlertTriangle size={14}/> 오류 발생</div>
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} /> 로딩 중...
            </div>
          ) : inquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <MessageCircle size={32} className="mb-2 opacity-20"/>
              <div className="text-sm font-bold mb-1">접수된 문의가 없습니다.</div>
              <button onClick={refresh} className="text-xs text-blue-600 underline mt-2">새로고침</button>
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
                    {getGuestName(inq.guest)}
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono">#{inq.id}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(inq.updated_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{inq.content || '(내용 없음)'}</p>
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
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                  {selectedInquiry.guest?.avatar_url ? (
                    <img src={selectedInquiry.guest.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <User size={20} className="text-slate-400"/>
                  )}
                </div>
                <div>
                  <div className="font-bold text-lg text-slate-900">{getGuestName(selectedInquiry.guest)}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    문의 ID: {selectedInquiry.id}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                // ✅ [필승 로직] 
                // 1. 내가(로그인한 관리자) 쓴 글인가? -> 무조건 오른쪽 (Right)
                // 2. 내가 안 썼는데, 문의자(Guest)가 쓴 글인가? -> 왼쪽 (Left)
                // 3. 그 외(다른 관리자/호스트) -> 오른쪽 (Right)
                const isMe = String(msg.sender_id) === String(currentUser?.id);
                const isGuest = String(msg.sender_id) === String(selectedInquiry.user_id);
                
                // 내가 썼거나, 게스트가 안 썼으면(즉 다른 관리자가 썼으면) 오른쪽
                const showRight = isMe || !isGuest;

                return (
                  <div key={msg.id} className={`flex ${showRight ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-xl max-w-[70%] text-sm shadow-sm leading-relaxed ${showRight ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                className="flex-1 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:bg-white transition-all text-sm"
                placeholder="답변을 입력하세요..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                // ✅ 한글 중복 방지 (완벽 해결)
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') {
                    e.preventDefault(); 
                    handleSend();
                  }
                }}
              />
              <button onClick={handleSend} className="bg-black text-white px-5 py-2 rounded-xl hover:bg-slate-800 transition-colors">
                <Send size={18}/>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageCircle size={64} className="mb-4 opacity-20"/>
            <p className="font-medium">좌측 목록에서 문의를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}