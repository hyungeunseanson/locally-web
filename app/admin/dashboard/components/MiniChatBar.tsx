import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Send, UserCircle, MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ChatMessage {
    id: string;
    task_id: string;
    content: string;
    author_id: string;
    author_name: string;
    created_at: string;
}

interface MiniChatBarProps {
    currentUser: { id: string; name: string } | null;
}

export default function MiniChatBar({ currentUser }: MiniChatBarProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();
    const CHAT_ROOM_ID = 'MINI_CHAT_ROOM_A1'; // Using a fixed task_id for general chat

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('admin_task_comments')
            .select('*')
            .eq('task_id', CHAT_ROOM_ID)
            .order('created_at', { ascending: true })
            .limit(50);

        if (data) {
            setMessages(data);
            if (!isOpen && data.length > 0) {
                // Quick visual check if last message is not from me
                const lastMsg = data[data.length - 1];
                if (lastMsg.author_id !== currentUser?.id) {
                    setHasUnread(true);
                }
            }
        }
    };

    useEffect(() => {
        fetchMessages();

        // Make sure we subscribe precisely to the mini chat messages
        const channel = supabase.channel('admin_mini_chat')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'admin_task_comments',
                filter: `task_id=eq.${CHAT_ROOM_ID}`
            }, (payload) => {
                const newMsg = payload.new as ChatMessage;
                setMessages(prev => {
                    // Prevent duplicates effectively
                    if (prev.some(m => m.id === newMsg.id)) return prev;

                    // Filter out optimistic local messages that match the content roughly if id is temp
                    return [...prev.filter(m => !m.id.startsWith('temp_') || m.content !== newMsg.content), newMsg];
                });

                if (!isOpen && newMsg.author_id !== currentUser?.id) {
                    setHasUnread(true);
                } else if (isOpen) {
                    setTimeout(() => {
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }
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
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [isOpen, messages.length]);

    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        const messageText = newMessage;
        const tempId = `temp_${Date.now()}`;
        const opMessage = {
            id: tempId,
            task_id: CHAT_ROOM_ID,
            content: messageText,
            author_id: currentUser.id,
            author_name: currentUser.name,
            created_at: new Date().toISOString()
        };

        // Optimistic update
        setMessages(prev => [...prev, opMessage]);
        setNewMessage('');

        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 50);

        const { error } = await supabase.from('admin_task_comments').insert({
            task_id: CHAT_ROOM_ID,
            content: messageText,
            author_id: currentUser.id,
            author_name: currentUser.name
        });

        if (error) {
            console.error('Failed to send message:', error);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    return (
        <div className={`fixed bottom-0 right-10 w-80 bg-white border border-slate-200 rounded-t-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 z-50 flex flex-col ${isOpen ? 'h-[450px] translate-y-0' : 'h-12 translate-y-0 hover:-translate-y-1'}`}>
            {/* Header (Toggle) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-12 px-4 flex items-center justify-between border-b border-slate-700 bg-slate-900 text-white rounded-t-2xl hover:bg-slate-800 transition-colors shrink-0"
            >
                <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-400" />
                    <span className="font-bold text-sm tracking-tight">팀 미니 채팅</span>
                    {hasUnread && !isOpen && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-1 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                    )}
                </div>
                {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
            </button>

            {/* Chat Area */}
            {isOpen && (
                <>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/80 scrollbar-thin">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                                    <MessageSquare size={20} className="text-slate-300" />
                                </div>
                                <p className="text-xs font-medium text-slate-500">첫 메시지를 남겨보세요.</p>
                                <p className="text-[10px] text-slate-400 mt-1 text-center">여기에 작성한 메시지는<br />팀원 모두에게 실시간으로 공유됩니다.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.author_id === currentUser?.id;
                                const showAuthorInfo = idx === 0 || messages[idx - 1].author_id !== msg.author_id;

                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        {!isMe && showAuthorInfo && (
                                            <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                    {msg.author_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-700">{msg.author_name}</span>
                                            </div>
                                        )}
                                        <div className="flex items-end gap-1.5 max-w-[85%] group">
                                            {isMe && (
                                                <span className="text-[9px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {format(new Date(msg.created_at), 'aa h:mm', { locale: ko })}
                                                </span>
                                            )}
                                            <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${isMe
                                                    ? 'bg-slate-900 border border-slate-800 text-white rounded-br-sm'
                                                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                                                }`}>
                                                {msg.content}
                                            </div>
                                            {!isMe && (
                                                <span className="text-[9px] text-slate-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
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
                    <form onSubmit={sendMessage} className="p-3 border-t border-slate-200 bg-white">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 pr-1.5 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-400 transition-all shadow-inner">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="팀원에게 메시지 보내기..."
                                className="flex-1 bg-transparent text-[13px] px-3 py-2 outline-none text-slate-800 placeholder:text-slate-400"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className={`p-2 rounded-lg transition-all ${newMessage.trim()
                                        ? 'bg-slate-900 text-white shadow-md hover:bg-slate-800 scale-100'
                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed scale-95'
                                    }`}
                            >
                                <Send size={14} className={newMessage.trim() ? "ml-0.5" : ""} />
                            </button>
                        </div>
                        <div className="mt-2 text-center">
                            <span className="text-[9px] text-slate-400 font-medium">✨ Real-time synced across admin workspace</span>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}
