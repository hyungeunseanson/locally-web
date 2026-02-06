'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, User, Send, RefreshCw, Loader2, AlertTriangle, Shield, Eye } from 'lucide-react';
import { useChat } from '@/app/hooks/useChat'; 

export default function ChatMonitor() {
  const { inquiries, selectedInquiry, messages, currentUser, loadMessages, sendMessage, refresh, isLoading, error } = useChat('admin');
  const [activeFilter, setActiveFilter] = useState<'monitor' | 'admin'>('monitor'); // 탭 상태 ('monitor' or 'admin')
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

  // ✅ 탭에 따라 목록 필터링
  const filteredInquiries = inquiries.filter(inq => {
    if (activeFilter === 'monitor') return inq.type !== 'admin'; // 호스트↔게스트 대화
    return inq.type === 'admin'; // 관리자 1:1 문의
  });

  return (
    <div className="flex h-full gap-6 w-full">
      {/* 왼쪽: 문의 목록 패널 */}
      <div className="w-[380px] shrink-0 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm relative">
        
        {/* 상단 헤더 & 탭 버튼 */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <MessageCircle size={18}/> 채팅 관리
            </h3>
            <button onClick={refresh} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors" title="새로고침">
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* ✅ [추가] 탭 전환 버튼 */}
          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            <button 
              onClick={() => setActiveFilter('monitor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeFilter === 'monitor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Eye size={14}/> 실시간 모니터링
            </button>
            <button 
              onClick={() => setActiveFilter('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeFilter === 'admin' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Shield size={14}/> 1:1 문의
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-xs break-all">
            <div className="flex items-center gap-2 font-bold mb-1"><AlertTriangle size={14}/> 오류 발생</div>
            {error}
          </div>
        )}

        {/* 목록 리스트 */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} /> 로딩 중...
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <MessageCircle size={32} className="mb-2 opacity-20"/>
              <div className="text-sm font-bold mb-1">
                {activeFilter === 'monitor' ? '진행 중인 대화가 없습니다.' : '접수된 문의가 없습니다.'}
              </div>
              <button onClick={refresh} className="text-xs text-blue-600 underline mt-2">새로고침</button>
            </div>
          ) : (
            filteredInquiries.map((inq) => (
              <div 
                key={inq.id} 
                onClick={() => loadMessages(inq.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inq.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-sm text-slate-800 flex items-center gap-1">
                    {/* 뱃지 표시 */}
                    {activeFilter === 'monitor' ? (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">유저↔호스트</span>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">1:1문의</span>
                    )}
                    <span className="truncate max-w-[120px]">{getGuestName(inq.guest)}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{new Date(inq.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                   {inq.experiences?.title ? `🏠 ${inq.experiences.title}` : '📄 일반 문의'}
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{inq.content || '(내용 없음)'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 채팅창 (기존 로직 유지) */}
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
                  <div className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    {getGuestName(selectedInquiry.guest)}
                    {selectedInquiry.type === 'admin' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">1:1 문의중</span>}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    {selectedInquiry.type === 'admin' ? (
                      '관리자에게 보낸 메시지' 
                    ) : (
                      <>호스트: <span className="font-bold text-slate-600">{selectedInquiry.host?.full_name || '알수없음'}</span> 와의 대화</>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4" ref={scrollRef}>
              {messages.map((msg) => {
                // 정렬 로직 (이전과 동일하게 유지하여 혼선 방지)
                const isMe = String(msg.sender_id) === String(currentUser?.id);
                const isGuest = String(msg.sender_id) === String(selectedInquiry.user_id);
                
                // 내가 썼거나, 게스트가 안 썼으면(호스트 등) 오른쪽
                const alignRight = isMe || !isGuest; 

                return (
                  <div key={msg.id} className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-400 mb-1 px-1">
                      {msg.sender?.full_name || '알 수 없음'}
                    </span>
                    <div className={`p-3 rounded-xl max-w-[70%] text-sm shadow-sm leading-relaxed ${alignRight ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input 
                className="flex-1 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:bg-white transition-all text-sm"
                placeholder={activeFilter === 'monitor' ? "관리자 권한으로 메시지 전송..." : "답변을 입력하세요..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
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
            <p className="font-medium">좌측에서 대화를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}