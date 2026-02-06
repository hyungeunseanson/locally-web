'use client';

import React, { useState, useEffect, useRef } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import { Send, ImageIcon, ShieldCheck } from 'lucide-react';

export default function GuestInboxPage() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage } = useChat('guest');
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (selectedInquiry) {
      sendMessage(selectedInquiry.id, inputText);
      setInputText('');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col">
        <h1 className="text-2xl font-bold mb-6">메시지</h1>
        
        <div className="flex-1 flex border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          {/* 목록 영역 */}
          <div className={`w-full md:w-[320px] lg:w-[400px] border-r border-slate-200 flex flex-col ${selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 font-bold bg-white">대화 목록</div>
            <div className="flex-1 overflow-y-auto">
              {inquiries.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">대화가 없습니다.</div>}
              {inquiries.map((inq) => (
                <div key={inq.id} onClick={() => loadMessages(inq.id)} className={`p-4 cursor-pointer hover:bg-slate-50 flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100' : ''}`}>
                  
                  {/* 아이콘: 관리자 채팅 vs 일반 체험 채팅 구분 */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${inq.type === 'admin' ? 'bg-black text-white' : 'bg-slate-100'}`}>
                    {inq.type === 'admin' ? (
                      <ShieldCheck size={20} />
                    ) : (
                      inq.experiences?.image_url ? <img src={inq.experiences.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="text-slate-400"/>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">
                      {inq.type === 'admin' ? '로컬리 고객센터' : inq.experiences?.title}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{inq.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 채팅 영역 */}
          <div className={`flex-1 flex flex-col ${!selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            {selectedInquiry ? (
              <>
                <div className="p-4 border-b border-slate-100 font-bold flex items-center gap-2">
                  <div className="text-base">
                    {selectedInquiry.type === 'admin' ? '1:1 문의 (고객센터)' : selectedInquiry.experiences?.title}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                  <input 
                    className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="메시지 입력..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    // ✅ [수정] 한글 중복 전송 방지
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter') handleSend();
                    }}
                  />
                  <button onClick={handleSend} className="p-2 bg-black text-white rounded-full"><Send size={16}/></button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">대화를 선택하세요.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}