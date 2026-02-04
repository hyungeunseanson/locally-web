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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async (inq: any) => {
    setSelectedInquiry(inq);
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inq.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const { error } = await supabase.from('inquiry_messages').insert([{
      inquiry_id: selectedInquiry.id, sender_id: user.id, content: inputText
    }]);
    if (!error) { setInputText(''); loadMessages(selectedInquiry); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault(); // 엔터 시 줄바꿈 방지
      handleSend();
    }
  };

  // 날짜/시간 포맷팅 함수
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
          
          {/* 왼쪽: 대화 목록 */}
          <div className={`w-full md:w-[320px] lg:w-[400px] border-r border-slate-200 flex flex-col ${selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 font-bold text-lg">대화 목록</div>
            <div className="flex-1 overflow-y-auto">
              {inquiries.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">진행 중인 대화가 없습니다.</div>}
              {inquiries.map((inq) => (
                <div 
                  key={inq.id} 
                  onClick={() => loadMessages(inq)}
                  className={`p-4 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-4 ${selectedInquiry?.id === inq.id ? 'bg-slate-100 border-l-4 border-l-black' : ''}`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-100">
                    {inq.experiences?.image_url ? (
                      <img src={inq.experiences.image_url} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={20}/></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="font-bold text-sm truncate text-slate-900">{inq.experiences?.title || '체험 정보 없음'}</div>
                    <div className="text-xs text-slate-500 mt-1 truncate">{inq.content}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{new Date(inq.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽: 채팅창 */}
          <div className={`flex-1 flex flex-col bg-white ${!selectedInquiry ? 'hidden md:flex' : 'flex'}`}>
            {selectedInquiry ? (
              <>
                {/* 채팅 헤더 */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white z-10 shadow-sm">
                  <button onClick={() => setSelectedInquiry(null)} className="md:hidden p-2 -ml-2"><ChevronLeft size={20}/></button>
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-100">
                    {selectedInquiry.experiences?.image_url && <img src={selectedInquiry.experiences.image_url} className="w-full h-full object-cover"/>}
                  </div>
                  <div>
                    <div className="font-bold text-base">{selectedInquiry.experiences?.title}</div>
                    <div className="text-xs text-slate-500">호스트와 대화 중</div>
                  </div>
                </div>
                
                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50" ref={scrollRef}>
                  
                  {/* 첫 문의 메시지 (시스템 메시지처럼 처리하거나 내 메시지로 처리) */}
                  <div className="flex flex-col gap-1 items-end">
                     <div className="bg-black text-white px-4 py-3 rounded-2xl rounded-tr-none max-w-[75%] text-sm shadow-md">
                        {selectedInquiry.content}
                     </div>
                     <span className="text-[10px] text-slate-400 mr-1">{formatTime(selectedInquiry.created_at)}</span>
                  </div>

                  {messages.map((msg, index) => {
                    const isMe = msg.sender_id === user?.id;
                    const showDate = index === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {/* 날짜 구분선 */}
                        {showDate && (
                          <div className="flex justify-center my-6">
                            <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full font-medium">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          
                          {/* 프로필 사진 */}
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-white">
                              {isMe ? (
                                user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><User size={14}/></div>
                              ) : (
                                selectedInquiry.experiences?.image_url ? <img src={selectedInquiry.experiences.image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><User size={14}/></div>
                              )}
                            </div>
                          </div>

                          {/* 메시지 내용 + 시간 */}
                          <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            {/* 이름 (상대방일 때만 표시) */}
                            {!isMe && <span className="text-xs text-slate-500 ml-1 mb-0.5">호스트</span>}
                            
                            <div className={`px-4 py-3 text-sm shadow-sm leading-relaxed break-words
                              ${isMe 
                                ? 'bg-black text-white rounded-2xl rounded-tr-none' 
                                : 'bg-white text-slate-900 rounded-2xl rounded-tl-none border border-slate-200'
                              }`}>
                              {msg.content}
                            </div>
                            <span className={`text-[10px] text-slate-400 ${isMe ? 'mr-1' : 'ml-1'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 입력창 */}
                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex gap-2 items-end border border-slate-300 rounded-2xl p-2 focus-within:ring-1 focus-within:ring-black transition-shadow bg-slate-50">
                    <textarea 
                      className="flex-1 bg-transparent px-3 py-2 outline-none resize-none max-h-32 min-h-[44px] text-sm"
                      placeholder="메시지를 입력하세요..."
                      value={inputText}
                      rows={1}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button 
                      onClick={handleSend} 
                      disabled={!inputText.trim()}
                      className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${inputText.trim() ? 'bg-black text-white hover:scale-105' : 'bg-slate-200 text-slate-400'}`}
                    >
                      <Send size={18}/>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <MessageSquare size={48} className="mb-4 opacity-20"/>
                <p>대화를 선택하여 메시지를 확인하세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}