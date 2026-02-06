'use client';

import React from 'react';
import { Users, MapPin, Calendar, TrendingUp, Star } from 'lucide-react';

export default function AnalyticsTab({ bookings, users, exps, apps }: any) {
  // 인기 체험 분석 (예약 많은 순 TOP 5)
  const popularExps = [...exps]
    .sort((a, b) => (b.bookings?.[0]?.count || 0) - (a.bookings?.[0]?.count || 0))
    .slice(0, 5);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      
      {/* 🟢 1. 핵심 지표 (기존 내용 복구) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><Users size={16}/> 총 회원수</div>
          <div className="text-3xl font-black">{users.length}명</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><MapPin size={16}/> 운영 체험</div>
          <div className="text-3xl font-black">{exps.filter((e:any)=>e.status==='active').length}개</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><Calendar size={16}/> 총 예약</div>
          <div className="text-3xl font-black">{bookings.length}건</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><Users size={16}/> 호스트 대기</div>
          <div className="text-3xl font-black text-purple-600">{apps.filter((a:any)=>a.status==='pending').length}명</div>
        </div>
      </div>

      {/* 2. 상세 분석 (신규 추가) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 인기 체험 랭킹 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <TrendingUp className="text-rose-500"/> 인기 체험 TOP 5
          </h3>
          <div className="space-y-4">
            {popularExps.map((exp, idx) => (
              <div key={exp.id} className="flex items-center gap-4">
                <span className={`w-6 h-6 flex items-center justify-center rounded font-bold text-xs ${idx < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-100"><img src={exp.photos?.[0]} className="w-full h-full object-cover"/></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{exp.title}</div>
                  <div className="text-xs text-slate-500">{exp.category}</div>
                </div>
                <div className="text-sm font-bold bg-slate-50 px-2 py-1 rounded">{exp.bookings?.[0]?.count || 0}건</div>
              </div>
            ))}
            {popularExps.length === 0 && <div className="text-slate-400 text-center py-4">데이터가 충분하지 않습니다.</div>}
          </div>
        </div>

        {/* 예약 상태 비율 (간이 그래프) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-6">예약 상태 현황</h3>
          <div className="space-y-6">
            {[
              { label: '확정된 예약', count: bookings.filter((b:any)=>b.status!=='cancelled').length, color: 'bg-green-500' },
              { label: '취소된 예약', count: bookings.filter((b:any)=>b.status==='cancelled').length, color: 'bg-red-500' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span>{stat.label}</span>
                  <span>{stat.count}건 ({bookings.length > 0 ? Math.round(stat.count/bookings.length*100) : 0}%)</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.color}`} style={{ width: `${bookings.length > 0 ? (stat.count/bookings.length*100) : 0}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}