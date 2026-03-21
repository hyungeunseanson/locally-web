'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { MessageCircle, User, Send, RefreshCw, Loader2, AlertTriangle, Eye, Shield, Mail, Phone } from 'lucide-react';
import { useAdminChatQuery } from '../hooks/useAdminChatQuery';
import { isAdminSupportInquiry } from '@/app/utils/inquiry';
import { useToast } from '@/app/context/ToastContext';

type CSStatus = 'open' | 'in_progress' | 'resolved';
type CSStatusFilter = 'ALL' | CSStatus;

const CS_STATUS_LABELS: Record<CSStatus, string> = { open: '대기', in_progress: '처리중', resolved: '완료' };
const CS_STATUS_COLORS: Record<CSStatus, string> = {
  open: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
};

type MonitorGuest = {
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
};

type MonitorInquiry = {
  id: number | string;
  type?: string | null;
  guest?: MonitorGuest;
  host?: { id?: string | null; name?: string | null; avatar_url?: string | null; email?: string | null; phone?: string | null; status?: string | null };
  experiences?: { title?: string | null } | null;
  user_id: string;
  updated_at?: string | null;
  content?: string | null;
  has_policy_signal?: boolean;
  policy_signal_categories?: string[];
};

export default function ChatMonitor() {
  const searchParams = useSearchParams();
  const targetInquiryId = searchParams.get('inquiryId');
  const router = useRouter();
  const pathname = usePathname();

  const {
    inquiries,
    selectedInquiry,
    messages,
    loadMessages,
    clearSelected,
    sendMessage,
    refresh,
    isLoading,
    error
  } = useAdminChatQuery();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'monitor' | 'admin'>('admin');
  const [csStatusFilter, setCsStatusFilter] = useState<CSStatusFilter>('ALL');
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // URL ?inquiryId=X 파라미터로 특정 1:1 문의 자동 선택 (DetailsPanel에서 CS 개시 후 이동)
  useEffect(() => {
    if (!targetInquiryId || !inquiries?.length) return;
    const target = inquiries.find((inq: MonitorInquiry) => String(inq.id) === String(targetInquiryId));
    if (target) {
      setActiveTab('admin');
      loadMessages(target.id);
    }
  }, [targetInquiryId, inquiries, loadMessages]);

  const handleClearSelected = () => {
    clearSelected();
    if (targetInquiryId) {
      router.replace(pathname, { scroll: false });
    }
  };

  const handleUpdateCSStatus = async (inquiryId: number | string, newStatus: CSStatus) => {
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, updated_at: selectedInquiry?.updated_at }),
      });

      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '문의 상태 변경 실패');
      }

      refresh();
      return true;
    } catch (error) {
      console.error('[ChatMonitor] update status failed:', error);
      const message = error instanceof Error ? error.message : '문의 상태 변경 실패';
      showToast(message, 'error');
      return false;
    }
  };

  const handleSend = async () => {
    if (selectedInquiry && replyText.trim()) {
      try {
        await sendMessage(selectedInquiry.id, replyText);
        setReplyText('');

        // 🟢 첫 번째 답변 시: '대기(open)' 상태를 '처리중(in_progress)'으로 자동 전환
        if (activeTab === 'admin' && isAdminSupportInquiry(selectedInquiry.type)) {
          const currentStatus = selectedInquiry.status;
          if (!currentStatus || currentStatus === 'open') {
            await handleUpdateCSStatus(selectedInquiry.id, 'in_progress');
          }
        }
      } catch (error) {
        console.error('[ChatMonitor] sendMessage failed:', error);
        const message = error instanceof Error ? error.message : '메시지 전송 실패';
        showToast(message, 'error');
      }
    }
  };

  const getGuestName = (guest?: MonitorGuest) => {
    if (!guest) return '알 수 없는 사용자';
    return guest.full_name || guest.name || guest.email || '익명 고객';
  };

  const filteredInquiries = (inquiries || []).filter((inq) => {
    if (activeTab === 'monitor') return !isAdminSupportInquiry(inq.type);
    if (!isAdminSupportInquiry(inq.type)) return false;
    if (csStatusFilter === 'ALL') return true;
    // 상태 미설정(null) 문의는 'open' 필터에도 포함
    if (csStatusFilter === 'open') return !inq.status || inq.status === 'open';
    return inq.status === csStatusFilter;
  });

  const selectedIsAdminSupport = isAdminSupportInquiry(selectedInquiry?.type);
  const hasWarning = selectedInquiry
    ? Boolean(selectedInquiry.has_policy_signal || messages.some((message) => message.has_policy_signal))
    : false;

  return (
    <div className="flex h-[calc(100dvh-190px)] md:h-[calc(100dvh-230px)] lg:h-[calc(100dvh-260px)] gap-4 md:gap-6 w-full relative">
      {/* 왼쪽 목록 패널 */}
      <div className={`w-full md:w-[360px] md:min-w-[340px] bg-white rounded-xl md:rounded-2xl border border-slate-200 flex flex-col shadow-sm transition-all duration-300 ${selectedInquiry ? 'hidden md:flex' : 'flex'} h-full`}>
        <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="font-bold text-sm md:text-lg text-slate-800 flex items-center gap-1.5 md:gap-2">
              <MessageCircle size={14} className="md:w-[18px] md:h-[18px]" /> 채팅 관리
            </h3>
            <button onClick={() => refresh(true)} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-500" title="새로고침">
              <RefreshCw size={14} className={`md:w-4 md:h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded-lg md:rounded-xl">
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-[10px] md:text-xs font-bold rounded-md md:rounded-lg transition-all ${activeTab === 'admin' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Shield size={12} className="md:w-3.5 md:h-3.5" /> 1:1 문의
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-[10px] md:text-xs font-bold rounded-md md:rounded-lg transition-all ${activeTab === 'monitor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Eye size={12} className="md:w-3.5 md:h-3.5" /> 실시간 모니터링
            </button>
          </div>

          {/* CS 상태 필터 (1:1 문의 탭에서만 노출) */}
          {activeTab === 'admin' && (
            <div className="flex gap-1 flex-wrap mt-2">
              {(['ALL', 'open', 'in_progress', 'resolved'] as CSStatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setCsStatusFilter(s)}
                  className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold border transition-colors ${csStatusFilter === s
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {s === 'ALL' ? '전체' : CS_STATUS_LABELS[s as CSStatus]}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-xs break-all">
            <div className="flex items-center gap-2 font-bold mb-1"><AlertTriangle size={14} /> 오류 발생</div>
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs md:text-sm">
              <Loader2 className="animate-spin mr-2 w-4 h-4 md:w-5 md:h-5" /> 로딩 중...
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 md:p-8 text-center">
              <MessageCircle className="mb-2 opacity-20 w-6 h-6 md:w-8 md:h-8" />
              <div className="text-xs md:text-sm font-bold mb-1">
                {activeTab === 'monitor' ? '진행 중인 대화가 없습니다.' : '접수된 문의가 없습니다.'}
              </div>
              <button onClick={() => refresh(true)} className="text-[10px] md:text-xs text-blue-600 underline mt-1 md:mt-2">새로고침</button>
            </div>
          ) : (
            filteredInquiries.map((inq) => (
              <div
                key={inq.id}
                onClick={() => loadMessages(inq.id)}
                className={`p-3 md:p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedInquiry?.id === inq.id ? 'bg-blue-50 border-l-[3px] md:border-l-4 border-l-blue-500' : 'border-l-[3px] md:border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs md:text-sm text-slate-800 flex items-center gap-1">
                    {activeTab === 'monitor' ? (
                      <span className="text-[8px] md:text-[10px] bg-slate-100 text-slate-500 px-1 md:px-1.5 py-0.5 rounded whitespace-nowrap">유저↔호스트</span>
                    ) : (
                      <span className={`text-[8px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded border whitespace-nowrap ${CS_STATUS_COLORS[(inq.status as CSStatus) || 'open'] || CS_STATUS_COLORS.open}`}>
                        {CS_STATUS_LABELS[(inq.status as CSStatus) || 'open'] || '대기'}
                      </span>
                    )}
                    <span className="truncate max-w-[80px] md:max-w-[100px]">{getGuestName(inq.guest)}</span>
                  </span>
                  <span className="text-[9px] md:text-[10px] text-slate-400 shrink-0">{inq.updated_at ? new Date(inq.updated_at).toLocaleDateString() : ''}</span>
                </div>
                <div className="text-[10px] md:text-xs text-slate-500 mb-0.5 md:mb-1 truncate">
                  {inq.experiences?.title ? `🏠 ${inq.experiences.title}` : '📄 문의 내용'}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs md:text-sm text-slate-600 line-clamp-1 flex-1">{inq.content || '(내용 없음)'}</p>
                  {inq.has_policy_signal && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] md:text-[10px] font-bold text-rose-700 border border-rose-200">
                      <AlertTriangle size={10} />
                      정책위반 의심
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽 채팅창 (모바일에서는 오버레이처럼 보이거나 교체됨) */}
      {/* 🟢 이슈5: 데스크탑에서 채팅창이 fullscreen으로 뜨는 문제 수정 — fixed/inset-0/w-[100vw]/h-[100vh]를 모바일 전용으로 제한 */}
      <div className={`flex-1 bg-white md:rounded-2xl border-l-[0px] md:border-l border-slate-200 md:border-slate-200 flex flex-col shadow-sm transition-all duration-300 ${selectedInquiry ? 'flex fixed inset-x-0 top-14 bottom-0 z-[100] w-full h-auto -ml-0 md:ml-0 md:static md:inset-auto md:top-auto md:bottom-auto md:w-auto md:h-auto md:z-0 md:flex-1 md:rounded-2xl' : 'hidden md:flex'}`}>
        {selectedInquiry ? (
          <>
            <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center relative gap-2 shrink-0 pt-3 md:pt-4">
              {/* CS 상태 변경 버튼 (1:1 문의 탭에서만) */}
              {activeTab === 'admin' && selectedIsAdminSupport && (
                <div className="absolute top-2 right-2 md:top-3 md:right-3 flex gap-1 z-10">
                  {(['open', 'in_progress', 'resolved'] as CSStatus[]).map((s) => {
                    const currentStatus = selectedInquiry.status;
                    const isActive = currentStatus === s || (!currentStatus && s === 'open');
                    return (
                      <button
                        key={s}
                        onClick={() => handleUpdateCSStatus(selectedInquiry.id, s)}
                        className={`px-1.5 md:px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold border transition-all ${isActive
                          ? CS_STATUS_COLORS[s] + ' shadow-sm'
                          : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {CS_STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-1.5 md:gap-4 min-w-0">
                <button
                  onClick={handleClearSelected} // 목록으로 돌아가기
                  className="md:hidden p-1.5 -ml-1 text-slate-500 shrink-0 bg-slate-100 rounded-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>

                <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm shrink-0">
                  {selectedInquiry.guest?.avatar_url ? (
                    <Image src={selectedInquiry.guest.avatar_url} className="w-full h-full object-cover" alt="Profile" width={48} height={48} />
                  ) : (
                    <User className="text-slate-400 w-4 h-4 md:w-6 md:h-6" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="font-bold text-xs md:text-lg text-slate-900 flex items-center gap-1 md:gap-2 truncate">
                    <span className="truncate">{getGuestName(selectedInquiry.guest)}</span>
                    {selectedIsAdminSupport ? (
                      <span className="text-[7px] md:text-[10px] bg-green-100 text-green-700 px-1 md:px-2 py-0.5 rounded-full font-bold border border-green-200 shrink-0">1:1 문의</span>
                    ) : (
                      <span className="text-[7px] md:text-[10px] bg-blue-100 text-blue-700 px-1 md:px-2 py-0.5 rounded-full font-bold border border-blue-200 shrink-0">일반 유저</span>
                    )}
                  </div>
                  <div className="text-[8px] md:text-[11px] text-slate-500 font-medium truncate leading-none">
                    {selectedInquiry.guest?.email || '이메일 정보 없음'} {selectedInquiry.guest?.phone ? ` | ${selectedInquiry.guest.phone}` : ''}
                  </div>
                  <div className="text-[8px] md:text-[11px] text-slate-400 flex items-center gap-1 mt-0 md:mt-0.5 truncate leading-none">
                    {selectedIsAdminSupport ? (
                      <span className="text-emerald-600 font-medium whitespace-nowrap">💬 관리자 직통 상담 중</span>
                    ) : (
                      <span className="truncate">호스트: <span className="font-bold text-slate-700 bg-slate-100 px-1 py-0 md:px-1.5 md:py-0.5 rounded">{selectedInquiry.host?.name || '알수없음'}</span> 님과의 대화 모니터링</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 md:px-4 py-3 border-b border-slate-100 bg-white">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase mb-2">Guest</div>
                  <div className="text-xs md:text-sm font-bold text-slate-900">{getGuestName(selectedInquiry.guest)}</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] md:text-[12px] text-slate-600">
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{selectedInquiry.guest?.email || '이메일 정보 없음'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] md:text-[12px] text-slate-600">
                      <Phone size={12} className="shrink-0" />
                      <span className="truncate">{selectedInquiry.guest?.phone || '전화번호 정보 없음'}</span>
                    </div>
                  </div>
                </div>

                {!selectedIsAdminSupport && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase mb-2">Host</div>
                    <div className="text-xs md:text-sm font-bold text-slate-900">{selectedInquiry.host?.name || '호스트 정보 없음'}</div>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] md:text-[12px] text-slate-600">
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate">{selectedInquiry.host?.email || '이메일 정보 없음'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] md:text-[12px] text-slate-600">
                        <Phone size={12} className="shrink-0" />
                        <span className="truncate">{selectedInquiry.host?.phone || '전화번호 정보 없음'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 p-3 md:p-6 overflow-y-auto bg-slate-50 space-y-3 md:space-y-4 relative custom-scrollbar" ref={scrollRef}>
              {hasWarning && (
                <div className="sticky top-0 z-10 mx-auto max-w-[80%] mb-4 animate-in slide-in-from-top-2">
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold justify-center">
                    <AlertTriangle size={14} className="text-rose-500 animate-pulse" />
                    주의: 이 대화에서 개인 연락처/결제 정보 교환 시도가 감지되었습니다.
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isGuest = String(msg.sender_id) === String(selectedInquiry.user_id);
                const alignRight = !isGuest;
                // 🟢 관리자 탭 한정: 관리자가 답변 시 "로컬리 (실명)" 형식으로 표출하여 팀 내 추적성 확보
                const isAdminReply = alignRight && isAdminSupportInquiry(selectedInquiry.type);
                const displayName = isAdminReply ? `로컬리 (${msg.sender?.name || '알 수 없음'})` : (msg.sender?.name || '알 수 없음');

                return (
                  <div key={msg.id} className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] md:text-[10px] text-slate-400 mb-0.5 md:mb-1 px-1">
                      {displayName}
                    </span>
                    {msg.has_policy_signal && (
                      <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[8px] md:text-[10px] font-bold text-rose-700 border border-rose-200">
                        <AlertTriangle size={10} />
                        정책위반 의심
                      </div>
                    )}
                    <div className={`p-2.5 md:p-3 rounded-lg md:rounded-xl max-w-[85%] md:max-w-[70%] text-xs md:text-sm shadow-sm leading-relaxed ${msg.has_policy_signal
                      ? 'border border-rose-200 bg-rose-50 text-rose-900'
                      : alignRight
                        ? 'bg-black text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'
                      }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-2 md:p-4 bg-white border-t border-slate-100 flex gap-1.5 md:gap-2 shrink-0 pb-2 md:pb-4">
              <input
                className="flex-1 border border-slate-200 bg-slate-50 rounded-lg md:rounded-xl px-2.5 md:px-4 py-2 md:py-3 focus:outline-none focus:border-black focus:bg-white transition-all text-[11px] md:text-sm"
                placeholder={activeTab === 'monitor' ? "관리자 권한 메시지 전송..." : "답변을 입력하세요..."}
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
              <button onClick={handleSend} className="bg-black text-white px-3 md:px-5 py-2 rounded-lg md:rounded-xl hover:bg-slate-800 transition-colors shrink-0 flex items-center justify-center">
                <Send className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex flex-col items-center justify-center text-slate-300">
            <MessageCircle size={64} className="mb-4 opacity-20" />
            <p className="font-medium text-sm">좌측 목록에서 대화를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
