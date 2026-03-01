'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, MapPin, Users, Calendar, ChevronRight, Briefcase } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import type { ServiceRequestCard } from '@/app/types/service';

const CITY_FILTERS = ['전체', '도쿄', '오사카', '후쿠오카', '삿포로', '나고야', '서울', '부산', '제주'];

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
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        {/* 헤더 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase size={18} className="text-slate-700" />
            <h1 className="text-[18px] md:text-2xl font-black tracking-tight">서비스 잡보드</h1>
          </div>
          <p className="text-[11px] md:text-sm text-slate-500">고객들의 맞춤 서비스 의뢰 목록입니다. 원하는 의뢰에 지원해보세요!</p>
        </div>

        {/* 도시 필터 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          {CITY_FILTERS.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold border transition-colors ${
                selectedCity === city
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-28 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-[13px] md:text-sm">현재 열린 의뢰가 없습니다.</p>
            <p className="text-slate-400 text-[11px] md:text-xs mt-1">다른 도시를 선택하거나 나중에 다시 확인해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Link key={req.id} href={`/services/${req.id}`}>
                <div className="border border-slate-100 rounded-2xl p-4 md:p-5 hover:shadow-md transition-all cursor-pointer bg-white [box-shadow:0_1px_4px_rgba(0,0,0,0.06)] group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-bold text-[13px] md:text-[15px] text-slate-900 leading-tight line-clamp-2 flex-1 group-hover:text-slate-700 transition-colors">
                      {req.title}
                    </h2>
                    <ChevronRight size={16} className="text-slate-300 shrink-0 mt-0.5 group-hover:text-slate-500 transition-colors" />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] md:text-[12px] text-slate-500 mb-2.5">
                    <span className="flex items-center gap-1"><MapPin size={11} />{req.city}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{req.service_date}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{req.duration_hours}시간</span>
                    <span className="flex items-center gap-1"><Users size={11} />{req.guest_count}명</span>
                  </div>
                  {req.languages && req.languages.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {req.languages.map((lang) => (
                        <span key={lang} className="text-[9px] md:text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{lang}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] md:text-xs text-slate-400">
                      {new Date(req.created_at).toLocaleDateString('ko-KR')} 등록
                    </span>
                    <span className="font-black text-[14px] md:text-[15px] text-slate-900">
                      ₩{req.total_customer_price.toLocaleString()}
                    </span>
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
