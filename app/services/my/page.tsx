'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, Plus, Clock, MapPin, Users,
  Calendar, Briefcase, ArrowLeft, Zap, Globe2
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useLanguage } from '@/app/context/LanguageContext';
import { getServiceRequestStatusLabel } from '@/app/constants/serviceStatus';
import type { ServiceRequestCard } from '@/app/types/service';

// 상태별 칩 스타일 — 강한 컬러로 즉각 식별 가능하게
const STATUS_CONFIG: Record<string, { cls: string; dot: string }> = {
  pending_payment: { cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  open: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  matched: { cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  paid: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-400' },
  confirmed: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-400' },
  completed: { cls: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  cancelled: { cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400' },
  expired: { cls: 'bg-slate-50 text-slate-400 border-slate-200', dot: 'bg-slate-300' },
};

export default function MyServiceRequestsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
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

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors md:hidden">
              <ArrowLeft size={14} />
            </button>
            <div>
              <h1 className="text-[18px] md:text-2xl font-black tracking-tight">{t('req_my_title')}</h1>
              {!loading && requests.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5">총 {requests.length}건의 의뢰</p>
              )}
            </div>
          </div>
          <Link href="/services/request">
            <button className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-bold text-[12px] md:text-sm hover:bg-slate-800 transition-colors shadow-md hover:shadow-lg active:scale-[0.98]">
              <Plus size={14} /> 새 의뢰
            </button>
          </Link>
        </div>

        {/* ── 목록 ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-28 bg-white rounded-2xl border border-slate-100" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Briefcase size={28} className="text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-slate-600 text-[14px] mb-1">{t('req_my_empty')}</p>
            </div>
            <Link href="/services/intro">
              <button className="mt-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-[13px] md:text-sm hover:bg-slate-800 transition-colors shadow-lg active:scale-[0.98]">
                {t('req_btn_first')} →
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const cfg = STATUS_CONFIG[req.status] ?? { cls: 'bg-slate-50 text-slate-400 border-slate-200', dot: 'bg-slate-300' };
              return (
                <Link key={req.id} href={`/services/${req.id}`}>
                  <div className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer">
                    {/* 상단 */}
                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Briefcase size={16} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-[13px] md:text-[15px] text-slate-900 leading-snug line-clamp-2 group-hover:text-slate-700 transition-colors">
                          {req.title}
                        </h2>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1.5 text-[10px] md:text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><MapPin size={9} />{req.city}</span>
                          <span className="flex items-center gap-1"><Calendar size={9} />{req.service_date}</span>
                          <span className="flex items-center gap-1"><Clock size={9} />{req.duration_hours}시간</span>
                          <span className="flex items-center gap-1"><Users size={9} />{req.guest_count}명</span>
                          {req.languages?.length > 0 && (
                            <span className="flex items-center gap-1"><Globe2 size={9} />{req.languages.slice(0, 2).join(' · ')}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-200 shrink-0 mt-1 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    {/* 구분선 */}
                    <div className="mx-4 border-t border-slate-50" />

                    {/* 하단: 상태 + 금액 */}
                    <div className="px-4 pb-4 pt-3 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {getServiceRequestStatusLabel(req.status)}
                      </span>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 mb-0.5">{t('req_total_paid')}</p>
                        <p className="font-black text-[15px] md:text-[17px] text-slate-900">
                          ₩{req.total_customer_price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
