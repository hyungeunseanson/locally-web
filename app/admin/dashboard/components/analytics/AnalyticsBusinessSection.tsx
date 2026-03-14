'use client';

import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { SimpleKpi, FunnelBar } from './helpers';
import AnalyticsCustomerCompositionSection from './AnalyticsCustomerCompositionSection';
import AnalyticsSearchDemandSection from './AnalyticsSearchDemandSection';
import type {
  AnalyticsStats,
  AnalyticsCustomerCompositionSummary,
  AnalyticsSearchIntentSummary,
  CustomerCompositionSource,
  SearchIntentSource,
  SearchTrendItem,
  SummarySource,
} from './types';

export default function AnalyticsBusinessSection({
  stats,
  summarySource,
  onSelectMetric,
  searchIntent,
  searchIntentSource,
  searchTrends,
  customerComposition,
  customerCompositionSource,
}: {
  stats: AnalyticsStats;
  summarySource: SummarySource;
  onSelectMetric: (metric: string) => void;
  searchIntent: AnalyticsSearchIntentSummary | null;
  searchIntentSource: SearchIntentSource;
  searchTrends: SearchTrendItem[];
  customerComposition: AnalyticsCustomerCompositionSummary | null;
  customerCompositionSource: CustomerCompositionSource;
}) {
  return (
    <>
      {summarySource === 'cached' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">최근 정상 서버 집계값을 유지 중입니다.</div>
            <div className="text-xs text-amber-700">현재 구간의 최신 서버 응답을 다시 받지 못해, 마지막 정상 집계값을 임시로 표시하고 있습니다.</div>
          </div>
        </div>
      )}
      {summarySource === 'fallback' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">일부 수치는 임시 집계값입니다.</div>
            <div className="text-xs text-amber-700">서버 집계를 불러오지 못해 현재 화면 계산값을 대신 표시 중입니다.</div>
          </div>
        </div>
      )}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <CheckCircle size={16} className="mt-0.5 shrink-0 text-slate-500" />
        <div>
          <div className="font-semibold">상단 지표와 결제 고객 인구통계는 플랫폼 전체 기준입니다.</div>
          <div className="text-xs text-slate-500">체험 예약과 서비스 결제를 합친 전체 결제 데이터를 기준으로 집계합니다.</div>
        </div>
      </div>

      {/* KPI 카드 */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <SimpleKpi label="신규 가입 유저" value={stats.totalUsers} unit="명" sub="(기간 내)" onClick={() => onSelectMetric('users')} />
          <SimpleKpi label="활성 체험" value={stats.activeExpsCount} unit="개" onClick={() => onSelectMetric('exps')} />
          <SimpleKpi label="총 거래액 (GMV)" value={`₩${(stats.gmv / 10000).toFixed(0)}`} unit="만" sub="체험 + 서비스 결제" onClick={() => onSelectMetric('gmv')} />
          <SimpleKpi label="플랫폼 순수익" value={`₩${stats.netRevenue.toLocaleString()}`} unit="" className="text-blue-600" sub="플랫폼 전체 기준" onClick={() => onSelectMetric('revenue')} />
          <SimpleKpi label="객단가 (AOV)" value={`₩${stats.aov.toLocaleString()}`} sub="전체 결제 건 기준" onClick={() => onSelectMetric('aov')} />
          <SimpleKpi label="취소율" value={`${stats.cancellationRate}%`} sub="체험 예약 기준" onClick={() => onSelectMetric('cancel')} />
          <SimpleKpi label="가입 대비 결제건 비율" value={`${stats.conversionRate}%`} sub="신규 가입자 대비" onClick={() => onSelectMetric('conversion')} />
          <SimpleKpi label="반복 결제 고객 비율" value={`${stats.retentionRate}%`} sub="체험 + 서비스 결제 고객" onClick={() => onSelectMetric('retention')} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">가입 대비 결제건 비율</div>
            <div className="mt-1">선택 기간 내 신규 가입자 수 대비 결제 완료 건수 비율입니다.</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">반복 결제 고객 비율</div>
            <div className="mt-1">체험과 서비스를 합친 전체 결제 고객 중 2회 이상 결제한 고객 비율입니다.</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">객단가 (AOV)</div>
            <div className="mt-1">선택 기간 총 거래액을 전체 결제 건수로 나눈 평균 결제 금액입니다.</div>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-slate-100 my-6 md:my-8"></div>

      {/* 인구통계 */}
      <section>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            🌍 결제 고객 인구통계 <span className="text-[10px] md:text-xs font-normal text-slate-400">체험 + 서비스 결제 고객 기준</span>
          </h2>
          <div onClick={() => onSelectMetric('demographics')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            상세보기
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* 국적 */}
          <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>🌍 게스트 국적 비중</span> <span className="text-[10px] md:text-xs font-normal text-slate-400 sm:ml-auto">체험 + 서비스 결제 고객 기준</span>
            </h3>
            <div className="space-y-4">
              {stats.demographics.nationalities.length > 0 ? stats.demographics.nationalities.map((nat) => (
                <div key={nat.name} className="flex items-center gap-4">
                  <div className="w-8 text-sm font-bold text-slate-600">{nat.name}</div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden flex">
                    <div className="h-full bg-blue-500 rounded-lg transition-all duration-1000" style={{ width: `${nat.percent}%` }}></div>
                  </div>
                  <div className="w-16 text-right text-sm font-mono text-slate-500">{nat.percent.toFixed(1)}%</div>
                </div>
              )) : (
                <div className="py-8 text-center text-slate-400 text-sm">데이터가 부족합니다.</div>
              )}
            </div>
          </div>

          {/* 연령대 */}
          <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>👤 게스트 주요 연령대</span> <span className="text-[10px] md:text-xs font-normal text-slate-400 sm:ml-auto">체험 + 서비스 결제 고객 기준</span>
            </h3>
            <div className="flex items-end justify-around h-32 md:h-40 mt-4 pb-2 border-b border-slate-100 relative">
              <div className="absolute top-0 w-full border-t border-slate-50 border-dashed"></div>
              <div className="absolute top-1/2 w-full border-t border-slate-50 border-dashed"></div>
              {stats.demographics.ages.map((age) => (
                <div key={age.name} className="flex flex-col items-center gap-1 md:gap-2 group w-1/5">
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {age.percent.toFixed(1)}%
                  </span>
                  <div className="w-full bg-slate-100 rounded-t-sm md:rounded-t-lg relative flex items-end justify-center h-20 md:h-28">
                    <div
                      className="w-full bg-rose-400 rounded-t-sm md:rounded-t-lg transition-all duration-1000 hover:bg-rose-500 shadow-inner"
                      style={{ height: `${age.percent}%`, minHeight: age.percent > 0 ? '4px' : '0' }}
                    ></div>
                  </div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-600 truncate w-full text-center">{age.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 성별 */}
          <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>🚻 게스트 성별 비율</span> <span className="text-[10px] md:text-xs font-normal text-slate-400 sm:ml-auto">전체 결제 기준</span>
            </h3>
            <div className="flex-1 flex flex-col justify-center space-y-5">
              {stats.demographics.genders.length > 0 ? stats.demographics.genders.map((gen) => (
                <div key={gen.name} className="flex items-center gap-4">
                  <div className="w-10 text-sm font-bold text-slate-600">{gen.name}</div>
                  <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden flex relative shadow-inner">
                    <div
                      className={`h-full opacity-90 rounded-full transition-all duration-1000 ${gen.name === '남성' ? 'bg-blue-400' : gen.name === '여성' ? 'bg-rose-400' : 'bg-green-400'}`}
                      style={{ width: `${gen.percent}%` }}
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-end pr-4 text-xs font-bold text-slate-700/80 drop-shadow-sm">
                      {gen.percent.toFixed(1)}% ({gen.count}명)
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-center text-slate-400 text-sm">데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <AnalyticsCustomerCompositionSection
        customerComposition={customerComposition}
        customerCompositionSource={customerCompositionSource}
      />

      <AnalyticsSearchDemandSection
        searchIntent={searchIntent}
        searchIntentSource={searchIntentSource}
        searchTrends={searchTrends}
        onSelectMetric={onSelectMetric}
      />

      {/* 시계열 및 퍼널 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6">
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>📈 구간별 매출 트렌드</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">최근 발생일자 기준 (최대 7일)</span>
            </h3>
            <Activity size={16} className="text-blue-500 md:w-[18px] md:h-[18px] shrink-0" />
          </div>
          <div className="flex items-end justify-between h-36 md:h-48 w-full relative px-1 md:px-2">
            <div className="absolute top-0 left-0 w-full border-t border-slate-100 border-dashed"></div>
            <div className="absolute top-1/2 left-0 w-full border-t border-slate-100 border-dashed"></div>
            <div className="absolute bottom-0 left-0 w-full border-t border-slate-100"></div>
            {stats.timeSeries.length > 0 ? stats.timeSeries.map((ts, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 md:gap-2 group w-8 md:w-12 z-10">
                <span className="text-[9px] md:text-[10px] font-bold text-slate-500 bg-white px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 md:-top-6 whitespace-nowrap">
                  ₩{(ts.amount / 10000).toFixed(0)}만
                </span>
                <div className="w-full h-28 md:h-40 flex items-end justify-center pb-0">
                  <div
                    className="w-6 md:w-10 bg-slate-800 rounded-t-sm md:rounded-t-md transition-all duration-1000 hover:bg-blue-600 shadow-sm"
                    style={{ height: `${Math.max(ts.height, 5)}%` }}
                  ></div>
                </div>
                <span className="text-[9px] md:text-xs font-medium text-slate-500 mt-1 md:mt-2">{ts.dateStr}</span>
              </div>
            )) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs md:text-sm">
                선택된 구간에 매출 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>🎯 예약 퍼널 분석</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">유입 대비 결제 전환률</span>
            </h3>
            <Activity size={16} className="text-slate-400 md:w-[18px] md:h-[18px]" />
          </div>
          <div className="space-y-4 md:space-y-5 mt-2 md:mt-4">
            <FunnelBar label="상품 노출" value={stats.funnel.views} max={stats.funnel.views} color="bg-slate-200" />
            <FunnelBar label="예약 클릭" value={stats.funnel.clicks} max={stats.funnel.views} color="bg-slate-300" />
            <FunnelBar label="결제 시도" value={stats.funnel.paymentInit} max={stats.funnel.views} color="bg-slate-400" />
            <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal color="bg-rose-500" />
          </div>
        </div>
      </div>

      {/* 매출 견인 Top 5 체험 */}
      <section className="pt-4 md:pt-6">
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>🏆 매출 견인 Top 5 인기 체험</span> <span className="text-[10px] md:text-xs font-normal text-slate-400">체험 예약 결제 완료 건수 기준</span>
            </h3>
            <div onClick={() => onSelectMetric('topExps')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors shrink-0">
              상세보기
            </div>
          </div>
          <div className="space-y-3 md:space-y-4">
            {stats.topExperiences.length > 0 ? stats.topExperiences.map((exp, idx) => (
              <div key={exp.id} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200 text-sm md:text-base shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-bold text-slate-900 truncate">{exp.title}</div>
                  <div className="text-[10px] md:text-xs font-medium text-slate-500 flex gap-2">
                    <span>예약 {exp.bookingCount}건</span>
                    <span>매출 ₩{(exp.totalRevenue / 10000).toFixed(0)}만</span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end shrink-0">
                  <div className="text-[9px] md:text-xs font-bold text-slate-700 bg-slate-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg whitespace-nowrap">
                    ★ {exp.rating} ({exp.reviewCount})
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-6 md:py-8 text-slate-400 text-xs md:text-sm">기간 내 체험 예약 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
