'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import { Send, ImageIcon, ShieldCheck } from 'lucide-react';

// 🟢 메인 콘텐츠를 별도 컴포넌트로 분리 (Suspense 적용을 위해)
function InboxContent() {
  // ✅ [수정] useChat에서 필요한 함수들을 모두 꺼내왔습니다. (빨간 줄 해결 원인)
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

  // URL 파라미터 읽기
  const searchParams = useSearchParams();
  const hostId = searchParams.get('hostId');
  const expId = searchParams.get('expId');
  const hostName = searchParams.get('hostName');
  const expTitle = searchParams.get('expTitle');

  // 스크롤 하단 고정
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 🟢 URL 파라미터가 있을 때 자동 채팅방 세팅
  useEffect(() => {
    // 로딩이 끝났고, 파라미터가 있을 때만 실행
    if (!isLoading && hostId && expId) {
      
      // 1. 이미 존재하는 채팅방인지 확인 (타입 변환하여 비교)
      const existing = inquiries.find(
        i => String(i.host_id) === String(hostId) && String(i.experience_id) === String(expId)
      );
      
      if (existing) {
        // 이미 있으면 그 방의 메시지를 불러옴
        if (selectedInquiry?.id !== existing.id) {
          loadMessages(existing.id);
        }
      } else {
        // 없으면 '새 채팅방' 모드 시작
        // (현재 선택된 방이 'new'가 아닐 때만 실행하여 무한 루프 방지)
        if (selectedInquiry?.id !== 'new') {
           startNewChat(
             { id: hostId, name: hostName || 'Host' }, 
             { id: expId, title: expTitle || 'Experience' }
           );
        }
      }
    }
  }, [isLoading, inquiries, hostId, expId, hostName, expTitle, selectedInquiry, loadMessages, startNewChat]);

  const handleSend = async () => {
    if (selectedInquiry && inputText.trim()) {
      if (selectedInquiry.id === 'new') {
        // 🟢 '새 채팅방'인 경우: DB에 채팅방 생성 후 메시지 전송
        await createInquiry(selectedInquiry.host_id, selectedInquiry.experience_id, inputText);
      } else {
        // 기존 채팅방인 경우
        sendMessage(selectedInquiry.id, inputText);
      }
      setInputText('');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-[1280px] mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col">
        <h1 className="text-2xl font-bold mb-6">메시지</h1>
        
        <div className="flex-1 flex border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          {/* 좌측: 대화 목록 */}
          <div className={`w-full md:w-[320px] lg:w-[400px] border-r border-slate-200 flex flex-col ${selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 font-bold bg-white">대화 목록</div>
            <div className="flex-1 overflow-y-auto">
              {inquiries.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">대화가 없습니다.</div>}
              {inquiries.map((inq) => (
                <div key={inq.id} onClick={() => loadMessages(inq.id)} className={`p-4 cursor-pointer hover:bg-slate-50 flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100' : ''}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${inq.type === 'admin' ? 'bg-black text-white' : 'bg-slate-100'}`}>
                    {inq.type === 'admin' ? <ShieldCheck size={20} /> : (inq.experiences?.image_url ? <img src={inq.experiences.image_url} className="w-full h-full object-cover" alt="exp"/> : <ImageIcon className="text-slate-400"/>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{inq.type === 'admin' ? '로컬리 고객센터' : inq.experiences?.title}</div>
                    <div className="text-xs text-slate-500 truncate">{inq.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 우측: 채팅창 */}
          <div className={`flex-1 flex flex-col ${!selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            {selectedInquiry ? (
              <>
                <div className="p-4 border-b border-slate-100 font-bold flex items-center gap-2">
                  <div className="text-base">{selectedInquiry.type === 'admin' ? '1:1 문의 (고객센터)' : selectedInquiry.experiences?.title}</div>
                   {/* 호스트 이름 표시 */}
                   {selectedInquiry.host?.full_name && <span className="text-xs text-slate-500 font-normal">with {selectedInquiry.host.full_name}</span>}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
                  {messages.map((msg) => {
                    const isMe = String(msg.sender_id) === String(currentUser?.id);
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 새 채팅방 안내 문구 */}
                  {messages.length === 0 && selectedInquiry.id === 'new' && (
                     <div className="text-center text-slate-400 text-sm mt-10">
                        <p>{selectedInquiry.host?.full_name} 님에게 궁금한 점을 물어보세요!</p>
                        <p className="text-xs mt-1">메시지를 보내면 대화가 시작됩니다.</p>
                     </div>
                  )}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                  <input 
                    className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="메시지 입력..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSend();
                      }
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

// 🟢 Suspense로 감싸서 내보내기 (빌드 에러 방지)
export default function GuestInboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">로딩 중...</div>}>
      <InboxContent />
    </Suspense>
  );
}