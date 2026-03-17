'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownRight, Heart, Loader2, Send } from 'lucide-react';

import type { CommunityComment } from '@/app/types/community';
import { useAuth } from '@/app/context/AuthContext';
import { getProfileDisplayName, getProfileInitial } from '@/app/utils/profile';
import CommunityAuthorTrigger from './CommunityAuthorTrigger';

interface CommentSectionProps {
    postId: string;
    onOpenLogin?: () => void;
    onCountChange?: (count: number) => void;
}

type CommentResponse = {
    data?: CommunityComment[];
    totalCount?: number;
};

const getTimeAgo = (dateStr: string) => {
    try {
        const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
        const diff = (new Date(dateStr).getTime() - Date.now()) / 1000;
        if (Math.abs(diff) < 60) return '방금';
        if (Math.abs(diff) < 3600) return rtf.format(Math.floor(diff / 60), 'minute');
        if (Math.abs(diff) < 86400) return rtf.format(Math.floor(diff / 3600), 'hour');
        return rtf.format(Math.floor(diff / 86400), 'day');
    } catch {
        return '';
    }
};

function countComments(items: CommunityComment[]) {
    return items.reduce((total, item) => total + 1 + (item.replies?.length || 0), 0);
}

function updateCommentTree(
    items: CommunityComment[],
    commentId: string,
    updater: (comment: CommunityComment) => CommunityComment
): CommunityComment[] {
    return items.map((item) => {
        if (item.id === commentId) {
            return updater(item);
        }

        if (item.replies?.some((reply) => reply.id === commentId)) {
            return {
                ...item,
                replies: item.replies.map((reply) => (reply.id === commentId ? updater(reply) : reply)),
            };
        }

        return item;
    });
}

function appendComment(items: CommunityComment[], nextComment: CommunityComment) {
    if (!nextComment.parent_id) {
        return [...items, { ...nextComment, replies: nextComment.replies || [] }];
    }

    return items.map((item) => {
        if (item.id !== nextComment.parent_id) {
            return item;
        }

        return {
            ...item,
            replies: [...(item.replies || []), { ...nextComment, replies: [] }],
        };
    });
}

function CommentAvatar({
    comment,
    postId,
}: {
    comment: CommunityComment;
    postId: string;
}) {
    return (
        <CommunityAuthorTrigger
            userId={comment.user_id}
            authorName={getProfileDisplayName(comment.profiles)}
            currentPostId={postId}
        >
            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-100 transition-all hover:ring-2 hover:ring-slate-300">
                {comment.profiles?.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
                        {getProfileInitial(comment.profiles)}
                    </div>
                )}
            </div>
        </CommunityAuthorTrigger>
    );
}

