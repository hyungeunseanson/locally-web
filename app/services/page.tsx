'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock, MapPin, Users, Calendar, ChevronRight,
  Briefcase, SlidersHorizontal, Zap, Globe2
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import type { ServiceRequestCard } from '@/app/types/service';

const CITY_FILTERS = ['전체', '도쿄', '오사카', '후쿠오카', '삿포로', '나고야', '서울', '부산', '제주'];

// 상태별 칩 스타일 (호스트 잡보드는 open만 노출)
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open: { label: '모집중', cls: 'bg-emerald-500 text-white' },
  matched: { label: '매칭완료', cls: 'bg-blue-500 text-white' },
  paid: { label: '결제완료', cls: 'bg-indigo-500 text-white' },
  confirmed: { label: '확정', cls: 'bg-indigo-500 text-white' },
  completed: { label: '완료', cls: 'bg-slate-500 text-white' },
  cancelled: { label: '취소', cls: 'bg-red-400 text-white' },
  expired: { label: '마감', cls: 'bg-slate-300 text-slate-600' },
};

export default function ServiceJobBoardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState<ServiceRequestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('전체');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
    };
    void checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const city = selectedCity === '전체' ? '' : selectedCity;
      const res = await fetch(`/api/services/requests?mode=board${city ? `&city=${encodeURIComponent(city)}` : ''}`);
      const data = await res.json();
      if (data.success) setRequests(data.data ?? []);
      setLoading(false);
    };
    void load();
  }, [selectedCity]);

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-slate-900 font-sans">
      <SiteHeader />

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">

        {/* ── 헤더 ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
                <Briefcase size={15} className="text-white" />
              </div>
              <h1 className="text-[19px] md:text-2xl font-black tracking-tight">서비스 잡보드</h1>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400">
              <SlidersHorizontal size={12} />
              <span>{requests.length}건</span>
            </div>
          </div>
          <p className="text-[11px] md:text-sm text-slate-500 pl-10">
            고객의 맞춤 서비스 의뢰 — 원하는 의뢰에 지원하세요
          </p>
        </div>

        {/* ── 도시 필터 ── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-5">
          {CITY_FILTERS.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold border transition-all ${selectedCity === city
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* ── 목록 ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-32 bg-white rounded-2xl border border-slate-100" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <Briefcase size={24} className="text-slate-300" />
            </div>
            <p className="font-semibold text-slate-500 text-[13px] md:text-sm">현재 열린 의뢰가 없습니다</p>
            <p className="text-slate-400 text-[11px] md:text-xs">다른 도시를 선택하거나 나중에 다시 확인해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const cfg = STATUS_CONFIG[req.status] ?? { label: req.status, cls: 'bg-slate-200 text-slate-600' };
              const earnStr = `₩${(req.total_host_payout ?? 0).toLocaleString()}`;
              return (
                <Link key={req.id} href={`/services/${req.id}`}>
                  <div className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer">
                    {/* 상단 헤더 바 */}
                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                      {/* 도시 아이콘 */}
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <MapPin size={16} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded-full font-black tracking-wide ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] md:text-xs text-slate-400">{req.city}</span>
                        </div>
                        <h2 className="font-bold text-[13px] md:text-[15px] text-slate-900 leading-snug line-clamp-2 group-hover:text-slate-700 transition-colors">
                          {req.title}
                        </h2>
                      </div>
                      <ChevronRight size={16} className="text-slate-200 shrink-0 mt-1 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    {/* 구분선 */}
                    <div className="mx-4 border-t border-slate-50" />

                    {/* 하단 메타 */}
                    <div className="px-4 pb-4 pt-3 flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] md:text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><Calendar size={10} />{req.service_date}</span>
                        <span className="flex items-center gap-1"><Clock size={10} />{req.duration_hours}시간</span>
                        <span className="flex items-center gap-1"><Users size={10} />{req.guest_count}명</span>
                        {req.languages?.length > 0 && (
                          <span className="flex items-center gap-1"><Globe2 size={10} />{req.languages.slice(0, 2).join(' · ')}</span>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] md:text-[10px] text-slate-400 mb-0.5">예상 수입</p>
                        <p className="font-black text-[15px] md:text-[17px] text-emerald-600">{earnStr}</p>
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
