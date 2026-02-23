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
                if (!isOpen && data.length > 0) {
                    const lastMsg = data[data.length - 1];
                    if (lastMsg.author_id !== currentUser.id) setHasUnread(true);
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
                    setTimeout(() => {
                        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }, 100);
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
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }, 100);
        }
    }, [isOpen, messages.length]);

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

        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            alert('메시지 전송에 실패했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isClient || !currentUser) return null;

    return (
        <div className={`fixed bottom-0 right-10 w-96 bg-white border border-slate-200 rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] transition-all duration-300 z-50 flex flex-col ${isOpen ? 'h-[650px] translate-y-0' : 'h-12 translate-y-0 hover:-translate-y-1'}`}>

            {/* Header (Toggle) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-12 px-5 flex items-center justify-between border-b border-slate-800 bg-black text-white rounded-t-2xl hover:bg-slate-900 transition-colors shrink-0"
            >
                <div className="flex items-center gap-2">
                    <MessageSquare size={18} />
                    <span className="font-bold tracking-tight">Team Chat</span>
                    {hasUnread && !isOpen && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ml-2 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                    )}
                </div>
                {isOpen ? <ChevronDown size={20} className="text-slate-300" /> : <ChevronUp size={20} className="text-slate-300" />}
            </button>

            {/* Chat Area */}
            {isOpen && (
                <>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/80 scrollbar-thin">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                    <MessageSquare size={24} className="text-slate-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-700">첫 메시지를 남겨보세요.</p>
                                <p className="text-xs text-slate-500 mt-2 text-center leading-relaxed">여기에 작성한 메시지와 사진은<br />페이지 이동 후에도 실시간 유지됩니다.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.author_id === currentUser.id;
                                const showAuthorInfo = idx === 0 || messages[idx - 1].author_id !== msg.author_id;

                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        {!isMe && showAuthorInfo && (
                                            <div className="flex items-center gap-2 mb-2 ml-1">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {msg.author_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{msg.author_name}</span>
                                            </div>
                                        )}
                                        <div className="flex items-end gap-2 max-w-[85%] group">
                                            {isMe && (
                                                <span className="text-[10px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {format(new Date(msg.created_at), 'aa h:mm', { locale: ko })}
                                                </span>
                                            )}

                                            <div className={`flex flex-col gap-1 rounded-2xl shadow-sm overflow-hidden ${isMe ? 'items-end' : 'items-start'}`}>
                                                {/* Image Attachment */}
                                                {msg.metadata?.image_url && (
                                                    <div
                                                        onClick={() => setZoomImage(msg.metadata!.image_url!)}
                                                        className={`p-1 bg-white border border-slate-200 max-w-[240px] cursor-pointer hover:opacity-90 transition-opacity ${isMe ? 'rounded-2xl rounded-br-sm bg-slate-50 border-slate-100' : 'rounded-2xl rounded-bl-sm'}`}
                                                    >
                                                        <img src={msg.metadata.image_url} alt="attached" className="rounded-xl w-full object-cover max-h-48" loading="lazy" />
                                                    </div>
                                                )}

                                                {/* Text Content */}
                                                {msg.content && msg.content !== '사진 전송 중...' && msg.content !== '사진을 1장 보냈습니다.' && (
                                                    <div
                                                        className={`px-4 py-2.5 shadow-sm text-[13px] leading-relaxed break-words whitespace-pre-wrap max-w-[240px] ${isMe
                                                            ? 'bg-black border border-slate-800 text-white rounded-2xl rounded-tr-sm rounded-br-sm'
                                                            : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm rounded-bl-sm'
                                                            }`}
                                                    >
                                                        {msg.content}
                                                    </div>
                                                )}
                                                {/* Optimistic Uploading Text */}
                                                {(msg.content === '사진 전송 중...') && (
                                                    <div className="flex justify-end mt-1">
                                                        <div className="px-4 py-2 text-xs bg-slate-100 text-slate-500 rounded-2xl animate-pulse font-medium border border-slate-200">
                                                            사진 전송 중...
                                                        </div>
                                                    </div>
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
                            })
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-slate-200 bg-white shadow-2xl z-10">
                        {/* Image Preview Area */}
                        {selectedImage && (
                            <div className="mb-3 relative inline-block">
                                <div className="p-1 border border-slate-200 rounded-xl bg-slate-50 relative">
                                    <img src={selectedImage.url} alt="preview" className="h-20 w-auto rounded-lg object-cover" />
                                    <button onClick={clearSelectedImage} className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full shadow-md hover:bg-slate-900">
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={sendMessage} className="flex gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="메시지를 입력하세요..."
                                className="flex-1 text-sm bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-500"
                                disabled={isUploading}
                            />
                            <button
                                type="submit"
                                disabled={(!newMessage.trim() && !selectedImage) || isUploading}
                                className="bg-black text-white p-3 flex items-center justify-center rounded-xl shadow-md hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-all"
                            >
                                <Send size={18} className={isUploading ? 'animate-pulse' : ''} />
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* Image Zoom Modal using React Portal to escape fixed container */}
            {zoomImage && createPortal(
                <div
                    className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
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
                        onClick={e => e.stopPropagation()} // Prevent close when clicking the image itself
                    />
                </div>,
                document.body
            )}
        </div>
    );
}
