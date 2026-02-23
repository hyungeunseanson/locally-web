'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, User, Send, RefreshCw, Loader2, AlertTriangle, Eye, Shield } from 'lucide-react';
import { useChat } from '@/app/hooks/useChat';

export default function ChatMonitor() {
  const {
    inquiries,
    selectedInquiry,
    messages,
    currentUser,
    loadMessages,
    sendMessage,
    refresh,
    isLoading,
    error
  } = useChat('admin') as unknown as any;

  const [activeTab, setActiveTab] = useState<'monitor' | 'admin'>('admin');
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

  const filteredInquiries = (inquiries || []).filter((inq: any) => {
    if (activeTab === 'monitor') return inq.type !== 'admin';
    return inq.type === 'admin';
  });

  // --- Keyword Detection Logic ---
  const RESTRICTED_KEYWORDS = ['전화번호', '번호', '연락처', '010', '카톡', '계좌', '입금', '송금', '오픈채팅'];

  const detectWarning = (msgs: any[]) => {
    if (activeTab === 'admin') return false; // Only warn in monitor mode
    return msgs.some(m => RESTRICTED_KEYWORDS.some(k => m.content?.includes(k)));
  };

  const renderMessageContent = (content: string) => {
    if (!content) return '';
    if (activeTab === 'admin') return content; // Don't highlight in 1:1 inquiries

    // Create a regex to match any of the keywords
    const regex = new RegExp(`(${RESTRICTED_KEYWORDS.join('|')})`, 'gi');
    const parts = content.split(regex);

    return parts.map((part, i) => {
      if (RESTRICTED_KEYWORDS.some(k => k.toLowerCase() === part.toLowerCase())) {
        return <span key={i} className="text-red-500 font-bold underline decoration-red-300 underline-offset-2 bg-red-50 px-0.5 rounded-sm">{part}</span>;
      }
      return part;
    });
  };

  const hasWarning = selectedInquiry ? detectWarning(messages) : false;

  return (
    <div className="flex h-full gap-6 w-full">
      {/* 왼쪽 목록 패널 */}
      <div className="w-1/3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm relative">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <MessageCircle size={18} /> 채팅 관리
            </h3>
            <button onClick={refresh} className="p-2 hover:bg-slate-200 rounded-full text-slate-500" title="새로고침">
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'admin' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Shield size={14} /> 1:1 문의
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'monitor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Eye size={14} /> 실시간 모니터링
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-xs break-all">
            <div className="flex items-center gap-2 font-bold mb-1"><AlertTriangle size={14} /> 오류 발생</div>
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} /> 로딩 중...
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <MessageCircle size={32} className="mb-2 opacity-20" />
              <div className="text-sm font-bold mb-1">
                {activeTab === 'monitor' ? '진행 중인 대화가 없습니다.' : '접수된 문의가 없습니다.'}
              </div>
              <button onClick={refresh} className="text-xs text-blue-600 underline mt-2">새로고침</button>
            </div>
          ) : (
            filteredInquiries.map((inq: any) => (
              <div
                key={inq.id}
                onClick={() => loadMessages(inq.id)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inq.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-sm text-slate-800 flex items-center gap-1">
                    {activeTab === 'monitor' ? (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">유저↔호스트</span>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">1:1문의</span>
                    )}
                    <span className="truncate max-w-[100px]">{getGuestName(inq.guest)}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{new Date(inq.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-slate-500 mb-1 truncate">
                  {inq.experiences?.title ? `🏠 ${inq.experiences.title}` : '📄 문의 내용'}
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{inq.content || '(내용 없음)'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽 채팅창 */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        {selectedInquiry ? (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                  {selectedInquiry.guest?.avatar_url ? (
                    <img src={selectedInquiry.guest.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <User size={24} className="text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    {getGuestName(selectedInquiry.guest)}
                    {selectedInquiry.type === 'admin' ? (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">1:1 문의</span>
                    ) : (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200">일반 유저</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {selectedInquiry.guest?.email || '이메일 정보 없음'} {selectedInquiry.guest?.phone ? ` | ${selectedInquiry.guest.phone}` : ''}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    {selectedInquiry.type === 'admin' ? (
                      <span className="text-emerald-600 font-medium">💬 관리자 직통 상담 중</span>
                    ) : (
                      <>호스트: <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{selectedInquiry.host?.full_name || '알수없음'}</span> 님과의 대화 모니터링 중</>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4 relative" ref={scrollRef}>
              {hasWarning && (
                <div className="sticky top-0 z-10 mx-auto max-w-[80%] mb-4 animate-in slide-in-from-top-2">
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold justify-center">
                    <AlertTriangle size={14} className="text-rose-500 animate-pulse" />
                    주의: 이 대화에서 개인 연락처/결제 정보 교환 시도가 감지되었습니다.
                  </div>
                </div>
              )}

              {messages.map((msg: any) => {
                const isGuest = String(msg.sender_id) === String(selectedInquiry.user_id);
                const alignRight = !isGuest;

                return (
                  <div key={msg.id} className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-400 mb-1 px-1">
                      {msg.sender?.full_name || '알 수 없음'}
                    </span>
                    <div className={`p-3 rounded-xl max-w-[70%] text-sm shadow-sm leading-relaxed ${alignRight ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <input
                className="flex-1 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:bg-white transition-all text-sm"
                placeholder={activeTab === 'monitor' ? "관리자 권한으로 메시지 전송..." : "답변을 입력하세요..."}
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
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageCircle size={64} className="mb-4 opacity-20" />
            <p className="font-medium">좌측 목록에서 대화를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}