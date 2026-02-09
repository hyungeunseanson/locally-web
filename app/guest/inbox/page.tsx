'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import { Send, ImageIcon, ShieldCheck, User } from 'lucide-react';

function InboxContent() {
  const { 
    inquiries, 
    selectedInquiry, 
    messages, 
    currentUser, 
    loadMessages, 
    sendMessage, 
    startNewChat, 
    createInquiry, 
    isLoading 
  } = useChat('guest');

  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const hostId = searchParams.get('hostId');
  const expId = searchParams.get('expId');
  const hostName = searchParams.get('hostName');
  const hostAvatar = searchParams.get('hostAvatar'); 
  const expTitle = searchParams.get('expTitle');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // URL 파라미터가 있을 때 자동 채팅방 세팅
  useEffect(() => {
    if (!isLoading && hostId && expId) {
      const existing = inquiries.find(
        i => String(i.host_id) === String(hostId) && String(i.experience_id) === String(expId)
      );
      
      if (existing) {
        if (selectedInquiry?.id !== existing.id) {
          loadMessages(existing.id);
        }
      } else {
        if (selectedInquiry?.id !== 'new') {
           startNewChat(
             { id: hostId, name: hostName || 'Host', avatarUrl: hostAvatar || undefined }, 
             { id: expId, title: expTitle || 'Experience' }
           );
        }
      }
    }
  }, [isLoading, inquiries, hostId, expId, hostName, hostAvatar, expTitle, selectedInquiry, loadMessages, startNewChat]);

  const handleSend = async () => {
    if (selectedInquiry && inputText.trim()) {
      if (selectedInquiry.id === 'new') {
        await createInquiry(selectedInquiry.host_id, selectedInquiry.experience_id, inputText);
      } else {
        sendMessage(selectedInquiry.id, inputText);
      }
      setInputText('');
    }
  };

  // 🟢 [UI 로직 강화] 화면에 표시할 호스트 정보 결정
  // 1순위: 선택된 채팅방의 DB 데이터 (가장 정확함)
  // 2순위: URL 파라미터로 넘어온 데이터 (로딩 전이나 DB 데이터 누락 시 백업)
  const getDisplayHost = (inq: any) => {
    // 채팅방 데이터가 있고, 그 안에 호스트 정보가 있으면 사용
    if (inq?.host) {
        return {
            name: inq.host.name || inq.host.full_name || 'Host',
            avatar: inq.host.avatar_url
        };
    }
    // 채팅방 데이터가 부실한데, 현재 URL의 호스트와 ID가 같다면 URL 정보 사용
    if (inq?.host_id === hostId) {
        return {
            name: hostName || 'Host',
            avatar: hostAvatar
        };
    }
    return { name: 'Host', avatar: null };
  };

  // 현재 선택된 방의 표시 정보 계산
  const currentHostDisplay = selectedInquiry 
    ? getDisplayHost(selectedInquiry) 
    : { name: '', avatar: null };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col">
        <h1 className="text-2xl font-bold mb-6">메시지</h1>
        
        <div className="flex-1 flex border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          {/* 좌측: 목록 */}
          <div className={`w-full md:w-[320px] lg:w-[400px] border-r border-slate-200 flex flex-col ${selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 font-bold bg-white">대화 목록</div>
            <div className="flex-1 overflow-y-auto">
              {inquiries.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">대화가 없습니다.</div>}
              {inquiries.map((inq) => {
                const display = getDisplayHost(inq); // 목록용 호스트 정보 계산
                return (
                  <div key={inq.id} onClick={() => loadMessages(inq.id)} className={`p-4 cursor-pointer hover:bg-slate-50 flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100' : ''}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 ${inq.type === 'admin' ? 'bg-black text-white' : 'bg-slate-50'}`}>
                      {inq.type === 'admin' ? <ShieldCheck size={20} /> : (display.avatar ? <img src={display.avatar} className="w-full h-full object-cover" alt="host"/> : <User className="text-slate-300" size={20}/>)}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="font-bold text-sm truncate">{inq.type === 'admin' ? '로컬리 고객센터' : display.name}</div>
                      <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-medium truncate max-w-[120px]">{inq.experiences?.title}</span>
                        <span className="truncate">{inq.content}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우측: 채팅창 */}
          <div className={`flex-1 flex flex-col ${!selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            {selectedInquiry ? (
              <>
                <div className="p-4 border-b border-slate-100 font-bold flex items-center gap-2">
                   <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                      {currentHostDisplay.avatar ? <img src={currentHostDisplay.avatar} className="w-full h-full object-cover" alt="host"/> : <div className="w-full h-full flex items-center justify-center"><User className="text-slate-300" size={18}/></div>}
                   </div>
                   <div>
                      <div className="font-bold text-base leading-tight">{selectedInquiry.type === 'admin' ? '1:1 문의 (고객센터)' : currentHostDisplay.name}</div>
                      <div className="text-xs text-slate-500 font-normal">{selectedInquiry.experiences?.title}</div>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
                  {messages.map((msg) => {
                    const isMe = String(msg.sender_id) === String(currentUser?.id);
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                         {!isMe && (
                           <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden mr-2 shrink-0">
                             {/* 상대방 프사: 메시지 자체에 정보가 없으면, 채팅방 대표 호스트 사진 사용 */}
                             {msg.sender?.avatar_url || currentHostDisplay.avatar ? 
                               <img src={msg.sender?.avatar_url || currentHostDisplay.avatar} className="w-full h-full object-cover" alt="sender"/> 
                               : <User className="w-full h-full p-1.5 text-slate-400"/>}
                           </div>
                         )}
                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none shadow-sm'}`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  
                  {messages.length === 0 && selectedInquiry.id === 'new' && (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                        <div className="w-20 h-20 rounded-full bg-slate-100 mb-4 flex items-center justify-center overflow-hidden border border-slate-200">
                           {currentHostDisplay.avatar ? <img src={currentHostDisplay.avatar} className="w-full h-full object-cover" alt="host"/> : <User size={40} className="text-slate-300"/>}
                        </div>
                        <p className="font-bold text-slate-900 mb-1">{currentHostDisplay.name}님에게 메시지 보내기</p>
                        <p className="text-xs">궁금한 점을 자유롭게 물어보세요!</p>
                     </div>
                  )}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                  <input className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all" placeholder="메시지 입력..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }} />
                  <button onClick={handleSend} className="p-3 bg-black text-white rounded-full hover:scale-105 transition-transform"><Send size={18}/></button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-2">
                <div className="p-4 bg-slate-50 rounded-full"><User size={32} className="text-slate-300"/></div>
                <p>대화를 선택하세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function GuestInboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">로딩 중...</div>}>
      <InboxContent />
    </Suspense>
  );
}