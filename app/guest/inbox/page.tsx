'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { useChat } from '@/app/hooks/useChat';
import UserProfileModal from '@/app/components/UserProfileModal'; // 🟢 모달 임포트
import { Send, ShieldCheck, User, Loader2, ImagePlus, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가 (import 맨 아래)

function InboxContent() {
  const { t, lang } = useLanguage(); // 🟢 lang 추가 필수!
  const {
    inquiries,
    selectedInquiry,
    messages,
    currentUser,
    loadMessages,
    sendMessage,
    startNewChat,
    createInquiry,
    clearSelected,
    isLoading
  } = useChat('guest');

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🟢 프로필 모달 상태
  const [modalUserId, setModalUserId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/account');
  };

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

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    // 🟢 언어별 시간 포맷 적용
    const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };
    return new Date(dateString).toLocaleTimeString(localeMap[lang] || 'ko-KR', { hour: '2-digit', minute: '2-digit' });
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

  const handleSelectInquiry = (inqId: number | string) => {
    loadMessages(inqId);
    if (hostId || expId) router.replace('/guest/inbox');
  };

  const handleSend = async (file?: File) => {
    if (!selectedInquiry || isSending) return;
    if (!inputText.trim() && !file) return;

    setIsSending(true);
    try {
      if (selectedInquiry.id === 'new') {
        // 첫 문의 시 텍스트 필수 (이미지는 첫 문의 후 가능하도록 로직 유지 혹은 확장 가능)
        await createInquiry(selectedInquiry.host_id, selectedInquiry.experience_id, inputText);
      } else {
        await sendMessage(selectedInquiry.id, inputText, file);
      }
      setInputText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSend(file);
    }
  };

  const getDisplayHost = (inqOrSelected: {
    id?: string | number;
    host_id?: string;
    host?: { id: string; name: string; avatar_url: string | null };
  } | null | undefined) => {
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
    }
  };

  return (
    <div className="h-[100dvh] bg-white text-slate-900 font-sans flex flex-col overflow-hidden">
      <SiteHeader />

      {/* 게스트는 무조건 호스트의 프로필을 봐야 하므로 role="host" 고정 */}
      <UserProfileModal
        userId={modalUserId || ''}
        isOpen={!!modalUserId}
        onClose={() => setModalUserId(null)}
        role="host"
      />

      {/* 🟢 데스크탑 제목 — main 밖에 위치해 flex-row 내부 첨범 방지 */}
      <div className="hidden md:block max-w-[1280px] w-full mx-auto px-6 pt-8 pb-0 shrink-0">
        <h1 className="text-3xl font-black">{t('messages')}</h1>
      </div>

      {/* ── 메인 컨테이너 ── */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto flex flex-col md:flex-row md:px-6 md:py-6 md:gap-0 overflow-hidden min-h-0">

        {/* 제목 (모바일: 목록 화면에서만, 채팅창 열리면 숨김) */}
        {!selectedInquiry && (
          <div className="md:hidden px-4 pt-3 pb-1.5 shrink-0">
            <button
              onClick={handleMobileBack}
              className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-[14px] h-[14px] md:w-4 md:h-4" />
            </button>
            <h1 className="text-[18px] md:text-[20px] font-black tracking-tight mt-1.5 md:mt-2">{t('messages')}</h1>
          </div>
        )}

        {/* ──────────────── 좌측: 채팅 목록 ──────────────── */}
        <div className={`
          w-full md:w-[320px] lg:w-[380px] md:border md:border-slate-200 md:rounded-2xl
          flex flex-col overflow-hidden shrink-0
          ${selectedInquiry ? 'hidden md:flex' : 'flex flex-1'}
        `}>
          {/* 목록 헤더 (데스크탑만) */}
          <div className="hidden md:flex items-center px-4 py-3 border-b border-slate-100 bg-white shrink-0">
            <span className="font-bold text-slate-800">{t('msg_list')}</span>
          </div>

          {/* 목록 스크롤 */}
          <div className="flex-1 overflow-y-auto">
            {inquiries.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-sm">{t('msg_empty')}</div>
            )}
            {inquiries.map((inq) => {
              const display = getDisplayHost(inq);
              const lastTime = inq.updated_at
                ? new Date(inq.updated_at).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <div
                  key={inq.id}
                  onClick={() => handleSelectInquiry(inq.id)}
                  className={`relative px-3.5 md:px-4 py-3 md:py-3.5 cursor-pointer flex gap-2.5 md:gap-3 items-center border-b border-gray-100 last:border-b-0 transition-colors active:bg-gray-50 ${selectedInquiry?.id === inq.id ? 'bg-gray-50' : 'bg-white'}`}
                >
                  {/* 아바타 */}
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative ${inq.type === 'admin' ? 'bg-black text-white' : 'bg-gray-100'}`}>
                    {inq.type === 'admin' ? <ShieldCheck className="w-4 h-4 md:w-[18px] md:h-[18px] text-white" /> : (
                      <Image src={secureUrl(display.avatar)} alt="host" fill className="object-cover" />
                    )}
                  </div>

                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-[13px] md:text-[14px] truncate pr-2 ${inq.unread_count > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {inq.type === 'admin' ? t('admin_name') : display.name}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">{lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] md:text-[12px] text-gray-500 truncate flex-1">{inq.content}</span>
                      {inq.unread_count > 0 && (
                        <span className="shrink-0 w-[18px] h-[18px] md:w-5 md:h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {inq.unread_count > 9 ? '9+' : inq.unread_count}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 truncate block">{inq.experiences?.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ──────────────── 우측: 채팅창 ──────────────── */}
        {/* 🟢 이슈8: style={{ height: '100%' }} 제거 — flex-1으로 충분히 높이 결정됨, 인라인 스타일이 오히려 레이아웃 망침 */}
        <div className={`
          flex-1 flex flex-col min-h-0
          md:border md:border-slate-200 md:rounded-2xl md:ml-4
          overflow-hidden bg-white
          ${!selectedInquiry
            ? 'hidden md:flex'
            : 'fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+8px)] bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] z-[105] flex md:static md:inset-auto md:bottom-auto md:top-auto md:z-auto'
          }
        `}>
          {selectedInquiry ? (
            <>
              {/* 채팅 헤더 */}
              <div className="px-2.5 md:px-4 py-2 md:py-3 border-b border-gray-100 flex items-center gap-2 md:gap-2.5 bg-white shrink-0">
                <button
                  className="md:hidden p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelected();
                    router.replace('/guest/inbox', { scroll: false });
                  }}
                >
                  <ArrowLeft className="w-4 h-4 md:w-[18px] md:h-[18px] text-gray-700" />
                </button>
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleProfileClick(currentHostDisplay.id)}
                >
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200 relative shrink-0">
                    <Image src={secureUrl(currentHostDisplay.avatar)} alt="host" fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] md:text-[14px] leading-tight truncate">
                      {selectedInquiry.type === 'admin' ? t('admin_chat_title') : currentHostDisplay.name}
                    </div>
                    <div className="text-[10px] md:text-[11px] text-gray-500 truncate">{selectedInquiry.experiences?.title}</div>
                  </div>
                </div>
              </div>

              {/* 메시지 영역 */}
              <div className="flex-1 overflow-y-auto px-2.5 md:px-3 py-2.5 md:py-3 space-y-2.5 md:space-y-3 bg-gray-50" ref={scrollRef}>
                {messages.map((msg) => {
                  const isMe = String(msg.sender_id) === String(currentUser?.id);
                  return (
                    <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <div
                          className="flex flex-col items-center mr-1.5 cursor-pointer"
                          onClick={() => handleProfileClick(msg.sender_id)}
                        >
                          <div className="w-[26px] h-[26px] md:w-7 md:h-7 rounded-full bg-gray-200 overflow-hidden relative border border-gray-200 shrink-0">
                            <Image
                              src={secureUrl(selectedInquiry.type === 'admin' ? null : currentHostDisplay.avatar)}
                              alt="sender" fill className="object-cover"
                            />
                          </div>
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
                        {!isMe && (
                          <span className="text-[10px] text-gray-500 mb-0.5 ml-0.5 cursor-pointer" onClick={() => handleProfileClick(msg.sender_id)}>
                            {msg.sender?.name || currentHostDisplay.name}
                          </span>
                        )}

                        <div className="flex items-end gap-1.5">
                          {isMe && (
                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-[9px] font-bold text-blue-500">{msg.is_read ? '' : '1'}</span>
                              <span className="text-[9px] text-gray-400" suppressHydrationWarning>{formatTime(msg.created_at)}</span>
                            </div>
                          )}

                          <div className={`px-2.5 md:px-3 py-1.5 md:py-2 rounded-2xl text-[12px] md:text-[13px] leading-[1.45] md:leading-relaxed shadow-sm break-words ${isMe ? 'bg-black text-white rounded-tr-sm' : 'bg-white border border-gray-200 rounded-tl-sm'}`}>
                            {msg.type === 'image' && msg.image_url && (
                              <div className="mb-1 rounded-lg overflow-hidden">
                                <a href={msg.image_url} rel="noopener noreferrer">
                                  <Image src={msg.image_url} alt="chat-img" width={240} height={240} className="w-full h-auto object-cover hover:opacity-90 transition-opacity" />
                                </a>
                              </div>
                            )}
                            {msg.content}
                          </div>

                          {!isMe && (
                            <span className="text-[9px] text-gray-400 mb-0.5 shrink-0" suppressHydrationWarning>{formatTime(msg.created_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 입력 바 */}
              <div className="px-2.5 md:px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-1.5 md:gap-2 shrink-0">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || selectedInquiry.id === 'new'}
                  className="h-8 w-8 md:h-9 md:w-9 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-30"
                >
                  <ImagePlus className="w-[14px] h-[14px] md:w-4 md:h-4" />
                </button>

                <input
                  className="flex-1 h-9 md:h-10 border border-gray-200 rounded-full px-3.5 md:px-4 text-[12px] md:text-[13px] focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 disabled:cursor-not-allowed"
                  placeholder={t('msg_placeholder')}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isSending}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={(!inputText.trim()) || isSending}
                  className="h-8 w-8 md:h-9 md:w-9 flex items-center justify-center bg-black text-white rounded-full hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
                >
                  {isSending ? <Loader2 className="animate-spin w-[14px] h-[14px] md:w-[15px] md:h-[15px]" /> : <Send className="w-[14px] h-[14px] md:w-[15px] md:h-[15px]" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center text-slate-400 flex-col gap-2">
              <div className="p-4 bg-slate-50 rounded-full"><User size={28} className="text-slate-300" /></div>
              <p className="text-sm">{t('msg_select_chat')}</p>
            </div>
          )}
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
