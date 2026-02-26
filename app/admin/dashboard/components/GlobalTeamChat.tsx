'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/app/utils/supabase/client';
import { Send, MessageSquare, ChevronUp, ChevronDown, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ChatMessage {
    id: string;
    task_id: string;
    content: string;
    author_id: string;
    author_name: string;
    created_at: string;
    metadata?: {
        image_url?: string;
    };
}

export default function GlobalTeamChat() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ file: File, url: string } | null>(null);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const CHAT_ROOM_ID = '00000000-0000-0000-0000-000000000000'; // Global Room ID

    useEffect(() => {
        setIsClient(true);

        // Auth & Check Admin Role
        const initChat = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [userData, whitelistData] = await Promise.all([
                supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
                supabase.from('admin_whitelist').select('*').eq('email', user.email!).maybeSingle()
            ]);

            if (userData.data?.role === 'admin' || whitelistData.data) {
                setCurrentUser({
                    id: user.id,
                    name: user.email?.split('@')[0] || 'Admin'
                });
            }
        };

        initChat();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('admin_task_comments')
                .select('*')
                .eq('task_id', CHAT_ROOM_ID)
                .order('created_at', { ascending: false })
                .limit(100);

            if (data) {
                setMessages(data.reverse()); // Reverse to show oldest first at top, newest at bottom
                // 🟢 이슈4-A: 메시지 로드 완료 후 isOpen 상태이면 최하단으로 스크롤
                if (isOpen) {
                    setTimeout(() => {
                        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }, 200);
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

        const channel = supabase.channel('global_admin_chat')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'admin_task_comments',
                filter: `task_id=eq.${CHAT_ROOM_ID}`
            }, (payload) => {
                const newMsg = payload.new as ChatMessage;
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev.filter(m => !m.id.startsWith('temp_') || m.content !== newMsg.content), newMsg];
                });

                if (!isOpen && newMsg.author_id !== currentUser.id) {
                    setHasUnread(true);
                } else if (isOpen) {
                    // 🟢 이슈4-A: 실시간 수신 시 150ms 후 스크롤 (DOM 반영 보장)
                    setTimeout(() => {
                        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }, 150);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setHasUnread(false);
            localStorage.setItem('global_chat_last_viewed', new Date().toISOString());
            // 🟢 이슈4-A: 오픈 시 200ms로 증가 (메시지 DOM 렌더링 완료 후 스크롤)
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }, 200);
            // 추가: 500ms 후 한 번 더 보장 (이미지/컨텐츠 늦게 렌더링되는 경우)
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }, 500);

            // 🟢 모바일 버블 오픈 시 Body Scroll Lock (배경화면 오버스크롤 방지)
            if (window.innerWidth < 768) {
                document.body.style.overflow = 'hidden';
            }
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, messages.length]);
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            localStorage.setItem('global_chat_last_viewed', new Date().toISOString());
        }
    }, [messages.length]);
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setSelectedImage({ file, url });
        }
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

    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!newMessage.trim() && !selectedImage) || !currentUser || isUploading) return;

        let imageUrl = undefined;
        const messageText = newMessage;
        const tempId = `temp_${Date.now()}`;

        // Optimistic UI for text
        const opMessage: ChatMessage = {
            id: tempId,
            task_id: CHAT_ROOM_ID,
            content: messageText || '사진 전송 중...',
            author_id: currentUser.id,
            author_name: currentUser.name,
            created_at: new Date().toISOString(),
            metadata: selectedImage ? { image_url: selectedImage.url } : undefined
        };

        setMessages(prev => [...prev, opMessage]);
        setNewMessage('');
        const imageToUpload = selectedImage;
        clearSelectedImage();

        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);

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
                metadata: imageUrl ? { image_url: imageUrl } : null
            });

            // 알림 발송 (비동기 처리)
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

    // ── 메시지 목록 렌더러 ──
    const renderMessages = (isMobile = false) => {
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
        return messages.map((msg, idx) => {
            const isMe = msg.author_id === currentUser.id;
            const showAuthorInfo = idx === 0 || messages[idx - 1].author_id !== msg.author_id;
            const maxW = isMobile ? 'max-w-[75vw]' : 'max-w-[240px]';
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
                    <div className="flex items-end gap-1.5 group">
                        {isMe && (
                            <span className="text-[10px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {format(new Date(msg.created_at), 'aa h:mm', { locale: ko })}
                            </span>
                        )}
                        <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            {msg.metadata?.image_url && (
                                <div onClick={() => setZoomImage(msg.metadata!.image_url!)} className={`p-1 bg-white border border-slate-200 ${maxW} cursor-pointer hover:opacity-90 transition-opacity rounded-2xl ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
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
                        </div>
                        {!isMe && (
                            <span className="text-[10px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {format(new Date(msg.created_at), 'aa h:mm', { locale: ko })}
                            </span>
                        )}
                    </div>
                </div>
            );
        });
    };

    // ── 입력 영역 렌더러 ──
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
            <form onSubmit={sendMessage} className="flex gap-2 items-center">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors shrink-0 ${isMobile ? 'p-2' : 'p-2.5'}`}>
                    <Paperclip size={isMobile ? 17 : 19} />
                </button>
                <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    className={`flex-1 text-[11px] md:text-[13px] bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-full outline-none transition-all placeholder:text-slate-400 ${isMobile ? 'px-3 py-2' : 'px-4 py-3'}`}
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

    if (!isClient || !currentUser) return null;

    return (
        <>
            {/* ── 데스크탑: 우하단 플로팅 패널 ── */}
            <div className={`hidden md:flex fixed bottom-0 right-10 w-96 bg-white border border-slate-200 rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] transition-all duration-300 z-50 flex-col ${isOpen ? 'h-[650px]' : 'h-12 hover:-translate-y-1'}`}>
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

                {isOpen && (
                    <>
                        {/* 메시지 목록 */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/80 scrollbar-thin">
                            {renderMessages()}
                        </div>
                        {/* 입력 영역 */}
                        {renderInput()}
                    </>
                )}
            </div>

            {/* ── 모바일: 하단 고정 바 + 슬라이드업 드로어 ── */}
            <div className="md:hidden">
                {/* 슬라이드업 메시지 패널 */}
                <div
                    className="fixed left-0 right-0 z-[9990] bg-white flex flex-col transition-all duration-300 ease-in-out"
                    style={{
                        bottom: 48,
                        maxHeight: isOpen ? '65vh' : '0px',
                        overflow: isOpen ? 'visible' : 'hidden',
                        boxShadow: isOpen ? '0 -4px 24px rgba(0,0,0,0.12)' : 'none',
                        borderTop: isOpen ? '1px solid #e2e8f0' : 'none',
                    }}
                >
                    {isOpen && (
                        <>
                            {/* 핸들 + 타이틀 */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto" />
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 tracking-widest uppercase">Team Chat</span>
                                <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-800">
                                    <X size={15} />
                                </button>
                            </div>
                            {/* 메시지 목록 */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 md:px-3 md:py-2 space-y-2 md:space-y-3 bg-slate-50 min-h-0" style={{ maxHeight: 'calc(65vh - 100px)' }}>
                                {renderMessages(true)}
                            </div>
                            {/* 입력 */}
                            {renderInput(true)}
                        </>
                    )}
                </div>

                {/* 하단 플로팅 Pill 버튼 — Drawer가 열려있지 않을 때만 표시 */}
                <div
                    className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-[9989] transition-all duration-300 ${isOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}
                >
                    <div
                        className="bg-black text-white flex items-center justify-center gap-2 px-8 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer active:scale-95 transition-all"
                        onClick={() => {
                            setHasUnread(false);
                            setIsOpen(true);
                        }}
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