function CommentActions({
    comment,
    likePending,
    replyLabel,
    onLike,
    onReply,
}: {
    comment: CommunityComment;
    likePending: boolean;
    replyLabel: string;
    onLike: () => void;
    onReply: () => void;
}) {
    return (
        <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-slate-500">
            <button
                type="button"
                onClick={onLike}
                disabled={likePending}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all ${
                    comment.is_liked
                        ? 'bg-rose-50 text-[#FF385C]'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                } ${likePending ? 'cursor-progress opacity-80' : 'active:scale-[0.98]'} disabled:pointer-events-none`}
            >
                {likePending ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    <Heart size={12} fill={comment.is_liked ? '#FF385C' : 'none'} />
                )}
                좋아요 {comment.like_count || 0}
            </button>
            <button
                type="button"
                onClick={onReply}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all hover:bg-slate-100 active:scale-[0.98]"
            >
                <CornerDownRight size={12} />
                {replyLabel}
            </button>
        </div>
    );
}

export default function CommentSection({ postId, onOpenLogin, onCountChange }: CommentSectionProps) {
    const { user } = useAuth();
    const [comments, setComments] = useState<CommunityComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingRoot, setIsSendingRoot] = useState(false);
    const [sendingReplyTo, setSendingReplyTo] = useState<string | null>(null);
    const [likePendingIds, setLikePendingIds] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyTargetName, setReplyTargetName] = useState<string>('');
    const [replyText, setReplyText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const replyInputRef = useRef<HTMLTextAreaElement>(null);

    const totalCount = useMemo(() => countComments(comments), [comments]);

    useEffect(() => {
        onCountChange?.(totalCount);
    }, [onCountChange, totalCount]);

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await fetch(`/api/community/comments?post_id=${postId}`);
                const payload = (await res.json()) as CommentResponse;
                if (!res.ok) {
                    throw new Error('댓글을 불러오지 못했습니다.');
                }
                setComments(payload.data || []);
                onCountChange?.(payload.totalCount ?? countComments(payload.data || []));
            } catch (e) {
                console.error('Failed to load comments', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchComments();
    }, [postId, onCountChange]);

    useEffect(() => {
        if (replyingTo && replyInputRef.current) {
            replyInputRef.current.focus();
        }
    }, [replyingTo]);

    const ensureLogin = () => {
        if (!user) {
            onOpenLogin?.();
            return false;
        }

        return true;
    };

    const handleRootSubmit = async () => {
        if (!ensureLogin() || !inputText.trim() || isSendingRoot) return;

        setIsSendingRoot(true);
        try {
            const res = await fetch('/api/community/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: postId, content: inputText.trim() }),
            });
            const payload = await res.json().catch(() => ({ error: '댓글 등록에 실패했습니다.' }));
            if (!res.ok) {
                throw new Error(payload.error || '댓글 등록에 실패했습니다.');
            }

            if (payload.data) {
                setComments((prev) => appendComment(prev, payload.data as CommunityComment));
                setInputText('');
            }
        } catch (e) {
            console.error('Failed to post comment', e);
        } finally {
            setIsSendingRoot(false);
        }
    };

    const openReplyComposer = (comment: CommunityComment, parentId?: string | null) => {
        if (!ensureLogin()) return;
        setReplyingTo(parentId || comment.parent_id || comment.id);
        setReplyTargetName(getProfileDisplayName(comment.profiles));
        setReplyText('');
    };

    const handleReplySubmit = async () => {
        if (!ensureLogin() || !replyingTo || !replyText.trim() || sendingReplyTo) return;

        setSendingReplyTo(replyingTo);
        try {
            const res = await fetch('/api/community/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    parent_id: replyingTo,
                    content: replyText.trim(),
                }),
            });
            const payload = await res.json().catch(() => ({ error: '답글 등록에 실패했습니다.' }));
            if (!res.ok) {
                throw new Error(payload.error || '답글 등록에 실패했습니다.');
            }

            if (payload.data) {
                setComments((prev) => appendComment(prev, payload.data as CommunityComment));
                setReplyingTo(null);
                setReplyTargetName('');
                setReplyText('');
            }
        } catch (e) {
            console.error('Failed to post reply', e);
        } finally {
            setSendingReplyTo(null);
        }
    };

    const handleLike = async (comment: CommunityComment) => {
        if (!ensureLogin()) return;
        if (likePendingIds.includes(comment.id)) return;

        setLikePendingIds((prev) => [...prev, comment.id]);
        const previousLiked = Boolean(comment.is_liked);
        const previousCount = comment.like_count || 0;
        setComments((prev) => updateCommentTree(prev, comment.id, (current) => ({
            ...current,
            is_liked: !previousLiked,
            like_count: previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1,
        })));

        try {
            const res = await fetch('/api/community/comment-likes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment_id: comment.id }),
            });
            const payload = await res.json().catch(() => ({ error: '댓글 좋아요 처리에 실패했습니다.' }));
            if (!res.ok) {
                throw new Error(payload.error || '댓글 좋아요 처리에 실패했습니다.');
            }

            setComments((prev) => updateCommentTree(prev, comment.id, (current) => ({
                ...current,
                is_liked: Boolean(payload.liked),
                like_count: Number(payload.likeCount || 0),
            })));
        } catch (e) {
            console.error('Failed to toggle comment like', e);
            setComments((prev) => updateCommentTree(prev, comment.id, (current) => ({
                ...current,
                is_liked: previousLiked,
                like_count: previousCount,
            })));
        } finally {
            setLikePendingIds((prev) => prev.filter((id) => id !== comment.id));
        }
    };

    const renderReplyComposer = (parentId: string) => {
        if (replyingTo !== parentId) return null;

        return (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[12px] font-semibold text-slate-500">
                    {replyTargetName ? `${replyTargetName}님에게 답글 작성 중` : '답글 작성 중'}
                </p>
                <div className="flex items-end gap-2">
                    <textarea
                        ref={replyInputRef}
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="답글을 남겨보세요..."
                        rows={2}
                        className="max-h-[120px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-colors focus:border-slate-400"
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                handleReplySubmit();
                            }
                        }}
                    />
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={handleReplySubmit}
                            disabled={sendingReplyTo === parentId || !replyText.trim()}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition-all disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {sendingReplyTo === parentId ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setReplyingTo(null);
                                setReplyTargetName('');
                                setReplyText('');
                            }}
                            className="text-[11px] font-semibold text-slate-400"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderComment = (comment: CommunityComment, isReply = false) => {
        const authorName = getProfileDisplayName(comment.profiles);
        const isLikePending = likePendingIds.includes(comment.id);

        return (
            <div
                key={comment.id}
                className={`${isReply ? 'ml-11 border-l border-slate-100 pl-4 pt-4' : ''}`}
            >
                <div className="flex gap-3">
                    <CommentAvatar comment={comment} postId={postId} />
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                            <span className="truncate text-[14px] font-bold text-slate-900">{authorName}</span>
                            <span className="ml-auto text-[12px] text-slate-400">{getTimeAgo(comment.created_at)}</span>
                        </div>
                        <p className="break-words whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                            {comment.content}
                        </p>
                        <CommentActions
                            comment={comment}
                            likePending={isLikePending}
                            replyLabel={isReply ? '이 댓글에 답글' : '답글 달기'}
                            onLike={() => handleLike(comment)}
                            onReply={() => openReplyComposer(comment, isReply ? comment.parent_id : comment.id)}
                        />
                        {!isReply && renderReplyComposer(comment.id)}
                    </div>
                </div>
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-1">
                        {comment.replies.map((reply) => renderComment(reply, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            {isLoading ? (
                <div className="flex justify-center py-6">
                    <Loader2 size={22} className="animate-spin text-slate-300" />
                </div>
            ) : comments.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 py-10 text-center text-sm text-slate-400">
                    첫 번째 댓글을 남겨보세요! 💬
                </div>
            ) : (
                <div className="space-y-6">
                    {comments.map((comment) => renderComment(comment))}
                </div>
            )}

            <div className="mt-4 flex items-end gap-3 border-t border-slate-100 px-4 py-3">
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-100">
                    {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="me" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">?</div>
                    )}
                </div>
                <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder={user ? '댓글을 남겨보세요...' : '로그인 후 댓글을 작성할 수 있어요.'}
                    onFocus={() => !user && onOpenLogin?.()}
                    readOnly={!user}
                    rows={1}
                    className="max-h-[120px] flex-1 resize-none overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] leading-relaxed text-slate-900 outline-none transition-colors focus:border-slate-400 placeholder:text-slate-400"
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleRootSubmit();
                        }
                    }}
                />
                <button
                    type="button"
                    onClick={handleRootSubmit}
                    disabled={isSendingRoot || !inputText.trim()}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400"
                >
                    {isSendingRoot ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
}
