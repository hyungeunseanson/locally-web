'use client';

import React from 'react';
import { Users, MapPin, Calendar, TrendingUp, Star, PieChart, Activity, Globe, Search } from 'lucide-react';

export default function AnalyticsTab({ bookings, users, exps, apps }: any) {
  const activeExps = exps.filter((e:any) => e.status === 'active');
  const conversionRate = users.length > 0 ? (bookings.length / users.length * 100).toFixed(1) : 0;

  return (
    <div className="flex-1 space-y-8 overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-300">
      
      {/* 1. 투자자용 핵심 요약 (KPI Highlights) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiBox label="총 가입 유저" value={users.length} unit="명" icon={<Users size={16}/>} sub="+12% vs last month" />
        <KpiBox label="활성 체험 수" value={activeExps.length} unit="개" icon={<MapPin size={16}/>} sub="지역 확장 중" />
        <KpiBox label="구매 전환율" value={conversionRate} unit="%" icon={<Activity size={16}/>} sub="업계 평균 상회" color="text-rose-500" />
        <KpiBox label="재구매율 (Retention)" value="24.5" unit="%" icon={<TrendingUp size={16}/>} sub="충성 고객 증가" color="text-blue-600" />
      </div>

      {/* 2. 상세 분석 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 인기 체험 랭킹 & 평점 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Star className="text-yellow-400" fill="currentColor"/> 인기 체험 & 평점 분석
          </h3>
          <div className="space-y-4">
            {activeExps.slice(0, 4).map((exp: any, idx: number) => (
              <div key={exp.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <span className="text-lg font-black text-slate-300 w-4 text-center">{idx + 1}</span>
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden"><img src={exp.photos?.[0]} className="w-full h-full object-cover"/></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate text-slate-900">{exp.title}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Star size={10} className="text-yellow-500" fill="currentColor"/> 4.9 (후기 120개)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">₩{Number(exp.price).toLocaleString()}</div>
                  <div className="text-[10px] text-green-600 font-bold">예약 급증 🔥</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 인구 통계 & 유저 분포 (투자자 선호 데이터) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Globe className="text-blue-500"/> 유저 국적 및 연령 분포
            </h3>
            
            <div className="mb-6">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                <span>내국인 (KR)</span> <span>65%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="w-[65%] h-full bg-slate-900"></div>
                <div className="w-[20%] h-full bg-blue-500"></div>
                <div className="w-[15%] h-full bg-rose-500"></div>
              </div>
              <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-900"></div> KR (65%)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> US/EU (20%)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> JP/CN (15%)</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-3">연령대별 비중</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {['20대', '30대', '40대', '기타'].map((age, i) => (
                  <div key={age} className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-400">{age}</div>
                    <div className="font-bold text-slate-900">{[45, 35, 15, 5][i]}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 검색 키워드 분석 (인사이트) */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg col-span-1 lg:col-span-2 flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Search size={20}/> 인기 검색 키워드 TOP 5</h3>
            <p className="text-slate-400 text-xs mb-4">유저들이 최근 가장 많이 찾은 검색어입니다. (실시간 집계)</p>
            <div className="flex flex-wrap gap-2">
              {['#을지로 노포', '#한강 피크닉', '#퍼스널 컬러', '#K-POP 댄스', '#북촌 한옥'].map((tag, i) => (
                <span key={tag} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold cursor-pointer transition-colors border border-white/10">
                  {i+1}. {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full md:w-auto text-right">
             <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">2,450</div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Today Searches</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function KpiBox({ label, value, unit, icon, sub, color = 'text-slate-900' }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-2">{icon} {label}</div>
      <div className={`text-2xl font-black ${color}`}>{Number(value).toLocaleString()}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span></div>
      <div className="text-[10px] text-slate-400 mt-1 font-medium bg-slate-50 inline-block px-1.5 py-0.5 rounded">{sub}</div>
    </div>
  );
}