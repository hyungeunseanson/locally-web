'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { Plus, Phone, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { ProxyRequest } from '@/app/types/proxy';
import { getProxyPaymentMethod, getProxyPaymentStatusLabel, getProxyRequestTitle, getProxyRequesterDisplayName } from '@/app/utils/proxyBooking';

export default function ProxyBookingsBoard() {
    const supabase = useMemo(() => createClient(), []);
    const [requests, setRequests] = useState<ProxyRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const res = await fetch('/api/proxy-bookings');
                const data = await res.json() as { success?: boolean; data?: ProxyRequest[]; viewerIsAdmin?: boolean };

                if (data.success) {
                    setRequests(data.data as ProxyRequest[]);
                    setIsAdmin(Boolean(data.viewerIsAdmin));
                }
            } catch (error) {
                console.error('Failed to fetch proxy requests', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [supabase]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Clock size={12} /> 대기 중</span>;
            case 'IN_PROGRESS':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1"><Phone size={12} /> 진행 중</span>;
            case 'COMPLETED':
                return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle size={12} /> 완료</span>;
            case 'CANCELLED':
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle size={12} /> 취소됨</span>;
            default:
                return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
        }
    };

    const getRequestDateSummary = (request: ProxyRequest) => {
        if (request.category === 'RESTAURANT') {
            const slot = typeof request.form_data?.preferred_slot_primary === 'string'
                ? request.form_data.preferred_slot_primary
                : '';
            if (slot.includes('T')) {
                const [date, time] = slot.split('T');
                if (date && time) {
                    return `${date} ${time.slice(0, 5)}`;
                }
            }
        }

        return new Date(request.created_at).toLocaleDateString();
    };

    const getNextStepCopy = (request: ProxyRequest) => {
        const paymentMethod = getProxyPaymentMethod(request.form_data);

        if (request.payment_status === 'WAITING' && paymentMethod === 'bank') {
            return '입금 전에는 1:1 문의함에서 계좌 안내를 확인해 주세요. 입금이 확인되면 운영팀이 다음 안내를 드립니다.';
        }

        if (request.payment_status === 'WAITING') {
            return '카드 결제가 완료되지 않아 아직 운영을 시작하지 않습니다.';
        }

        if (request.status === 'IN_PROGRESS') {
            return '현재 전화 진행 중입니다. 진행 상황은 1:1 문의함에서 확인할 수 있습니다.';
        }

        if (request.status === 'COMPLETED') {
            return '전화 결과와 후속 안내는 1:1 문의함에서 확인할 수 있습니다.';
        }

        if (request.status === 'CANCELLED') {
            return '취소 또는 반려된 요청입니다. 필요한 경우 새 요청을 다시 접수해주세요.';
        }

        return '운영팀이 요청을 확인하고 있습니다. 진행 상황과 추가 안내는 1:1 문의함에서 확인할 수 있습니다.';
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">전화 대행 요청</h1>
                    <p className="text-sm text-slate-500 mt-1">일본 현지 식당, 교통, 분실물 등을 대신 전화해 드립니다.</p>
                </div>
                {!isAdmin && (
                    <Link href="/proxy-bookings/new">
                        <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
                            <Plus size={16} />
                            새 요청하기
                        </button>
                    </Link>
                )}
            </div>

            {!isAdmin && (
                <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-blue-900">
                    전화 진행 상황과 결과는 1:1 문의함에서 확인할 수 있습니다. 무통장 입금 요청의 계좌 안내도 같은 곳에서 다시 확인할 수 있습니다.
                </div>
            )}

            {loading ? (
                <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl w-full" />)}
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-slate-500 text-sm">진행 중인 전화 대행 요청이 없습니다.</p>
                    {!isAdmin && (
                        <Link href="/proxy-bookings/new">
                            <button className="mt-4 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                                첫 번째 요청 작성하기
                            </button>
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-4 mt-8">
                    {requests.map(req => (
                        <Link key={req.id} href={`/proxy-bookings/${req.id}`} className="block">
                            <div className="border border-slate-100 bg-white rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{req.category}</span>
                                        <h3 className="font-bold text-slate-900 text-[15px] group-hover:text-blue-600 transition-colors">
                                            {getProxyRequestTitle(req)}
                                        </h3>
                                    </div>
                                    <div className="shrink-0">{getStatusBadge(req.status)}</div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        {req.category === 'RESTAURANT' && <Clock size={12} />}
                                        {getRequestDateSummary(req)}
                                    </span>

                                    {isAdmin && (
                                        <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                                            요청자: {getProxyRequesterDisplayName(req.profiles)}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                                        <span className="text-slate-500">결제/처리 상태</span>
                                        <span className="text-slate-700">{getProxyPaymentStatusLabel(req)}</span>
                                    </div>
                                    <p className="mt-2 text-[12px] leading-5 text-slate-600">
                                        {getNextStepCopy(req)}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
