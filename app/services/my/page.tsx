'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Clock, MapPin, Users, Calendar } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { getServiceRequestStatusLabel } from '@/app/constants/serviceStatus';
import type { ServiceRequestCard } from '@/app/types/service';

export default function MyServiceRequestsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState<ServiceRequestCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const res = await fetch('/api/services/requests?mode=my');
      const data = await res.json();
      if (data.success) setRequests(data.data ?? []);
      setLoading(false);
    };
    void load();
  }, [router, supabase]);

  const statusColor: Record<string, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    matched: 'bg-blue-100 text-blue-700',
    paid: 'bg-indigo-100 text-indigo-700',
    confirmed: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-100 text-red-600',
    expired: 'bg-slate-100 text-slate-400',
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[18px] md:text-2xl font-black tracking-tight">내 서비스 의뢰</h1>
          <Link href="/services/request">
            <button className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 md:px-4 md:py-2 rounded-xl font-bold text-[12px] md:text-sm hover:bg-slate-800 transition-colors shadow">
              <Plus size={14} /> 새 의뢰
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-24 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-[13px] md:text-sm mb-6">아직 등록한 의뢰가 없습니다.</p>
            <Link href="/services/request">
              <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-[13px] md:text-sm hover:bg-slate-800 transition-colors">
                첫 의뢰 등록하기
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Link key={req.id} href={`/services/${req.id}`}>
                <div className="border border-slate-100 rounded-2xl p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer bg-white [box-shadow:0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-bold text-[13px] md:text-[15px] text-slate-900 leading-tight line-clamp-2 flex-1">
                      {req.title}
                    </h2>
                    <span className={`shrink-0 text-[10px] md:text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[req.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {getServiceRequestStatusLabel(req.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] md:text-[13px] text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={11} />{req.city}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{req.service_date}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{req.duration_hours}시간</span>
                    <span className="flex items-center gap-1"><Users size={11} />{req.guest_count}명</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-black text-[14px] md:text-[16px] text-slate-900">
                      ₩{req.total_customer_price.toLocaleString()}
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
