'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { Plus, Phone, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { ProxyRequest } from '@/app/types/proxy';

export default function ProxyBookingsBoard() {
    const supabase = createClient();
    const [requests, setRequests] = useState<ProxyRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                setIsAdmin(profile?.role === 'admin');

                const res = await fetch('/api/proxy-bookings');
                const data = await res.json();

                if (data.success) {
                    setRequests(data.data as ProxyRequest[]);
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

    const truncate = (text: string, length: number) => {
        return text.length > length ? text.substring(0, length) + '...' : text;
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
                <div className="space-y-4">
                    {requests.map(req => (
                        <Link key={req.id} href={`/proxy-bookings/${req.id}`}>
                            <div className="border border-slate-100 bg-white rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{req.category}</span>
                                        <h3 className="font-bold text-slate-900 text-[15px] group-hover:text-blue-600 transition-colors">
                                            {req.category === 'RESTAURANT' ? req.form_data?.restaurant_name :
                                                req.category === 'TRANSPORT' ? `${req.form_data?.departure_location} → ${req.form_data?.arrival_location}` :
                                                    '대행 서비스 상세 보기'}
                                        </h3>
                                    </div>
                                    <div className="shrink-0">{getStatusBadge(req.status)}</div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        {req.category === 'RESTAURANT' && <Clock size={12} />}
                                        {req.category === 'RESTAURANT' ? `${req.form_data?.target_date} ${req.form_data?.target_time}` : new Date(req.created_at).toLocaleDateString()}
                                    </span>

                                    {isAdmin && (
                                        <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                                            요청자: {req.profiles?.name || '고객'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
