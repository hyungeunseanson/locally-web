'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { ArrowLeft, Send, CheckCircle, Clock, XCircle, AlertCircle, Phone } from 'lucide-react';
import type { ProxyComment, ProxyRequest, ProxyStatus } from '@/app/types/proxy';
import {
    getProxyCategoryLabel,
    getProxyFormDisplayEntries,
    getProxyPaymentMethod,
    getProxyRequestFeeKrw,
    getProxyRequestTitle,
    getProxyRequesterDisplayName,
} from '@/app/utils/proxyBooking';

type ProxyRequestDetail = ProxyRequest & {
    comments?: ProxyComment[];
    linked_inquiry_id?: string | null;
};

export default function ProxyBookingDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { id } = use(params);
    const supabase = useMemo(() => createClient(), []);

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

                const res = await fetch(`/api/proxy-bookings/${id}`);
                const data = await res.json() as { success?: boolean; data?: ProxyRequestDetail; viewerIsAdmin?: boolean };

                if (data.success && data.data) {
                    setRequest(data.data);
                    setComments(data.data.comments ?? []);
                    setIsAdmin(Boolean(data.viewerIsAdmin));
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
    }, [id, router, supabase]);

    const handleUpdateStatus = async (newStatus: ProxyStatus) => {
        if (!isAdmin) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/proxy-bookings/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setRequest(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const handlePaymentAction = async (
        endpoint: '/api/admin/proxy-bookings/confirm-payment' | '/api/admin/proxy-bookings/cancel-payment' | '/api/admin/proxy-bookings/refund-payment'
    ) => {
        if (!isAdmin) return;
        setUpdating(true);
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: id }),
            });
            if (res.ok) {
                const detailRes = await fetch(`/api/proxy-bookings/${id}`);
                const detailData = await detailRes.json() as { success?: boolean; data?: ProxyRequestDetail };
                if (detailData.success && detailData.data) {
                    setRequest(detailData.data);
                    setComments(detailData.data.comments ?? []);
                }
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

    const paymentState = searchParams.get('payment');
    const paymentMethod = getProxyPaymentMethod(request.form_data);
    const serviceFee = getProxyRequestFeeKrw(request.category, request.form_data);
    const formEntries = getProxyFormDisplayEntries(request.form_data);
    const linkedInquiryId = typeof request.linked_inquiry_id === 'string' ? request.linked_inquiry_id : null;
    const canStartProcessing = request.payment_status === 'COMPLETED';
    const paymentStatusLabel = request.payment_status === 'COMPLETED'
        ? '결제 완료'
        : request.payment_status === 'FAILED'
            ? '결제 실패'
            : request.payment_status === 'REFUNDED'
                ? '환불 완료'
                : '결제 대기';

    const nextActionMessage = (() => {
        if (request.payment_status === 'WAITING' && paymentMethod === 'bank') {
            return '아직 입금 대기 상태입니다. 아래 계좌 안내를 확인하고 입금이 완료되면 운영팀이 메시지함 스레드에서 다음 답변을 남깁니다.';
        }

        if (request.payment_status === 'WAITING') {
            return '결제 확인이 완료되면 운영팀이 메시지함 스레드에서 진행 여부와 통화 결과를 안내합니다.';
        }

        if (request.status === 'IN_PROGRESS') {
            return '현재 운영팀이 실제 전화를 진행 중입니다. 추가 확인이 필요하면 이 스레드나 메시지함에 이어서 답변이 남습니다.';
        }

        if (request.status === 'COMPLETED') {
            return '전화 진행이 완료된 요청입니다. 마지막 답변과 후속 안내를 메시지함 또는 아래 스레드에서 다시 확인해주세요.';
        }

        if (request.status === 'CANCELLED') {
            return '취소 또는 반려된 요청입니다. 필요하면 내용을 수정해 새 요청으로 다시 접수할 수 있습니다.';
        }

        return '운영팀이 요청을 확인 중입니다. 진행 결과와 추가 질문 답변은 메시지함과 아래 스레드로 이어집니다.';
    })();

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
                            <span className="text-xs font-bold text-slate-400 tracking-wider mb-2 block">{getProxyCategoryLabel(request.category)}</span>
                            <h1 className="text-2xl font-bold text-slate-900 break-words">
                                {getProxyRequestTitle(request)}
                            </h1>
                        </div>
                        <div className="shrink-0 ml-4">{getStatusBadge(request.status)}</div>
                    </div>
                </div>

                {paymentState === 'completed' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                        카드 결제가 확인되었습니다. 운영팀이 요청 내용을 확인한 뒤 답변을 남겨드립니다.
                    </div>
                )}

                {paymentState === 'failed' && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                        카드 결제가 완료되지 않았습니다. 요청은 접수되어 있으며, 필요하면 운영팀 답변을 기다리거나 새로 다시 접수해 주세요.
                    </div>
                )}

                {!isAdmin && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-blue-900">다음 안내는 메시지함과 이 화면에서 함께 확인할 수 있어요.</p>
                                <p className="mt-1 text-sm leading-6 text-blue-800">
                                    {nextActionMessage}
                                </p>
                            </div>
                            {linkedInquiryId ? (
                                <Link
                                    href={`/guest/inbox?inquiryId=${encodeURIComponent(linkedInquiryId)}`}
                                    className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-blue-700 ring-1 ring-blue-100 transition-colors hover:bg-blue-100/40"
                                >
                                    메시지함 열기
                                </Link>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* 1:1 Message Thread (Scrollable) */}
                <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <h2 className="font-bold flex items-center gap-2">
                            <Phone size={18} className="text-slate-500" />
                            담당자 소통 스레드
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">문의 사항이나 예약 진행 상황에 대해 소통하세요. 메시지함에서도 같은 답변을 확인할 수 있습니다.</p>
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
                                        {!comment.is_admin && !fromMe && <div className="text-[10px] font-bold text-slate-400 mb-1">{getProxyRequesterDisplayName(comment.profiles)}</div>}
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
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">주문번호</span>
                                    <span className="font-mono text-xs">{request.locally_order_id}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">결제 수단</span>
                                    <span className="font-semibold">{paymentMethod === 'card' ? '카드' : paymentMethod === 'bank' ? '무통장 입금' : '미지정'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">서비스 수수료</span>
                                    <span className="font-semibold">₩{serviceFee.toLocaleString()}</span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">결제 상태</span>
                            <span className={`font-bold ${request.payment_status === 'COMPLETED' ? 'text-emerald-600' : request.payment_status === 'WAITING' ? 'text-yellow-600' : 'text-red-500'}`}>
                                {paymentStatusLabel}
                            </span>
                        </div>
                    </div>

                    {request.payment_channel === 'LOCALLY' && request.payment_status === 'WAITING' && paymentMethod === 'bank' && !isAdmin && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="text-sm font-bold text-slate-800 mb-2">무통장 입금 안내</div>
                                <div className="text-xs text-slate-600 mb-3 leading-relaxed">
                                    서비스 수수료 <span className="font-bold text-blue-600">₩{serviceFee.toLocaleString()}</span>을 아래 계좌로 입금해 주시면, 확인 후 담당자가 전화를 진행합니다.
                                </div>
                                <div className="bg-white p-3 rounded text-sm font-mono text-center font-bold border border-slate-200 cursor-text select-all">
                                    {process.env.NEXT_PUBLIC_BANK_NAME || '카카오뱅크'} {process.env.NEXT_PUBLIC_BANK_ACCOUNT || '3333-01-1234567'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Meta Info */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold border-b border-slate-100 pb-3 text-sm">상세 입력 정보</h3>
                    <div className="space-y-4 text-sm">
                        {formEntries.map((entry) => (
                            <div key={entry.key}>
                                <div className="text-xs text-slate-400 font-semibold uppercase mb-1">{entry.label}</div>
                                <div className="font-medium text-slate-800 break-words whitespace-pre-wrap">{entry.value}</div>
                            </div>
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
                                <button disabled={updating || !canStartProcessing} onClick={() => handleUpdateStatus('IN_PROGRESS')} className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50">진행 중</button>
                                <button disabled={updating || !canStartProcessing} onClick={() => handleUpdateStatus('COMPLETED')} className="px-3 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50">완료 처리</button>
                                <button disabled={updating} onClick={() => handleUpdateStatus('CANCELLED')} className="px-3 py-2 text-xs font-semibold rounded bg-red-600 hover:bg-red-500 transition-colors">취소/반려</button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-slate-700">
                            <div className="text-xs text-slate-400 font-bold mb-1">결제 액션</div>
                            {request.payment_status === 'WAITING' && (request.payment_channel === 'NAVER' || paymentMethod === 'bank') ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <button disabled={updating} onClick={() => handlePaymentAction('/api/admin/proxy-bookings/confirm-payment')} className="px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 text-emerald-400">입금 확인</button>
                                    <button disabled={updating} onClick={() => handlePaymentAction('/api/admin/proxy-bookings/cancel-payment')} className="px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 text-rose-400">결제 취소</button>
                                </div>
                            ) : request.payment_status === 'WAITING' && paymentMethod === 'card' ? (
                                <p className="text-xs text-slate-400">고객 카드 결제 대기 중입니다.</p>
                            ) : request.payment_status === 'COMPLETED' ? (
                                <button disabled={updating} onClick={() => handlePaymentAction('/api/admin/proxy-bookings/refund-payment')} className="px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 text-amber-300">환불 처리</button>
                            ) : (
                                <p className="text-xs text-slate-400">추가 결제 액션이 없습니다.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
