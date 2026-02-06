'use client';

import React from 'react';
import { BarChart2, Star, Heart, TrendingUp } from 'lucide-react';

export default function AnalyticsTab({ bookings, exps }: any) {
  // 인기 체험 분석 (예약 건수 기준)
  const popularExps = [...exps].sort((a, b) => (b.bookings?.[0]?.count || 0) - (a.bookings?.[0]?.count || 0)).slice(0, 5);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 mb-8">
        <BarChart2 size={32} className="text-purple-500"/> 체험 및 트렌드 통계
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. 인기 체험 랭킹 */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Star className="text-yellow-400" fill="currentColor"/> 인기 체험 TOP 5 (예약순)</h3>
          <div className="space-y-4">
            {popularExps.map((exp, idx) => (
              <div key={exp.id} className="flex items-center gap-4">
                <span className={`w-6 h-6 flex items-center justify-center rounded font-bold text-xs ${idx < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden"><img src={exp.photos?.[0]} className="w-full h-full object-cover"/></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{exp.title}</div>
                  <div className="text-xs text-slate-500">{exp.category} · {exp.city}</div>
                </div>
                <div className="text-sm font-bold">{exp.bookings?.[0]?.count || 0}건</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. 카테고리별 비중 (간이 막대 그래프) */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><TrendingUp className="text-blue-500"/> 카테고리별 선호도</h3>
          <div className="space-y-5">
            {[
              { label: '문화/예술', pct: 45, color: 'bg-rose-500' },
              { label: '아웃도어', pct: 30, color: 'bg-blue-500' },
              { label: '식음료', pct: 15, color: 'bg-yellow-500' },
              { label: '기타', pct: 10, color: 'bg-slate-300' }
            ].map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>{cat.label}</span>
                  <span>{cat.pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${cat.color}`} style={{ width: `${cat.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}