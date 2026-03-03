'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { ArrowLeft, Send, CheckCircle, Clock, XCircle, AlertCircle, Phone } from 'lucide-react';
import type { ProxyRequest, ProxyComment } from '@/app/types/proxy';

export default function ProxyBookingDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const supabase = createClient();

    const [request, setRequest] = useState<ProxyRequest | null>(null);
    const [comments, setComments] = useState<ProxyComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Comment input state
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Status update state
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }
                setUserId(user.id);

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                setIsAdmin(profile?.role === 'admin');

                const res = await fetch(`/api/proxy-bookings/${id}`);
                const data = await res.json();

                if (data.success) {
                    setRequest(data.data as ProxyRequest);
                    setComments((data.data as any).comments as ProxyComment[]);
                } else {
                    router.push('/proxy-bookings');
                }
            } catch (error) {
                console.error('Failed to fetch proxy request detail', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [id, supabase, router]);

    const handleUpdateStatus = async (newStatus: string) => {
        if (!isAdmin) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/proxy-bookings/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setRequest(prev => prev ? { ...prev, status: newStatus as any } : null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdatePayment = async (newStatus: string) => {
        if (!isAdmin) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/proxy-bookings/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_status: newStatus }),
            });
            if (res.ok) {
                setRequest(prev => prev ? { ...prev, payment_status: newStatus as any } : null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const submitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || submitting) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/proxy-bookings/${id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment }),
            });
            const data = await res.json();

            if (data.success) {
                setComments(prev => [...prev, data.data]);
                setNewComment('');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold flex items-center gap-1.5"><Clock size={14} /> 대기 중</span>;
            case 'IN_PROGRESS': return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold flex items-center gap-1.5"><Phone size={14} /> 진행 중</span>;
            case 'COMPLETED': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold flex items-center gap-1.5"><CheckCircle size={14} /> 완료</span>;
            case 'CANCELLED': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold flex items-center gap-1.5"><XCircle size={14} /> 취소됨</span>;
            default: return null;
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">로딩 중...</div>;
    if (!request) return <div className="p-8 text-center text-slate-500">요청을 찾을 수 없습니다.</div>;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Detail Info */}
            <div className="lg:col-span-2 space-y-6 flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)]">

                {/* Header */}
                <div className="flex flex-col gap-4">
                    <Link href="/proxy-bookings" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors w-fit">
                        <ArrowLeft size={16} /> 게시판으로
                    </Link>

                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-xs font-bold text-slate-400 tracking-wider mb-2 block">{request.category}</span>
                            <h1 className="text-2xl font-bold text-slate-900 break-words">
                                {request.category === 'RESTAURANT' ? request.form_data?.restaurant_name :
                                    request.category === 'TRANSPORT' ? `${request.form_data?.departure_location} → ${request.form_data?.arrival_location}` :
                                        '전화 대행 요청 상세보기'}
                            </h1>
                        </div>
                        <div className="shrink-0 ml-4">{getStatusBadge(request.status)}</div>
                    </div>
                </div>

                {/* 1:1 Message Thread (Scrollable) */}
                <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <h2 className="font-bold flex items-center gap-2">
                            <Phone size={18} className="text-slate-500" />
                            담당자 소통 스레드
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">문의 사항이나 예약 진행 상황에 대해 소통하세요.</p>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto space-y-6">
                        <div className="text-center text-xs text-slate-400 my-4">요청이 접수되었습니다. 담당자가 확인 후 답변드립니다.</div>

                        {comments.map(comment => {
                            const fromMe = comment.author_id === userId;

                            return (
                                <div key={comment.id} className={`flex max-w-[80%] ${fromMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                                    {!fromMe && (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 mr-3 flex items-center justify-center font-bold text-xs">
                                            {comment.is_admin ? 'A' : 'C'}
                                        </div>
                                    )}
                                    <div className={`p-4 rounded-2xl ${fromMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                        {comment.is_admin && !fromMe && <div className="text-[10px] font-bold text-slate-400 mb-1">Locally 운영팀</div>}
                                        {!comment.is_admin && !fromMe && <div className="text-[10px] font-bold text-slate-400 mb-1">{comment.profiles?.name || '고객'}</div>}
                                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{comment.content}</div>
                                        <div className={`text-[10px] mt-2 ${fromMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {new Date(comment.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Message Input Box */}
                    <div className="p-4 bg-white border-t border-slate-200">
                        <form onSubmit={submitComment} className="flex gap-2">
                            <input
                                type="text"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                disabled={submitting || request.status === 'CANCELLED'}
                                placeholder="답변을 입력하세요..."
                                className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim() || submitting || request.status === 'CANCELLED'}
                                className="bg-black text-white px-5 rounded-xl hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Right Column: Meta Info & Admin Tools */}
            <div className="space-y-6">

                {/* Payment Meta Info */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold border-b border-slate-100 pb-3 text-sm">결제 정보</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">결제 채널</span>
                            <span className={`font-semibold px-2 py-0.5 rounded text-xs ${request.payment_channel === 'NAVER' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {request.payment_channel}
                            </span>
                        </div>

                        {request.payment_channel === 'NAVER' && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">구매자명</span>
                                <span className="font-semibold">{request.naver_buyer_name}</span>
                            </div>
                        )}
                        {request.payment_channel === 'LOCALLY' && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">주문번호</span>
                                <span className="font-mono text-xs">{request.locally_order_id}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">결제 상태</span>
                            <span className={`font-bold ${request.payment_status === 'COMPLETED' ? 'text-emerald-600' : request.payment_status === 'WAITING' ? 'text-yellow-600' : 'text-red-500'}`}>
                                {request.payment_status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form Meta Info */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold border-b border-slate-100 pb-3 text-sm">상세 입력 정보</h3>
                    <div className="space-y-4 text-sm">
                        {Object.entries(request.form_data).map(([key, val]) => (
                            val && (
                                <div key={key}>
                                    <div className="text-xs text-slate-400 font-semibold uppercase mb-1">{key.replace(/_/g, ' ')}</div>
                                    <div className="font-medium text-slate-800 break-words">{String(val)}</div>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* Admin Tools */}
                {isAdmin && (
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-4">
                        <h3 className="font-bold border-b border-slate-700 pb-3 text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> 어드민 도구
                        </h3>

                        <div className="space-y-3">
                            <div className="text-xs text-slate-400 font-bold mb-1">상태 변경</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button disabled={updating} onClick={() => handleUpdateStatus('PENDING')} className="px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 transition-colors">대기 중</button>
                                <button disabled={updating} onClick={() => handleUpdateStatus('IN_PROGRESS')} className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 transition-colors">진행 중</button>
                                <button disabled={updating} onClick={() => handleUpdateStatus('COMPLETED')} className="px-3 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 transition-colors">완료 처리</button>
                                <button disabled={updating} onClick={() => handleUpdateStatus('CANCELLED')} className="px-3 py-2 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 transition-colors">취소/반려</button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-slate-700">
                            <div className="text-xs text-slate-400 font-bold mb-1">결제 상태 업데이트</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button disabled={updating} onClick={() => handleUpdatePayment('COMPLETED')} className="px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 text-emerald-400">결제 완료 승인</button>
                                <button disabled={updating} onClick={() => handleUpdatePayment('WAITING')} className="px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 text-yellow-400">대기 중 롤백</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
