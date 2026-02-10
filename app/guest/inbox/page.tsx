'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; 
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import UserProfileModal from '@/app/components/UserProfileModal'; // 🟢 모달 임포트
import { Send, ShieldCheck, User, Loader2 } from 'lucide-react';
import Image from 'next/image';

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
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 🟢 프로필 모달 상태
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalRole, setModalRole] = useState<'host' | 'guest'>('host');

  const router = useRouter(); 
  const searchParams = useSearchParams();
  
  const hostId = searchParams.get('hostId');
  const expId = searchParams.get('expId');
  const hostName = searchParams.get('hostName');
  const hostAvatar = searchParams.get('hostAvatar'); 
  const expTitle = searchParams.get('expTitle');
  
  const [isUrlProcessed, setIsUrlProcessed] = useState(false);

  // 🟢 [헬퍼] 보안 이미지 및 시간 포맷
  const secureUrl = (url: string | null | undefined) => {
    if (!url) return "/default-avatar.png";
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isLoading || isUrlProcessed) return;

    if (!hostId || !expId) {
      setIsUrlProcessed(true);
      return;
    }

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
    setIsUrlProcessed(true);
  }, [isLoading, inquiries, hostId, expId, hostName, hostAvatar, expTitle, selectedInquiry, loadMessages, startNewChat, isUrlProcessed]);

  const handleSelectInquiry = (inqId: number) => {
    loadMessages(inqId);
    if (hostId || expId) router.replace('/guest/inbox');
  };

  const handleSend = async () => {
    if (selectedInquiry && inputText.trim() && !isSending) {
      setIsSending(true); 
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
        setIsSending(false);
      }
    }
  };

  const getDisplayHost = (inqOrSelected: any) => {
    if (inqOrSelected?.host) {
        return {
            name: inqOrSelected.host.name,
            avatar: inqOrSelected.host.avatar_url,
            id: inqOrSelected.host.id
        };
    }
    if (inqOrSelected?.id === 'new' && inqOrSelected?.host_id === hostId) {
        return { name: hostName || 'Host', avatar: hostAvatar, id: hostId };
    }
    return { name: 'Host', avatar: null, id: null };
  };

  const currentHostDisplay = selectedInquiry ? getDisplayHost(selectedInquiry) : { name: '', avatar: null, id: null };

  // 🟢 프로필 클릭 핸들러
  const handleProfileClick = (id: string | null) => {
    if (id) {
      setModalUserId(id);
      setModalRole('host');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      
{/* 게스트는 무조건 호스트의 프로필을 봐야 하므로 role="host" 고정 */}
<UserProfileModal 
        userId={modalUserId || ''} 
        isOpen={!!modalUserId} 
        onClose={() => setModalUserId(null)} 
        role="host" 
      />

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
                  <div key={inq.id} onClick={() => handleSelectInquiry(inq.id)} className={`relative p-4 cursor-pointer hover:bg-slate-50 flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100' : ''}`}>
                    
                    {inq.unread_count > 0 && (
                      <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce z-10">N</div>
                    )}

                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 relative ${inq.type === 'admin' ? 'bg-black text-white' : 'bg-slate-50'}`}>
                      {inq.type === 'admin' ? <ShieldCheck size={20} /> : (
                        <Image 
                          src={secureUrl(display.avatar)} 
                          alt="host" 
                          fill 
                          className="object-cover"
                        />
                      )}
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
                <div className="p-4 border-b border-slate-100 font-bold flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleProfileClick(currentHostDisplay.id)}>
                   <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 relative">
                      <Image src={secureUrl(currentHostDisplay.avatar)} alt="host" fill className="object-cover" />
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
                      <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                         {!isMe && (
                           <div 
                             className="flex flex-col items-center mr-2 cursor-pointer"
                             onClick={() => handleProfileClick(msg.sender_id)}
                           >
                             <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden relative border border-slate-200">
                             <Image 
                                 src={secureUrl(selectedInquiry.type === 'admin' ? null : currentHostDisplay.avatar)} 
                                 alt="sender" 
                                 fill 
                                 className="object-cover"
                               />
                             </div>
                           </div>
                         )}

                         <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                            {/* 🟢 호스트 이름 표시 */}
                            {!isMe && (
                              <span className="text-[11px] text-slate-500 mb-1 ml-1 cursor-pointer" onClick={() => handleProfileClick(msg.sender_id)}>
                                {msg.sender?.name || currentHostDisplay.name}
                              </span>
                            )}
                            
                            <div className="flex items-end gap-2">
                            {isMe && <span className="text-[10px] text-slate-400 min-w-[50px] text-right mb-1" suppressHydrationWarning>{formatTime(msg.created_at)}</span>}
                               
                               <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                                 {msg.content}
                               </div>

                               {/* 🟢 호스트 메시지 시간 표시 */}
                               {!isMe && <span className="text-[10px] text-slate-400 min-w-[50px] mb-1" suppressHydrationWarning>{formatTime(msg.created_at)}</span>}
                               </div>
                         </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                  <input 
className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-black transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
placeholder="메시지 입력..." 
value={inputText} 
onChange={(e) => setInputText(e.target.value)} 
disabled={isSending} 
onKeyDown={(e) => { 
  if (e.nativeEvent.isComposing) return; 
  if (e.key === 'Enter') { 
    e.preventDefault(); 
    handleSend(); 
  }
                    }} 
                  />
                  <button 
                    onClick={handleSend} 
                    disabled={!inputText.trim() || isSending} 
                    className="p-3 bg-black text-white rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                  </button>
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