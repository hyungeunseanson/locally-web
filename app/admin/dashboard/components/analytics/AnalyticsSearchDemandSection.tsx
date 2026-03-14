'use client';

import { AlertTriangle, Search } from 'lucide-react';

import type {
  AnalyticsSearchIntentSummary,
  SearchIntentSource,
  SearchTrendItem,
} from './types';

export default function AnalyticsSearchDemandSection({
  searchIntent,
  searchIntentSource,
  searchTrends,
  onSelectMetric,
}: {
  searchIntent: AnalyticsSearchIntentSummary | null;
  searchIntentSource: SearchIntentSource;
  searchTrends: SearchTrendItem[];
  onSelectMetric: (metric: string) => void;
}) {
  return (
    <>
      <div className="mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
        <div>
          <div className="font-semibold">아래 구간은 체험 예약 전용 분석입니다.</div>
          <div className="text-xs text-rose-700">취소율, 체험 검색 트렌드, 매출 견인 Top 체험, 예약 퍼널은 서비스 의뢰가 아닌 체험 예약 흐름만 기준으로 표시합니다.</div>
        </div>
      </div>

      <section className="pt-4 md:pt-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
            <Search size={16} className="md:w-[18px] md:h-[18px]" /> 체험 검색 인기 트렌드
          </h2>
          <div onClick={() => onSelectMetric('searchTrends')} className="text-[10px] md:text-xs font-bold text-blue-500 bg-blue-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            상세보기
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {searchTrends.length > 0 ? searchTrends.map((trend, i) => (
            <button
              key={trend.keyword}
              onClick={() => onSelectMetric('searchTrends')}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-gray-200 rounded-full text-xs md:text-sm font-medium text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-200 shadow-sm active:scale-95 flex items-center gap-1 md:gap-2"
            >
              <span className="text-rose-500 font-bold">{i + 1}.</span> {trend.keyword}
              <span className="text-[9px] md:text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">{trend.count}건</span>
            </button>
          )) : (
            <span className="text-sm text-slate-400">데이터를 수집 중입니다.</span>
          )}
        </div>
      </section>

      <section className="pt-4 md:pt-6">
        <div className="flex flex-col gap-3 mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <Search size={16} className="md:w-[18px] md:h-[18px] text-slate-700" />
            <h2 className="text-base md:text-lg font-bold">고객 검색 수요 분석</h2>
            {searchIntentSource === 'cached' && (
              <span className="text-[10px] md:text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                최근 집계 재사용
              </span>
            )}
            {searchIntentSource === 'unavailable' && (
              <span className="text-[10px] md:text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                일시 불가
              </span>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs md:text-sm text-slate-600">
            <div className="font-semibold text-slate-800">고객이 찾는 수요와 현재 공급 부족 신호를 함께 봅니다.</div>
            <div className="mt-1">검색 로그 기준이며, 공급 부족은 현재 활성 체험의 제목/도시/설명/카테고리 기준 참고용입니다.</div>
            {searchIntent?.conversionAvailable ? (
              <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                검색 후 클릭/결제 시작은 동일 세션 안에서 다음 검색 전까지 발생한 이벤트를 참고용으로 연결합니다.
                {searchIntent.conversionCoverage ? ` (추적 검색 ${searchIntent.conversionCoverage.trackedSearches}건)` : ''}
              </div>
            ) : (
              <div className="mt-1 text-[11px] md:text-xs text-slate-500">세션 연결 데이터가 충분히 쌓이면 검색→클릭/결제 시작 전환도 함께 표시합니다.</div>
            )}
            <div className="mt-1 text-[11px] md:text-xs text-slate-500">
              유입 source가 같이 남은 세션은 source별 대표 검색 수요도 참고용으로 함께 보여줍니다.
              {searchIntent?.sourceDemandAvailable && searchIntent?.sourceTrackedSearches
                ? ` (source 연결 검색 ${searchIntent.sourceTrackedSearches}건)`
                : ''}
            </div>
          </div>
        </div>

        {searchIntent ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">많이 찾는 키워드</h3>
                  <span className="text-[10px] md:text-xs text-slate-400">총 {searchIntent.totalSearches}회</span>
                </div>
                <div className="space-y-2">
                  {searchIntent.topKeywords.length > 0 ? searchIntent.topKeywords.slice(0, 5).map((item, index) => (
                    <div key={`search-demand-top-${item.keyword}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-rose-500">{index + 1}</span>
                        <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">{item.searches}회</span>
                    </div>
                  )) : (
                    <div className="py-6 text-center text-sm text-slate-400">검색 데이터가 부족합니다.</div>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm md:text-base font-bold text-slate-800">급상승 키워드</h3>
                    {searchIntent.windowClamped && (
                      <span className="text-[9px] md:text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">비교 기간 자동 조정</span>
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs text-slate-400">최근 {searchIntent.comparisonWindowDays}일 비교</span>
                </div>
                <div className="space-y-2">
                  {searchIntent.risingKeywords.length > 0 ? searchIntent.risingKeywords.map((item) => (
                    <div key={`search-demand-rising-${item.keyword}`} className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                        <span className="text-xs font-black text-emerald-700">+{item.surge}</span>
                      </div>
                      <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                        최근 {item.recentSearches}회 · 이전 {item.previousSearches}회
                      </div>
                    </div>
                  )) : (
                    <div className="py-6 text-center text-sm text-slate-400">최근 급상승 키워드가 없습니다.</div>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">공급 부족 키워드</h3>
                  <span className="text-[10px] md:text-xs text-slate-400">현재 활성 체험 기준</span>
                </div>
                <div className="space-y-2">
                  {searchIntent.lowSupplyKeywords.length > 0 ? searchIntent.lowSupplyKeywords.map((item) => (
                    <div key={`search-demand-low-supply-${item.keyword}`} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                        <span className="text-xs font-mono text-amber-700">{item.searches}회</span>
                      </div>
                      <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                        연결 가능한 활성 체험 {item.matchedActiveExperiences}개
                      </div>
                    </div>
                  )) : (
                    <div className="py-6 text-center text-sm text-slate-400">공급 부족 신호가 강한 키워드가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">클릭 전환 키워드</h3>
                  <span className="text-[10px] md:text-xs text-slate-400">동일 세션 기준 참고용</span>
                </div>
                <div className="space-y-2">
                  {searchIntent.conversionAvailable && searchIntent.clickConversionKeywords.length > 0 ? searchIntent.clickConversionKeywords.map((item) => (
                    <div key={`search-demand-click-${item.keyword}`} className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                        <span className="text-xs font-black text-sky-700">{item.clickConversionRate}%</span>
                      </div>
                      <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                        추적 검색 {item.trackedSearches}건 · 클릭 연결 {item.clickConvertedSearches}건
                      </div>
                    </div>
                  )) : (
                    <div className="py-6 text-center text-sm text-slate-400">
                      {searchIntent.conversionAvailable ? '클릭 전환 참고 데이터가 부족합니다.' : '세션 연결 데이터 수집 중입니다.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">결제 시작 전환 키워드</h3>
                  <span className="text-[10px] md:text-xs text-slate-400">동일 세션 기준 참고용</span>
                </div>
                <div className="space-y-2">
                  {searchIntent.conversionAvailable && searchIntent.paymentInitConversionKeywords.length > 0 ? searchIntent.paymentInitConversionKeywords.map((item) => (
                    <div key={`search-demand-payment-init-${item.keyword}`} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.keyword}</span>
                        <span className="text-xs font-black text-violet-700">{item.paymentInitConversionRate}%</span>
                      </div>
                      <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                        추적 검색 {item.trackedSearches}건 · 결제 시작 연결 {item.paymentInitConvertedSearches}건
                      </div>
                    </div>
                  )) : (
                    <div className="py-6 text-center text-sm text-slate-400">
                      {searchIntent.conversionAvailable ? '결제 시작 전환 참고 데이터가 부족합니다.' : '세션 연결 데이터 수집 중입니다.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm md:text-base font-bold text-slate-800">유입별 주요 검색 수요</h3>
                <span className="text-[10px] md:text-xs text-slate-400">source + 세션 기준 참고용</span>
              </div>
              <div className="space-y-2">
                {searchIntent.sourceDemandAvailable && searchIntent.sourceDemand.length > 0 ? (
                  searchIntent.sourceDemand.map((item) => (
                    <div key={`search-demand-source-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-800">{item.name}</span>
                        <span className="text-xs font-mono text-slate-500">{item.searches}회</span>
                      </div>
                      <div className="mt-1 text-[11px] md:text-xs text-slate-500">
                        검색어 {item.uniqueKeywords}개 · 대표 수요 {item.topKeyword ? `${item.topKeyword} (${item.topKeywordSearches}회)` : '집계 중'}
                      </div>
                      {item.lowSupplyKeyword && (
                        <div className="mt-1 text-[11px] md:text-xs text-amber-700">
                          공급 부족 신호: {item.lowSupplyKeyword} ({item.lowSupplySearches}회)
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-sm text-slate-400">
                    source와 연결된 검색 세션이 더 쌓이면 여기서 볼 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            검색 수요 분석 데이터를 불러오지 못했습니다.
          </div>
        )}
      </section>
    </>
  );
}
