'use client';

import React from 'react';
import { Activity, AlertTriangle, CheckCircle, Search, Star, TrendingUp, UserCheck } from 'lucide-react';
import { SimpleKpi } from './helpers';

type SummarySource = 'server' | 'cached' | 'fallback';

export default function AnalyticsHostSection({
  stats,
  summarySource,
  onSelectMetric,
}: {
  stats: any;
  summarySource: SummarySource;
  onSelectMetric: (metric: string) => void;
}) {
  return (
    <div className="space-y-12 animate-in slide-in-from-bottom-[50px] duration-500">
      {summarySource === 'cached' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">최근 정상 호스트 집계값을 유지 중입니다.</div>
            <div className="text-xs text-amber-700">현재 구간의 최신 서버 응답을 다시 받지 못해, 마지막 정상 호스트 집계값을 임시로 표시하고 있습니다.</div>
          </div>
        </div>
      )}
      {summarySource === 'fallback' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">호스트 통계 일부가 임시 집계값입니다.</div>
            <div className="text-xs text-amber-700">호스트 서버 집계를 불러오지 못해 현재 화면 계산값을 대신 표시 중입니다.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">호스트 퍼널 / 유망주 / 집중 관리 기준</div>
          <div className="mt-1">퍼널은 지원부터 첫 결제 창출까지의 흐름이며, 유망주는 평점 4.0 이상·취소 0건, 집중 관리는 취소 누적 또는 저평점 호스트 기준입니다.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">응답시간 / 응답률 기준</div>
          <div className="mt-1">평균 응답 시간은 문의 접수 후 첫 답변까지 걸린 시간이며, 응답률은 전체 문의 중 답변이 남은 비율입니다.</div>
        </div>
      </div>

      {/* 호스트 활성화 퍼널 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            🎯 호스트 활성화 퍼널 <span className="text-xs font-normal text-slate-400">지원부터 첫 결제 창출까지</span>
          </h2>
          <Activity size={20} className="text-emerald-500" />
        </div>
        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-emerald-50 rounded-full translate-x-16 md:translate-x-32 -translate-y-16 md:-translate-y-32 blur-2xl md:blur-3xl"></div>
          {[
            { label: '지원서 접수', val: stats.hostEcosystem.funnel.applied, color: 'bg-slate-200 text-slate-600' },
            { label: '승인 완료', val: stats.hostEcosystem.funnel.approved, color: 'bg-emerald-100 text-emerald-700' },
            { label: '상품 등록 (Active)', val: stats.hostEcosystem.funnel.active, color: 'bg-emerald-300 text-emerald-900' },
            { label: '첫 예약 달성', val: stats.hostEcosystem.funnel.booked, color: 'bg-emerald-500 text-white' },
          ].map((step, i, arr) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center w-full md:w-auto">
                <div className={`w-full md:w-28 h-16 md:h-28 rounded-xl md:rounded-2xl flex md:flex-col items-center justify-between md:justify-center px-4 md:px-0 font-black text-xl md:text-2xl shadow-sm border border-white/50 ${step.color} relative z-10`}>
                  <span className="text-xs md:text-[10px] font-bold opacity-80 md:mt-1 order-1 md:order-2">{step.label}</span>
                  <span className="order-2 md:order-1">{step.val.toLocaleString()}</span>
                </div>
                {i > 0 && stats.hostEcosystem.funnel.applied > 0 && (
                  <div className="mt-4 text-xs font-bold text-slate-400">
                    전환율 {((step.val / stats.hostEcosystem.funnel.applied) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
              {i < arr.length - 1 && (
                <div className="hidden md:block text-slate-200">
                  <TrendingUp size={32} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* 슈퍼호스트 유망주 / 집중관리 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 mt-8">
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-1 md:gap-2">
              <Star size={16} className="text-emerald-500 hidden md:block" />
              <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span>⭐ 슈퍼 호스트 유망주</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">평점 4.0↑ 취소 0</span>
              </span>
            </h3>
            <UserCheck size={16} className="text-emerald-500 md:w-[18px] md:h-[18px]" />
          </div>
          <div className="space-y-4">
            {stats.superHostCandidates.length > 0 ? stats.superHostCandidates.map((host: any) => (
              <div key={host.id} onClick={() => { window.location.href = `/users/${host.id}`; }} className="flex items-center gap-4 p-3 hover:bg-emerald-50/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-emerald-100">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  {host.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{host.name}</div>
                  <div className="text-xs text-slate-500">예약 {host.bookings}건 • 취소율 0%</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 px-2 py-1 bg-emerald-100 rounded-lg">
                    평점 {host.rating}
                  </div>
                </div>
              </div>
            )) : (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <UserCheck size={24} className="text-slate-300" />
                <p> 조건에 맞는 유망주가 아직 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-rose-50 rounded-full translate-x-12 md:translate-x-16 -translate-y-12 md:-translate-y-16 blur-xl md:blur-2xl"></div>
          <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10">
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-1 md:gap-2">
              <AlertTriangle size={16} className="text-rose-500 hidden md:block" />
              <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span>🚨 집중 관리 호스트</span> <span className="text-[10px] md:text-xs font-normal text-rose-400">예의/평점 주의</span>
              </span>
            </h3>
            <AlertTriangle size={16} className="text-rose-500 animate-pulse md:w-[18px] md:h-[18px]" />
          </div>
          <div className="space-y-4 relative z-10">
            {stats.riskHosts.length > 0 ? stats.riskHosts.map((host: any) => (
              <div key={host.id} onClick={() => { window.location.href = `/users/${host.id}`; }} className="flex items-center gap-4 p-3 bg-white hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-slate-100 hover:border-rose-200">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  {host.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{host.name}</div>
                  <div className="text-xs font-medium text-rose-500">주의: 취소 {host.cancelCount}건 • 예약 {host.bookings}건</div>
                </div>
                <div className="text-right flex flex-col items-end">
                  {host.rating !== 'New' && Number(host.rating) < 3.5 && (
                    <div className="text-[10px] font-bold text-white px-1.5 py-0.5 bg-rose-500 rounded flex items-center gap-1 mb-1">
                      <AlertTriangle size={10} /> 저평점
                    </div>
                  )}
                  <div className="text-xs font-bold text-slate-700">
                    평점 {host.rating}
                  </div>
                </div>
              </div>
            )) : (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <CheckCircle size={24} className="text-emerald-300" />
                <p>현재 감지된 불량 평점 호스트가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 커뮤니케이션 현황 */}
      <section>
        <div className="flex items-center justify-between mb-3 md:mb-4 mt-6 md:mt-8">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            💬 커뮤니케이션 현황 <span className="text-[10px] md:text-xs font-normal text-slate-400">문의 대비 응답 시간</span>
          </h2>
          <div onClick={() => onSelectMetric('response')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            상세보기
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SimpleKpi
            label="평균 응답 시간 (Average Response Time)"
            value={stats.avgResponseTime}
            unit="분"
            sub="문의 접수 후"
            className={stats.avgResponseTime < 60 ? 'text-emerald-500' : 'text-rose-500'}
            onClick={() => onSelectMetric('response')}
          />
          <SimpleKpi
            label="호스트 응답률 (Response Rate)"
            value={stats.responseRate}
            unit="%"
            sub="전체 문의 대비"
            className={stats.responseRate >= 90 ? 'text-emerald-500' : 'text-amber-500'}
            onClick={() => onSelectMetric('response')}
          />
        </div>
      </section>

      {/* 호스트 생태계 통계 */}
      <section>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            👥 호스트 생태계 통계
          </h2>
          <div onClick={() => onSelectMetric('hostDemographics')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            상세보기
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-slate-900 text-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-indigo-500/20 rounded-full translate-x-8 md:translate-x-12 -translate-y-8 md:-translate-y-12 blur-xl md:blur-2xl"></div>
            <h3 className="text-base md:text-lg font-bold mb-4 md:mb-6 flex items-center gap-2 relative z-10">
              <Search size={16} className="text-indigo-400 md:w-[18px] md:h-[18px]" /> 주요 유입 경로
            </h3>
            <div className="space-y-5 relative z-10">
              {stats.hostEcosystem.sources.map((src: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-300">{src.name}</span>
                    <span className="font-bold">{src.percent.toFixed(1)}% ({src.count}명)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${src.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="flex-1">
              <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                <UserCheck size={16} className="text-blue-500 md:w-[18px] md:h-[18px]" /> 호스트 국적 비율
              </h3>
              <div className="flex h-24 md:h-32 items-end gap-2 border-b border-slate-100 pb-2">
                {stats.hostEcosystem.nationalities.map((nat: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer relative">
                    <div className="absolute -top-6 md:-top-8 w-full text-center text-[10px] md:text-xs font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {nat.count}명
                    </div>
                    <div className="w-full bg-blue-100 group-hover:bg-blue-300 rounded-t-sm md:rounded-t-md transition-all duration-300" style={{ height: `${Math.max(nat.percent, 5)}%` }}></div>
                    <div className="text-center mt-1 md:mt-2 text-[10px] md:text-xs font-bold text-slate-600 truncate">{nat.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-8">
              <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                <Star size={16} className="text-yellow-500 md:w-[18px] md:h-[18px]" /> 보유 언어 역량
              </h3>
              <div className="space-y-4">
                {stats.hostEcosystem.languages.map((lang: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-bold text-slate-600">{lang.name}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${lang.percent}%` }}></div>
                    </div>
                    <div className="w-8 text-right text-xs font-mono text-slate-500">{lang.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
