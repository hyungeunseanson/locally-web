'use client';

import React, { useEffect, useState, useRef } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send, User, ChevronLeft, Image as ImageIcon } from 'lucide-react';

export default function GuestInboxPage() {
  const supabase = createClient();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. 초기 데이터 로딩 (내 문의 목록)
  useEffect(() => {
    const fetchInquiries = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);

      const { data } = await supabase
        .from('inquiries')
        .select(`*, experiences (title, image_url)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setInquiries(data);
    };
    fetchInquiries();
  }, []);

  // 2. 스크롤 자동 이동 (메시지 업데이트 시)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedInquiry]);

  // 3. 채팅방 선택 및 메시지 로딩
  const loadMessages = async (inq: any) => {
    setSelectedInquiry(inq);
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inq.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  // 4. 메시지 전송
  const handleSend = async () => {
    if (!inputText.trim()) return;
    const { error } = await supabase.from('inquiry_messages').insert([{
      inquiry_id: selectedInquiry.id, sender_id: user.id, content: inputText
    }]);
    if (!error) { 
      // 낙관적 업데이트 (UI에 바로 반영)
      setMessages([...messages, { 
        id: Date.now(), 
        inquiry_id: selectedInquiry.id, 
        sender_id: user.id, 
        content: inputText, 
        created_at: new Date().toISOString() 
      }]);
      setInputText(''); 
      // 실제 데이터 재로딩 (선택사항)
      // loadMessages(selectedInquiry); 
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) {
      e.preventDefault(); 
      handleSend();
    }
  };

  // 날짜/시간 포맷팅
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      
      <main className="max-w-[1280px] mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col">
        <h1 className="text-2xl font-bold mb-6">메시지</h1>
        
        <div className="flex-1 flex border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          
          {/* ✅ 왼쪽: 대화 목록 */}
          <div className={`w-full md:w-[320px] lg:w-[400px] border-r border-slate-200 flex flex-col ${selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 font-bold text-lg bg-white sticky top-0 z-10">
              대화 목록
            </div>
            <div className="flex-1 overflow-y-auto">
              {inquiries.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center">
                  <MessageSquare size={32} className="mb-2 opacity-50"/>
                  진행 중인 대화가 없습니다.
                </div>
              )}
              {inquiries.map((inq) => (
                <div 
                  key={inq.id} 
                  onClick={() => loadMessages(inq)}
                  className={`p-4 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100 border-l-4 border-l-black' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-100">
                    {inq.experiences?.image_url ? (
                      <img src={inq.experiences.image_url} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={20}/></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-bold text-sm truncate text-slate-900 pr-2">{inq.experiences?.title || '체험 정보 없음'}</div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(inq.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{inq.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ✅ 오른쪽: 채팅창 (말풍선 UI 적용) */}
          <div className={`flex-1 flex flex-col bg-white ${!selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            {selectedInquiry ? (
              <>
                {/* 채팅 헤더 */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white z-10 shadow-sm h-[72px]">
                  <button onClick={() => setSelectedInquiry(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-black"><ChevronLeft size={24}/></button>
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-100">
                    {selectedInquiry.experiences?.image_url && <img src={selectedInquiry.experiences.image_url} className="w-full h-full object-cover"/>}
                  </div>
                  <div>
                    <div className="font-bold text-base text-slate-900">{selectedInquiry.experiences?.title}</div>
                    <div className="text-xs text-slate-500">호스트와 대화 중</div>
                  </div>
                </div>
                
                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30" ref={scrollRef}>
                  
                  {/* 첫 문의 메시지 (시스템 메시지처럼 보이지 않게, 내 메시지로 처리) */}
                  <div className="flex flex-col gap-1 items-end">
                     <div className="flex gap-3 flex-row-reverse">
                        <div className="flex-shrink-0 flex flex-col items-center">
                           <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-white">
                              {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><User size={14}/></div>}
                           </div>
                        </div>
                        <div className="flex flex-col items-end max-w-[70%]">
                           <div className="bg-black text-white px-4 py-3 rounded-2xl rounded-tr-none text-sm shadow-md leading-relaxed break-words">
                              {selectedInquiry.content}
                           </div>
                           <span className="text-[10px] text-slate-400 mt-1 mr-1">{formatTime(selectedInquiry.created_at)}</span>
                        </div>
                     </div>
                  </div>

                  {messages.map((msg, index) => {
                    const isMe = msg.sender_id === user?.id;
                    const showDate = index === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[index - 1]?.created_at || selectedInquiry.created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {/* 날짜 구분선 */}
                        {showDate && (
                          <div className="flex justify-center my-6">
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-3 py-1 rounded-full font-bold border border-slate-200 shadow-sm">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          
                          {/* 프로필 사진 */}
                          <div className="flex-shrink-0 flex flex-col items-center self-end mb-5"> {/* self-end로 하단 정렬 */}
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-white shadow-sm">
                              {isMe ? (
                                user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><User size={14}/></div>
                              ) : (
                                selectedInquiry.experiences?.image_url ? <img src={selectedInquiry.experiences.image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><User size={14}/></div>
                              )}
                            </div>
                          </div>

                          {/* 메시지 내용 */}
                          <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            {/* 이름 (상대방일 때만 표시) */}
                            {!isMe && <span className="text-[10px] text-slate-500 ml-1 mb-0.5">호스트</span>}
                            
                            <div className={`px-4 py-3 text-sm shadow-sm leading-relaxed break-words
                              ${isMe 
                                ? 'bg-black text-white rounded-2xl rounded-tr-none' 
                                : 'bg-white text-slate-900 rounded-2xl rounded-tl-none border border-slate-200'
                              }`}>
                              {msg.content}
                            </div>
                            
                            {/* 시간 표시 */}
                            <span className={`text-[10px] text-slate-400 ${isMe ? 'mr-1' : 'ml-1'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 입력창 (하단 고정) */}
                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex gap-2 items-end border border-slate-300 rounded-3xl p-2 pl-4 focus-within:ring-1 focus-within:ring-black focus-within:border-black transition-all bg-slate-50 shadow-sm">
                    <textarea 
                      className="flex-1 bg-transparent py-3 outline-none resize-none max-h-32 min-h-[24px] text-sm leading-relaxed"
                      placeholder="메시지를 입력하세요..."
                      value={inputText}
                      rows={1}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      style={{height: 'auto'}} // 텍스트 길이에 따라 자동 조절 필요 시 추가 로직 필요
                    />
                    <button 
                      onClick={handleSend} 
                      disabled={!inputText.trim()}
                      className={`p-3 rounded-full transition-all flex-shrink-0 flex items-center justify-center ${inputText.trim() ? 'bg-[#FF385C] text-white shadow-md hover:scale-105 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      <Send size={18} className={inputText.trim() ? 'ml-0.5' : ''}/>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/30">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                   <MessageSquare size={40} className="text-slate-300 ml-1 mt-1"/>
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">메시지를 선택하세요</h3>
                <p className="text-sm text-slate-400">좌측 목록에서 대화를 선택하면 내용이 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}