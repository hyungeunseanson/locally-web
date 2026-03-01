'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, MapPin, Users, Calendar, ChevronRight, Briefcase } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import {
  getServiceRequestStatusLabel,
  getServiceApplicationStatusLabel,
  isOpenServiceRequest,
} from '@/app/constants/serviceStatus';
import type { ServiceRequestCard, ServiceApplication } from '@/app/types/service';

type SubTab = 'board' | 'my-applications' | 'active';

type ApplicationWithRequest = ServiceApplication & {
  service_requests?: Pick<ServiceRequestCard, 'id' | 'title' | 'city' | 'service_date' | 'duration_hours' | 'total_customer_price' | 'status'> | null;
};

export default function ServiceJobsTab() {
  const supabase = useMemo(() => createClient(), []);
  const [subTab, setSubTab] = useState<SubTab>('board');
  const [requests, setRequests] = useState<ServiceRequestCard[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationWithRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    void init();
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      if (subTab === 'board') {
        const res = await fetch('/api/services/requests?mode=board');
        const data = await res.json();
        if (data.success) setRequests(data.data ?? []);
      } else if (subTab === 'my-applications' || subTab === 'active') {
        const { data: apps } = await supabase
          .from('service_applications')
          .select(`
            *,
            service_requests:request_id (id, title, city, service_date, duration_hours, total_customer_price, status)
          `)
          .eq('host_id', userId)
          .order('created_at', { ascending: false });

        const all = (apps ?? []) as ApplicationWithRequest[];

        if (subTab === 'active') {
          setMyApplications(all.filter((a) => a.status === 'selected' && a.service_requests?.status !== 'cancelled'));
        } else {
          setMyApplications(all);
        }
      }
      setLoading(false);
    };
    void load();
  }, [subTab, userId, supabase]);

  const subTabClass = (tab: SubTab) =>
    `px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold border transition-colors ${
      subTab === tab
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
    }`;

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    selected: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-600',
    withdrawn: 'bg-slate-100 text-slate-400',
  };

  return (
    <div className="space-y-4">
      {/* 서브탭 */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button className={subTabClass('board')} onClick={() => setSubTab('board')}>
          열린 의뢰
        </button>
        <button className={subTabClass('my-applications')} onClick={() => setSubTab('my-applications')}>
          내 지원 현황
        </button>
        <button className={subTabClass('active')} onClick={() => setSubTab('active')}>
          진행중 서비스
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-24 bg-slate-100 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* 열린 의뢰 탭 */}
          {subTab === 'board' && (
            requests.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-[13px] md:text-sm">
                현재 열린 의뢰가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <Link key={req.id} href={`/services/${req.id}`}>
                    <div className="border border-slate-100 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer bg-white [box-shadow:0_1px_3px_rgba(0,0,0,0.05)] group">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-[13px] md:text-[14px] text-slate-900 line-clamp-2 flex-1">{req.title}</h3>
                        <ChevronRight size={15} className="text-slate-300 shrink-0 group-hover:text-slate-500" />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] md:text-[12px] text-slate-500 mb-2">
                        <span className="flex items-center gap-1"><MapPin size={10} />{req.city}</span>
                        <span className="flex items-center gap-1"><Calendar size={10} />{req.service_date}</span>
                        <span className="flex items-center gap-1"><Clock size={10} />{req.duration_hours}h</span>
                        <span className="flex items-center gap-1"><Users size={10} />{req.guest_count}명</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] md:text-[10px] text-slate-400">{new Date(req.created_at).toLocaleDateString('ko-KR')}</span>
                        <span className="font-black text-[13px] md:text-[14px] text-slate-900">₩{req.total_customer_price.toLocaleString()}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* 내 지원 / 진행중 탭 */}
          {(subTab === 'my-applications' || subTab === 'active') && (
            myApplications.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-[13px] md:text-sm">
                {subTab === 'active' ? '현재 진행 중인 서비스가 없습니다.' : '아직 지원한 의뢰가 없습니다.'}
              </div>
            ) : (
              <div className="space-y-3">
                {myApplications.map((app) => {
                  const req = app.service_requests;
                  return (
                    <Link key={app.id} href={`/services/${app.request_id}`}>
                      <div className="border border-slate-100 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer bg-white [box-shadow:0_1px_3px_rgba(0,0,0,0.05)]">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-bold text-[13px] md:text-[14px] text-slate-900 line-clamp-2 flex-1">
                            {req?.title ?? '의뢰'}
                          </h3>
                          <span className={`shrink-0 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColor[app.status] ?? 'bg-slate-100 text-slate-500'}`}>
                            {getServiceApplicationStatusLabel(app.status)}
                          </span>
                        </div>
                        {req && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] md:text-[12px] text-slate-500 mb-1.5">
                            <span className="flex items-center gap-1"><MapPin size={10} />{req.city}</span>
                            <span className="flex items-center gap-1"><Calendar size={10} />{req.service_date}</span>
                            <span className="flex items-center gap-1"><Clock size={10} />{req.duration_hours}h</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] md:text-[10px] px-1.5 py-0.5 rounded text-slate-400 ${req && isOpenServiceRequest(req.status) ? 'text-emerald-600' : ''}`}>
                            {req ? getServiceRequestStatusLabel(req.status) : ''}
                          </span>
                          {req && (
                            <span className="font-black text-[13px] md:text-[14px] text-emerald-600">
                              ₩{(20000 * req.duration_hours).toLocaleString()} 예정
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* 잡보드로 이동 버튼 */}
      {subTab === 'board' && (
        <Link href="/services">
          <button className="w-full border border-slate-200 rounded-2xl py-3 text-[12px] md:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mt-2">
            <Briefcase size={14} /> 잡보드 전체 보기
          </button>
        </Link>
      )}
    </div>
  );
}
