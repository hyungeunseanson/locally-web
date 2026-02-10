'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; 
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import { Send, ShieldCheck, User, Loader2 } from 'lucide-react'; // 🟢 Loader2 추가

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
  const [isSending, setIsSending] = useState(false); // 🟢 [추가] 전송 중 상태
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter(); 
  const searchParams = useSearchParams();
  
  // URL 파라미터 값들
  const hostId = searchParams.get('hostId');
  const expId = searchParams.get('expId');
  const hostName = searchParams.get('hostName');
  const hostAvatar = searchParams.get('hostAvatar'); 
  const expTitle = searchParams.get('expTitle');
  
  // URL 파라미터를 이미 처리했는지 여부 (무한 리다이렉트 방지)
  const [isUrlProcessed, setIsUrlProcessed] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // URL 처리 로직 (단 한 번만 실행되도록 제어)
  useEffect(() => {
    // 로딩 중이거나 이미 처리했으면 스킵
    if (isLoading || isUrlProcessed) return;

    // URL 파라미터가 없으면 처리 완료로 간주
    if (!hostId || !expId) {
      setIsUrlProcessed(true);
      return;
    }

    // 1. 이미 존재하는 채팅방인지 확인
    const existing = inquiries.find(
      i => String(i.host_id) === String(hostId) && String(i.experience_id) === String(expId)
    );
    
    if (existing) {
      // 이미 있는 방이면 그 방으로 이동
      if (selectedInquiry?.id !== existing.id) {
        loadMessages(existing.id);
      }
    } else {
      // 없는 방이면 '새 채팅방' 시작
      if (selectedInquiry?.id !== 'new') {
         startNewChat(
           { id: hostId, name: hostName || 'Host', avatarUrl: hostAvatar || undefined }, 
           { id: expId, title: expTitle || 'Experience' }
         );
      }
    }
    
    // 처리 완료 플래그 세우기 (이제 다른 채팅방 눌러도 여기로 안 돌아옴)
    setIsUrlProcessed(true);

  }, [isLoading, inquiries, hostId, expId, hostName, hostAvatar, expTitle, selectedInquiry, loadMessages, startNewChat, isUrlProcessed]);

  // 다른 채팅방 클릭 핸들러
  const handleSelectInquiry = (inqId: number) => {
    loadMessages(inqId);
    
    // 만약 URL에 파라미터가 남아있다면 제거해서 깔끔하게 만듦
    if (hostId || expId) {
       router.replace('/guest/inbox');
    }
  };

// 🟢 [수정] 전송 핸들러 (중복 방지 로직 추가)
const handleSend = async () => {
  if (selectedInquiry && inputText.trim() && !isSending) {
    setIsSending(true); // 🔒 버튼 잠금
    
    try {
      if (selectedInquiry.id === 'new') {
        await createInquiry(selectedInquiry.host_id, selectedInquiry.experience_id, inputText);
      } else {
        await sendMessage(selectedInquiry.id, inputText);
      }
      setInputText('');
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false); // 🔓 버튼 해제
    }
  };

  const getDisplayHost = (inqOrSelected: any) => {
    if (inqOrSelected?.host) {
        return {
            name: inqOrSelected.host.name,
            avatar: inqOrSelected.host.avatar_url
        };
    }
    // URL 백업 정보는 'new' 상태일 때만 사용 (기존 채팅방 클릭 시엔 DB 정보 우선)
    if (inqOrSelected?.id === 'new' && inqOrSelected?.host_id === hostId) {
        return { name: hostName || 'Host', avatar: hostAvatar };
    }
    return { name: 'Host', avatar: null };
  };

  const currentHostDisplay = selectedInquiry ? getDisplayHost(selectedInquiry) : { name: '', avatar: null };

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
                const display = getDisplayHost(inq); 
                return (
                  // 클릭 시 handleSelectInquiry 호출 (URL 정리 포함)
                  <div key={inq.id} onClick={() => handleSelectInquiry(inq.id)} className={`relative p-4 cursor-pointer hover:bg-slate-50 flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100' : ''}`}>
                    
                    {/* 🟢 [추가됨] 안 읽은 메시지 배지 (N) */}
                    {inq.unread_count > 0 && (
                      <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce z-10">
                        N
                      </div>
                    )}

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
                             {/* 상대방 프사 표시 */}
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
                           {/* 여기서도 currentHostDisplay (URL에서 온 사진) 사용 */}
                           {currentHostDisplay.avatar ? <img src={currentHostDisplay.avatar} className="w-full h-full object-cover" alt="host"/> : <User size={40} className="text-slate-300"/>}
                        </div>
                        <p className="font-bold text-slate-900 mb-1">{currentHostDisplay.name}님에게 메시지 보내기</p>
                        <p className="text-xs">궁금한 점을 자유롭게 물어보세요!</p>
                     </div>
                  )}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                  <input className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all" placeholder="메시지 입력..." value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={isSending} onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }} />
                  <button onClick={handleSend} disabled={!inputText.trim() || isSending} className="p-3 bg-black text-white rounded-full hover:scale-105 transition-transform"> <Send size={18}/>{isSending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}</button>
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