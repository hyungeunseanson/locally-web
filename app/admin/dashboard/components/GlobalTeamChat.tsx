'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/app/utils/supabase/client';
import { Send, MessageSquare, ChevronUp, ChevronDown, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePathname, useSearchParams } from 'next/navigation';

// ─── 리액션 이모지 목록 ───────────────────────────────────────────────────────
const REACTION_EMOJIS = ['❤️', '✅', '🙏'] as const;
type ReactionEmoji = typeof REACTION_EMOJIS[number];

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    task_id: string;
    content: string;
    author_id: string;
    author_name: string;
    created_at: string;
    metadata?: { image_url?: string };
    // Phase 2: 리액션 { "❤️": ["uid1","uid2"], "✅": ["uid3"] }
    reactions?: Record<string, string[]>;
    // Phase 3: 읽음 처리 (읽은 사용자 id 배열)
    read_by?: string[];
}

interface CurrentAdminUser {
    id: string;
    name: string;
}

export default function GlobalTeamChat() {
    const [currentUser, setCurrentUser] = useState<CurrentAdminUser | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ file: File; url: string } | null>(null);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    // 리액션 팝업: 열린 메시지 id
    const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

    const desktopScrollRef = useRef<HTMLDivElement>(null);
    const mobileScrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // isOpen 최신값을 closure 안에서 안전하게 읽기 위한 ref (Chrome 재구독 버그 방지)
    const isOpenRef = useRef(false);
    const currentUserRef = useRef<CurrentAdminUser | null>(null);

    const supabase = createClient();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get('tab')?.toUpperCase();
    const isTeamWorkspace = pathname?.startsWith('/admin/dashboard') && activeTab === 'TEAM';
    const CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000';

    // ─── ref 동기화 ──────────────────────────────────────────────────────────
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

    // ─── 스크롤 헬퍼 ─────────────────────────────────────────────────────────
    const scrollToBottom = useCallback((delay = 0) => {
        const scroll = () => {
            if (desktopScrollRef.current) desktopScrollRef.current.scrollTop = desktopScrollRef.current.scrollHeight;
            if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
        };
        if (delay > 0) { setTimeout(scroll, delay); return; }
        scroll();
    }, []);

    // ─── Phase 3: 읽음 처리 ──────────────────────────────────────────────────
    const markMessagesRead = useCallback(async (msgs: ChatMessage[], userId: string) => {
        // 자신이 아직 read_by에 없는 메시지들만 업데이트
        const unreadIds = msgs
            .filter(m => m.author_id !== userId && !(m.read_by || []).includes(userId))
            .filter(m => !m.id.startsWith('temp_'))
            .map(m => m.id);

        if (unreadIds.length === 0) return;

        const unreadSet = new Set(unreadIds);
        // 낙관적 UI 업데이트
        setMessages(prev => prev.map(m =>
            unreadSet.has(m.id)
                ? { ...m, read_by: [...new Set([...(m.read_by || []), userId])] }
                : m
        ));

        const { error } = await supabase.rpc('mark_room_messages_read', {
            p_room_id: CHAT_ROOM_ID,
            p_user_id: userId
        });

        if (error) {
            console.error('mark_room_messages_read failed:', error);
        }
    }, [supabase, CHAT_ROOM_ID]);

    // ─── 초기화: Auth & Admin check ──────────────────────────────────────────
    useEffect(() => {
        setIsClient(true);
        if (!isTeamWorkspace) {
            setCurrentUser(null);
            return;
        }

        const initChat = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [userData, whitelistData] = await Promise.all([
                supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
                supabase.from('admin_whitelist').select('id').eq('email', user.email || '').maybeSingle()
            ]);

            const isAdmin = userData.data?.role === 'admin' || !!whitelistData.data;
            if (isAdmin) {
                setCurrentUser({
                    id: user.id,
                    name: user.email?.split('@')[0] || 'Admin'
                });
            }
        };

        initChat();
    }, [isTeamWorkspace]);

    // ─── 메시지 fetch + 실시간 구독 ──────────────────────────────────────────
    // 핵심 수정: isOpen을 deps에서 제거 → 채팅창 토글마다 채널 재구독 방지 (Chrome 성능 버그)
    useEffect(() => {
        if (!isTeamWorkspace || !currentUser) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('admin_task_comments')
                .select('*')
                .eq('task_id', CHAT_ROOM_ID)
                .order('created_at', { ascending: true })
                .limit(100);

            if (data) {
                setMessages(data);
                if (isOpenRef.current) {
                    scrollToBottom(120);
                } else if (data.length > 0) {
                    const lastMsg = data[data.length - 1];
                    const lastViewed = localStorage.getItem('global_chat_last_viewed');
                    if (
                        lastMsg.author_id !== currentUser.id &&
                        (!lastViewed || new Date(lastMsg.created_at) > new Date(lastViewed))
                    ) {
                        setHasUnread(true);
                    }
                }
            }
        };

        fetchMessages();

        const channel = supabase.channel('global_admin_chat_v2')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'admin_task_comments',
                filter: `task_id=eq.${CHAT_ROOM_ID}`
            }, (payload) => {
                const newMsg = payload.new as ChatMessage;
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    // Optimistic UI 교체: temp_ + created_at 기반 (content 기반 제거 → 중복 방지)
                    const filtered = prev.filter(m => {
                        if (!m.id.startsWith('temp_')) return true;
                        const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime());
                        return !(m.author_id === newMsg.author_id && timeDiff < 5000);
                    });
                    return [...filtered, newMsg];
                });

                // isOpenRef로 stale closure 방지
                if (!isOpenRef.current && newMsg.author_id !== currentUserRef.current?.id) {
                    setHasUnread(true);
                } else if (isOpenRef.current) {
                    scrollToBottom(120);
                    // 새 메시지 자동 읽음 처리
                    if (currentUserRef.current && newMsg.author_id !== currentUserRef.current.id) {
                        markMessagesRead([newMsg], currentUserRef.current.id);
                    }
                }
            })
            // Phase 2 + Phase 3: UPDATE 이벤트 구독 (리액션, 읽음처리 반영)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'admin_task_comments',
                filter: `task_id=eq.${CHAT_ROOM_ID}`
            }, (payload) => {
                const updated = payload.new as ChatMessage;
                setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser, isTeamWorkspace, scrollToBottom]); // isOpen 제거됨

    // ─── 채팅창 오픈/클로즈 사이드이펙트 ────────────────────────────────────
    useEffect(() => {
        if (!isTeamWorkspace) {
            setIsOpen(false);
            setHasUnread(false);
            document.body.style.overflow = '';
            return;
        }

        if (isOpen) {
            setHasUnread(false);
            localStorage.setItem('global_chat_last_viewed', new Date().toISOString());
            setReactionPickerFor(null);
            scrollToBottom(50);
            scrollToBottom(220);

            // Phase 3: 채팅 오픈 시 안 읽은 메시지 읽음 처리
            if (currentUser && messages.length > 0) {
                markMessagesRead(messages, currentUser.id);
            }

            if (window.innerWidth < 768) {
                document.body.style.overflow = 'hidden';
            }
        } else {
            document.body.style.overflow = '';
        }

        return () => { document.body.style.overflow = ''; };
    }, [isOpen, isTeamWorkspace]); // 열릴 때 읽음 반영

    // ─── 파일 처리 ────────────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSelectedImage({ file, url: URL.createObjectURL(file) });
    };

    const clearSelectedImage = () => {
        if (selectedImage) URL.revokeObjectURL(selectedImage.url);
        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadImage = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `chat_images/${fileName}`;
        const { error } = await supabase.storage.from('admin_files').upload(filePath, file);
        if (error) throw error;
        const { data } = supabase.storage.from('admin_files').getPublicUrl(filePath);
        return data.publicUrl;
    };

    // ─── 메시지 전송 ──────────────────────────────────────────────────────────
    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!newMessage.trim() && !selectedImage) || !currentUser || isUploading) return;

        let imageUrl: string | undefined;
        const messageText = newMessage;
        const tempId = `temp_${Date.now()}`;

        const opMessage: ChatMessage = {
            id: tempId,
            task_id: CHAT_ROOM_ID,
            content: messageText || '사진 전송 중...',
            author_id: currentUser.id,
            author_name: currentUser.name,
            created_at: new Date().toISOString(),
            metadata: selectedImage ? { image_url: selectedImage.url } : undefined,
            reactions: {},
            read_by: [currentUser.id]
        };

        setMessages(prev => [...prev, opMessage]);
        setNewMessage('');
        const imageToUpload = selectedImage;
        clearSelectedImage();
        scrollToBottom();
        scrollToBottom(120);

        try {
            if (imageToUpload) {
                setIsUploading(true);
                imageUrl = await uploadImage(imageToUpload.file);
            }

            await supabase.from('admin_task_comments').insert({
                task_id: CHAT_ROOM_ID,
                content: messageText || '사진을 1장 보냈습니다.',
                author_id: currentUser.id,
                author_name: currentUser.name,
                metadata: imageUrl ? { image_url: imageUrl } : null,
                reactions: {},
                read_by: [currentUser.id]
            });

            fetch('/api/admin/notify-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Team Chat에 새로운 메시지가 도착했습니다.`,
                    message: `${currentUser.name}: ${messageText || '(사진)'}`,
                    link: '/admin/dashboard?tab=TEAM'
                })
            }).catch(e => console.error('Notify error:', e));

        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            alert('메시지 전송에 실패했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    // ─── Phase 2: 리액션 토글 ────────────────────────────────────────────────
    const handleReaction = async (msgId: string, emoji: ReactionEmoji) => {
        if (!currentUser) return;
        setReactionPickerFor(null);

        setMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m;
            const reactions = { ...(m.reactions || {}) };
            const users = reactions[emoji] ? [...reactions[emoji]] : [];
            const idx = users.indexOf(currentUser.id);
            if (idx === -1) users.push(currentUser.id);
            else users.splice(idx, 1);
            reactions[emoji] = users;
            return { ...m, reactions };
        }));

        const msg = messages.find(m => m.id === msgId);
        if (!msg || msgId.startsWith('temp_')) return;

        const reactions = { ...(msg.reactions || {}) };
        const users = reactions[emoji] ? [...reactions[emoji]] : [];
        const idx = users.indexOf(currentUser.id);
        if (idx === -1) users.push(currentUser.id);
        else users.splice(idx, 1);
        reactions[emoji] = users;

        await supabase.from('admin_task_comments').update({ reactions }).eq('id', msgId);
    };

    // ─── 렌더: 리액션 집계 표시 ──────────────────────────────────────────────
    const renderReactions = (msg: ChatMessage, isMe: boolean) => {
        const reactions = msg.reactions || {};
        const activeEmojis = REACTION_EMOJIS.filter(e => (reactions[e] || []).length > 0);
        if (activeEmojis.length === 0) return null;

        return (
            <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {activeEmojis.map(emoji => {
                    const users = reactions[emoji] || [];
                    const iMine = currentUser ? users.includes(currentUser.id) : false;
                    return (
                        <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-all ${iMine
                                ? 'bg-rose-50 border-rose-200 text-rose-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span>{emoji}</span>
                            <span className="font-semibold">{users.length}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    // ─── 렌더: 읽음 표시 ─────────────────────────────────────────────────────
    const renderReadBy = (msg: ChatMessage, isLastFromMe: boolean) => {
        if (!isLastFromMe || !currentUser) return null;
        const readBy = (msg.read_by || []).filter(id => id !== currentUser.id);
        if (readBy.length === 0) return null;
        return (
            <div className="text-[9px] text-slate-400 mt-0.5 text-right">
                읽음 {readBy.length}명
            </div>
        );
    };

    // ─── 렌더: 메시지 목록 ───────────────────────────────────────────────────
    const renderMessages = (isMobile = false) => {
        const meId = currentUser?.id;
        if (messages.length === 0) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                        <MessageSquare size={22} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">첫 메시지를 남겨보세요.</p>
                    <p className="text-xs text-slate-500 mt-1.5 text-center leading-relaxed">메시지와 사진은 실시간 유지됩니다.</p>
                </div>
            );
        }

        // 내가 보낸 마지막 메시지 id (읽음 표시용)
        const myMsgs = messages.filter(m => m.author_id === meId);
        const lastMyMsgId = myMsgs.length > 0 ? myMsgs[myMsgs.length - 1].id : null;

        return messages.map((msg, idx) => {
            const isMe = Boolean(meId) && msg.author_id === meId;
            const showAuthorInfo = idx === 0 || messages[idx - 1].author_id !== msg.author_id;
            const maxW = isMobile ? 'max-w-[75vw]' : 'max-w-[240px]';
            const isLastFromMe = isMe && msg.id === lastMyMsgId;

            return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && showAuthorInfo && (
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-1.5 ml-1">
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] md:text-[9px] font-bold text-slate-600">
                                {msg.author_name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[10px] md:text-[11px] font-bold text-slate-600">{msg.author_name}</span>
                        </div>
                    )}

                    {/* 메시지 버블 + 리액션 피커 트리거 */}
                    <div className="flex items-end gap-1.5 group relative">
                        {isMe && (
                            <span className="text-[10px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {format(new Date(msg.created_at), 'aa h:mm', { locale: ko })}
                            </span>
                        )}

                        <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            {msg.metadata?.image_url && (
                                <div
                                    onClick={() => setZoomImage(msg.metadata!.image_url!)}
                                    className={`p-1 bg-white border border-slate-200 ${maxW} cursor-pointer hover:opacity-90 transition-opacity rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                                >
                                    <img src={msg.metadata.image_url} alt="attached" className="rounded-xl w-full object-cover max-h-48" loading="lazy" />
                                </div>
                            )}
                            {msg.content && msg.content !== '사진 전송 중...' && msg.content !== '사진을 1장 보냈습니다.' && (
                                <div className={`px-3 py-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[13px] leading-relaxed break-words whitespace-pre-wrap ${maxW} ${isMe ? 'bg-black text-white rounded-2xl rounded-tr-sm rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm rounded-bl-sm'}`}>
                                    {msg.content}
                                </div>
                            )}
                            {msg.content === '사진 전송 중...' && (
                                <div className="px-3 py-1.5 text-xs bg-slate-100 text-slate-500 rounded-2xl animate-pulse border border-slate-200">사진 전송 중...</div>
                            )}
                            {/* 리액션 집계 표시 */}
                            {renderReactions(msg, isMe)}
                            {/* 읽음 표시 */}
                            {renderReadBy(msg, isLastFromMe)}
                        </div>

                        {!isMe && (
                            <span className="text-[10px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {format(new Date(msg.created_at), 'aa h:mm', { locale: ko })}
                            </span>
                        )}

                        {/* 리액션 피커 버튼 - hover 시 표시 */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setReactionPickerFor(prev => prev === msg.id ? null : msg.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 text-[13px] mb-0.5 shrink-0"
                            title="리액션 추가"
                        >
                            😊
                        </button>

                        {/* 리액션 피커 팝업 */}
                        {reactionPickerFor === msg.id && (
                            <div
                                className={`absolute bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} bg-white border border-slate-200 rounded-2xl shadow-lg px-2 py-1.5 flex gap-1 z-50`}
                                onClick={e => e.stopPropagation()}
                            >
                                {REACTION_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReaction(msg.id, emoji)}
                                        className="text-xl hover:scale-125 transition-transform p-0.5 rounded-lg hover:bg-slate-50"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        });
    };

    // ─── 렌더: 입력 영역 ─────────────────────────────────────────────────────
    const renderInput = (isMobile = false) => (
        <div className={`border-t border-slate-200 bg-white z-10 ${isMobile ? 'p-2.5' : 'p-3'}`}>
            {selectedImage && (
                <div className="mb-2 relative inline-block">
                    <div className="p-1 border border-slate-200 rounded-xl bg-slate-50 relative">
                        <img src={selectedImage.url} alt="preview" className="h-16 w-auto rounded-lg object-cover" />
                        <button onClick={clearSelectedImage} className="absolute -top-1.5 -right-1.5 bg-slate-800 text-white p-0.5 rounded-full shadow-md hover:bg-slate-900">
                            <X size={10} />
                        </button>
                    </div>
                </div>
            )}
            <form onSubmit={sendMessage} className="flex gap-2 items-end">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors shrink-0 ${isMobile ? 'p-2' : 'p-2.5'}`}
                >
                    <Paperclip size={isMobile ? 17 : 19} />
                </button>
                <textarea
                    rows={1}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                        const native = e.nativeEvent as KeyboardEvent;
                        if (native.isComposing) return;
                        if (e.key === 'Enter') {
                            if (native.shiftKey) return;
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    placeholder="메시지를 입력하세요..."
                    className={`flex-1 text-[11px] md:text-[13px] bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-2xl outline-none transition-all placeholder:text-slate-400 resize-none ${isMobile ? 'px-3 py-2' : 'px-4 py-3'}`}
                    disabled={isUploading}
                />
                <button
                    type="submit"
                    disabled={(!newMessage.trim() && !selectedImage) || isUploading}
                    className={`bg-black text-white flex items-center justify-center rounded-full shadow-md hover:bg-slate-800 disabled:opacity-40 disabled:bg-slate-300 disabled:shadow-none transition-all shrink-0 ${isMobile ? 'w-9 h-9' : 'w-10 h-10'}`}
                >
                    <Send size={isMobile ? 14 : 16} className={isUploading ? 'animate-pulse' : ''} />
                </button>
            </form>
        </div>
    );

    if (!isClient || !currentUser || !isTeamWorkspace) return null;

    return (
        <>
            {/* ── 데스크탑: 우하단 플로팅 패널 ── */}
            <div
                className={`hidden md:flex fixed bottom-0 right-10 w-96 bg-white border border-slate-200 rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] transition-all duration-300 z-50 flex-col ${isOpen ? 'h-[650px]' : 'h-12 hover:-translate-y-1'}`}
                onClick={() => reactionPickerFor && setReactionPickerFor(null)}
            >
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full h-12 px-5 flex items-center justify-between border-b border-slate-800 bg-black text-white rounded-t-2xl hover:bg-slate-900 transition-colors shrink-0"
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare size={18} />
                        <span className="font-bold tracking-tight">Team Chat</span>
                        {hasUnread && !isOpen && (
                            <span className="w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center ml-2 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]">N</span>
                        )}
                    </div>
                    {isOpen ? <ChevronDown size={20} className="text-slate-300" /> : <ChevronUp size={20} className="text-slate-300" />}
                </button>

                {/* 항상 렌더 (CSS visibility 제어) → scrollRef null 버그 방지 */}
                <div className={`flex flex-col flex-1 min-h-0 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
                    <div ref={desktopScrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/80 scrollbar-thin">
                        {renderMessages()}
                    </div>
                    {renderInput()}
                </div>
            </div>

            {/* ── 모바일: 슬라이드업 드로어 ── */}
            <div className="md:hidden">
                <div
                    className="fixed left-0 right-0 z-[9990] bg-white flex flex-col transition-all duration-300 ease-in-out"
                    style={{
                        bottom: 48,
                        maxHeight: isOpen ? '65vh' : '0px',
                        overflow: isOpen ? 'visible' : 'hidden',
                        boxShadow: isOpen ? '0 -4px 24px rgba(0,0,0,0.12)' : 'none',
                        borderTop: isOpen ? '1px solid #e2e8f0' : 'none',
                    }}
                    onClick={() => reactionPickerFor && setReactionPickerFor(null)}
                >
                    {/* 핵심 수정: 항상 렌더 (CSS overflow 제어) → mobileScrollRef null 없앰 */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                        <div className="w-8 h-1 bg-slate-200 rounded-full" />
                        <span className="text-[11px] font-bold text-slate-500 tracking-widest uppercase">Team Chat</span>
                        <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-800">
                            <X size={15} />
                        </button>
                    </div>
                    <div
                        ref={mobileScrollRef}
                        className="flex-1 overflow-y-auto px-2 py-2 space-y-2 bg-slate-50 min-h-0"
                        style={{ maxHeight: 'calc(65vh - 100px)' }}
                    >
                        {renderMessages(true)}
                    </div>
                    {renderInput(true)}
                </div>

                {/* 하단 Pill 버튼 */}
                <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-[9989] transition-all duration-300 ${isOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}>
                    <div
                        className="bg-black text-white flex items-center justify-center gap-2 px-8 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer active:scale-95 transition-all"
                        onClick={() => { setHasUnread(false); setIsOpen(true); }}
                    >
                        <MessageSquare size={16} />
                        <span className="text-[13px] font-bold tracking-tight">Team Chat</span>
                        {hasUnread && (
                            <span className="w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center ml-1 shadow-[0_0_10px_rgba(244,63,94,0.6)]">N</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Zoom Modal */}
            {zoomImage && createPortal(
                <div
                    className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setZoomImage(null)}
                >
                    <button
                        onClick={() => setZoomImage(null)}
                        className="absolute top-6 right-6 text-white bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={zoomImage}
                        alt="Zoomed"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </>
    );
}
