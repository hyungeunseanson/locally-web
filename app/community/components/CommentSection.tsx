'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CommunityComment } from '@/app/types/community';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

interface CommentSectionProps {
    postId: string;
    initialCount: number;
    onOpenLogin?: () => void;
}

const getTimeAgo = (dateStr: string) => {
    try {
        const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
        const diff = (new Date(dateStr).getTime() - Date.now()) / 1000;
        if (Math.abs(diff) < 60) return '방금';
        if (Math.abs(diff) < 3600) return rtf.format(Math.floor(diff / 60), 'minute');
        if (Math.abs(diff) < 86400) return rtf.format(Math.floor(diff / 3600), 'hour');
        return rtf.format(Math.floor(diff / 86400), 'day');
    } catch { return ''; }
};

export default function CommentSection({ postId, initialCount, onOpenLogin }: CommentSectionProps) {
    const { user } = useAuth();
    const [comments, setComments] = useState<CommunityComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [inputText, setInputText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch comments on mount
    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await fetch(`/api/community/comments?post_id=${postId}`);
                const { data } = await res.json();
                if (data) setComments(data);
            } catch (e) {
                console.error('Failed to load comments', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchComments();
    }, [postId]);

    const handleSubmit = async () => {
        if (!user) {
            onOpenLogin?.();
            return;
        }
        if (!inputText.trim() || isSending) return;

        setIsSending(true);
        try {
            const res = await fetch('/api/community/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: postId, content: inputText.trim() })
            });
            const { data } = await res.json();
            if (data) {
                setComments(prev => [...prev, data]);
                setInputText('');
            }
        } catch (e) {
            console.error('Failed to post comment', e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div>
            {/* Comment List */}
            {isLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
            ) : comments.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-slate-100">
                    첫 번째 댓글을 남겨보세요! 💬
                </div>
            ) : (
                <div className="space-y-6">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden border border-slate-100 flex-shrink-0">
                                {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-sm">?</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[14px] font-bold text-slate-900">{comment.profiles?.name || '유저'}</span>
                                    <span className="text-[12px] text-slate-400 ml-auto">{getTimeAgo(comment.created_at)}</span>
                                </div>
                                <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Box */}
            <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-4 py-3 flex items-end gap-3 z-[90] md:max-w-[768px] md:mx-auto">
                <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden border border-slate-100 flex-shrink-0">
                    {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-sm">?</div>
                    )}
                </div>
                <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={user ? "댓글을 남겨보세요..." : "로그인 후 댓글을 작성할 수 있어요."}
                    onFocus={() => !user && onOpenLogin?.()}
                    readOnly={!user}
                    rows={1}
                    className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-slate-400 transition-colors max-h-[120px] overflow-y-auto leading-relaxed placeholder:text-slate-400"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                />
                <button
                    onClick={handleSubmit}
                    disabled={isSending || !inputText.trim()}
                    className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex-shrink-0"
                >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
}
