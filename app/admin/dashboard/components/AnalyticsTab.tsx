'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Star, X, TrendingUp, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import Skeleton from '@/app/components/ui/Skeleton';
import dynamic from 'next/dynamic';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Range, type RangeKeyDict } from 'react-date-range';
import { format, subDays } from 'date-fns';
import ReviewsTab from './ReviewsTab';
import AuditLogTab from './AuditLogTab';
import AnalyticsBusinessSection from './analytics/AnalyticsBusinessSection';
import AnalyticsHostSection from './analytics/AnalyticsHostSection';
import { FunnelBar, SimpleBar } from './analytics/helpers';
import { useAnalyticsSummaryData } from '../hooks/useAnalyticsSummaryData';
import type {
  AnalyticsApplicationInput,
  AnalyticsBookingInput,
  AnalyticsEventInput,
  AnalyticsExperienceInput,
  AnalyticsInquiryInput,
  AnalyticsInquiryMessageInput,
  AnalyticsReviewInput,
  AnalyticsSearchLogInput,
  AnalyticsUserInput,
} from './analytics/types';

const DateRange = dynamic(() => import('react-date-range').then(mod => mod.DateRange), { ssr: false });

interface AnalyticsTabProps {
  bookings?: AnalyticsBookingInput[];
  users?: AnalyticsUserInput[];
  exps?: AnalyticsExperienceInput[];
  apps?: AnalyticsApplicationInput[];
  reviews?: AnalyticsReviewInput[];
  searchLogs?: AnalyticsSearchLogInput[];
  analyticsEvents?: AnalyticsEventInput[];
  inquiries?: AnalyticsInquiryInput[];
  inquiryMessages?: AnalyticsInquiryMessageInput[];
}

const EMPTY_ANALYTICS_ITEMS: never[] = [];
type AnalyticsMainTab = 'business' | 'host' | 'reviews' | 'logs';

const ANALYTICS_MAIN_TABS: Array<{ id: AnalyticsMainTab; label: string }> = [
  { id: 'business', label: 'Business & Guest' },
  { id: 'host', label: 'Host Ecosystem' },
  { id: 'reviews', label: 'Review Quality' },
  { id: 'logs', label: '운영 감사 로그' },
];

export default function AnalyticsTab(props: AnalyticsTabProps = {}) {
  const bookings = props.bookings ?? EMPTY_ANALYTICS_ITEMS;
  const users = props.users ?? EMPTY_ANALYTICS_ITEMS;
  const exps = props.exps ?? EMPTY_ANALYTICS_ITEMS;
  const apps = props.apps ?? EMPTY_ANALYTICS_ITEMS;
  const reviews = props.reviews ?? EMPTY_ANALYTICS_ITEMS;
  const searchLogs = props.searchLogs ?? EMPTY_ANALYTICS_ITEMS;
  const analyticsEvents = props.analyticsEvents ?? EMPTY_ANALYTICS_ITEMS;
  const inquiries = props.inquiries ?? EMPTY_ANALYTICS_ITEMS;
  const inquiryMessages = props.inquiryMessages ?? EMPTY_ANALYTICS_ITEMS;
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<AnalyticsMainTab>('business');

  // 날짜 필터 상태 추가
  const [dateRange, setDateRange] = useState<Range[]>([{
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    key: 'selection'
  }]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('30D');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 달력 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetClick = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === '1D') setDateRange([{ startDate: subDays(now, 1), endDate: now, key: 'selection' }]);
    else if (preset === '7D') setDateRange([{ startDate: subDays(now, 7), endDate: now, key: 'selection' }]);
    else if (preset === '30D') setDateRange([{ startDate: subDays(now, 30), endDate: now, key: 'selection' }]);
    else if (preset === '3M') setDateRange([{ startDate: subDays(now, 90), endDate: now, key: 'selection' }]);
    else if (preset === '1Y') setDateRange([{ startDate: subDays(now, 365), endDate: now, key: 'selection' }]);
    else if (preset === 'ALL') setDateRange([{ startDate: new Date('2020-01-01'), endDate: now, key: 'selection' }]);
  };

  const {
    loading,
    stats,
    summarySource,
    searchIntent,
    searchIntentSource,
    customerComposition,
    customerCompositionSource,
  } = useAnalyticsSummaryData({
    bookings,
    users,
    exps,
    apps,
    reviews,
    searchLogs,
    analyticsEvents,
    inquiries,
    inquiryMessages,
    dateRange,
  });

  if (loading) return <div className="p-8"><Skeleton className="w-full h-96 rounded-xl" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* 헤더 & 필터 구간 추가 */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 md:mb-6 gap-3 md:gap-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-rose-500 w-5 h-5 md:w-6 md:h-6" />
          <h2 className="text-xl md:text-2xl font-black text-slate-900">데이터 심층 분석</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 relative">
          <div className="bg-slate-100 p-1 rounded-lg flex text-[10px] md:text-xs font-bold overflow-x-auto scrollbar-hide shrink-0">
            {['1D', '7D', '30D', '3M', '1Y', 'ALL'].map(f => (
              <button
                key={f} onClick={() => handlePresetClick(f)}
                className={`flex-1 md:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-all whitespace-nowrap ${activePreset === f ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-auto" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center justify-center gap-2 w-full px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-50 transition-colors shrink-0"
            >
              <CalendarIcon size={14} className="text-slate-400 md:w-4 md:h-4" />
              <span className="text-slate-700 md:min-w-[170px] text-center">
                {dateRange[0].startDate && dateRange[0].endDate
                  ? `${format(dateRange[0].startDate, 'yyyy.MM.dd')} ~ ${format(dateRange[0].endDate, 'yyyy.MM.dd')}`
                  : '기간 선택'}
              </span>
              <ChevronDown size={14} className="text-slate-400 ml-1 md:w-4 md:h-4" />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <span className="text-xs font-bold text-slate-500 uppercase px-2">Custom Range</span>
                  <button onClick={() => setShowDatePicker(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2 font-medium">Close</button>
                </div>
                <DateRange
                  editableDateInputs={true}
                  onChange={(item: RangeKeyDict) => {
                    if (!item.selection) return;
                    setDateRange([item.selection]);
                    setActivePreset('CUSTOM');
                  }}
                  moveRangeOnFirstSelection={false}
                  ranges={dateRange}
                  months={1}
                  direction="horizontal"
                  className="!border-0 text-xs md:text-sm"
                  rangeColors={['#0f172a']}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟢 수정: 메인 탭 전환 (Business / Host / Reviews / Logs) */}
      <div className="flex flex-nowrap md:flex-wrap bg-slate-100 p-1 rounded-xl w-full md:w-fit mb-6 md:mb-8 overflow-x-auto scrollbar-hide gap-1">
        {ANALYTICS_MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveMainTab(tab.id)}
            className={`flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeMainTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
          >
            <span>{tab.label}</span>
            {tab.id === 'business' && summarySource.business !== 'server' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                임시
              </span>
            )}
            {tab.id === 'host' && summarySource.host !== 'server' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                임시
              </span>
            )}
          </button>
        ))}
      </div>

      {activeMainTab === 'business' && (
        <AnalyticsBusinessSection
          stats={stats}
          summarySource={summarySource.business}
          onSelectMetric={setSelectedMetric}
          searchIntent={searchIntent}
          searchIntentSource={searchIntentSource}
          searchTrends={stats.searchTrends}
          customerComposition={customerComposition}
          customerCompositionSource={customerCompositionSource}
        />
      )}

      {activeMainTab === 'host' && (
        <AnalyticsHostSection
          stats={stats}
          summarySource={summarySource.host}
          onSelectMetric={setSelectedMetric}
        />
      )}

      {activeMainTab === 'reviews' && (
        <div className="animate-in slide-in-from-bottom-[50px] duration-500">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">Review Quality는 리뷰 품질과 이상 징후를 보는 운영 구간입니다.</div>
            <div className="mt-1">리뷰 삭제, 미응답 상태, 후기 내용 확인처럼 품질 관리에 필요한 작업만 집중해서 봅니다.</div>
          </div>
          <ReviewsTab />
        </div>
      )}

      {activeMainTab === 'logs' && (
        <div className="animate-in slide-in-from-bottom-[50px] duration-500">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">운영 감사 로그는 관리자 작업 추적용 구간입니다.</div>
            <div className="mt-1">누가 어떤 운영 액션을 언제 수행했는지 확인하는 감사 이력만 보여주며, 일반 분석 숫자와는 분리해서 읽어야 합니다.</div>
          </div>
          <AuditLogTab />
        </div>
      )}

      {/* 🟢 복구: 상세 모달 (Drill-down) */}
      {
        selectedMetric && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedMetric(null)}>
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl p-8 relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedMetric(null)} className="absolute top-6 right-6 text-gray-400 hover:text-black"><X size={20} /></button>

              {selectedMetric === 'aov' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">가격대별 결제 비중</h3>
                  <div className="space-y-4">
                    <SimpleBar label="Low (<3만)" val={stats.priceDistribution.low} max={stats.funnel.completed} />
                    <SimpleBar label="Mid (3~10만)" val={stats.priceDistribution.mid} max={stats.funnel.completed} />
                    <SimpleBar label="High (>10만)" val={stats.priceDistribution.high} max={stats.funnel.completed} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">체험 예약과 서비스 결제를 합친 전체 결제 건 기준 가격대 비중입니다.</p>
                </div>
              )}

              {selectedMetric === 'users' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">최근 가입 유저 (기간 내)</h3>
                  <div className="space-y-3">
                    {stats.newUsersList.length > 0 ? stats.newUsersList.map((u, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{u.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">
                              {u.created_at ? `${format(new Date(u.created_at), 'yyyy-MM-dd')} 가입` : '가입일 미확인'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded">
                          {u.nationality || 'KR'}
                        </span>
                      </div>
                    )) : (
                      <div className="text-center py-4 text-slate-400 text-sm">기간 내 신규 유저가 없습니다.</div>
                    )}
                  </div>
                </div>
              )}

              {selectedMetric === 'gmv' && (
                <div className="space-y-6 text-center">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">🔥 최고 매출 기록일</h3>
                  <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                    <div className="text-4xl font-black text-rose-500 tracking-tighter mb-2">₩{stats.topRevenueDate.amount.toLocaleString()}</div>
                    <div className="text-sm font-bold text-slate-600">발생일자: {stats.topRevenueDate.dateStr}</div>
                    <p className="text-xs text-slate-500 mt-2">선택하신 기간 내 체험 예약과 서비스 결제를 합친 하루 기준 최고 거래액입니다.</p>
                  </div>
                </div>
              )}

              {selectedMetric === 'cancel' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">체험 예약 취소 사유 분석</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 rounded-xl text-center">
                      <div className="text-sm text-red-500 font-bold mb-1">유저 취소</div>
                      <div className="text-2xl font-black text-slate-900">{stats.cancelBreakdown.user}건</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl text-center">
                      <div className="text-sm text-orange-500 font-bold mb-1">호스트 거절</div>
                      <div className="text-2xl font-black text-slate-900">{stats.cancelBreakdown.host}건</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">이 구간은 서비스 의뢰가 아닌 체험 예약 취소 기준입니다. 호스트 거절이 많다면 달력 관리를 독려해야 합니다.</p>
                </div>
              )}

              {selectedMetric === 'response' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    🏆 응답시간 상위 10명 <span className="text-xs font-normal text-emerald-500">최단 시간 기준</span>
                  </h3>
                  <div className="space-y-3 mb-6">
                    {stats.topRespHosts.length > 0 ? stats.topRespHosts.map((h, idx) => (
                      <div key={h.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                          <div className="text-sm font-bold text-slate-800">{h.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-600">{h.timeMins}분</div>
                          <div className="text-[10px] text-slate-400">응답률 {h.rate.toFixed(0)}%</div>
                        </div>
                      </div>
                    )) : <div className="text-sm text-slate-400">데이터 없음</div>}
                  </div>

                  <h3 className="text-xl font-bold flex items-center gap-2 pt-4 border-t border-slate-100">
                    🐢 응답시간 하위 10명 <span className="text-xs font-normal text-rose-500">최장 시간 기준</span>
                  </h3>
                  <div className="space-y-3">
                    {stats.bottomRespHosts.length > 0 ? stats.bottomRespHosts.map((h, idx) => (
                      <div key={h.id} className="flex justify-between items-center bg-rose-50/30 p-3 rounded-lg border border-rose-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                          <div className="text-sm font-bold text-slate-800">{h.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-rose-600">{h.timeMins}분</div>
                          <div className="text-[10px] text-slate-400">응답률 {h.rate.toFixed(0)}%</div>
                        </div>
                      </div>
                    )) : <div className="text-sm text-slate-400">데이터 없음</div>}
                  </div>
                </div>
              )}

              {selectedMetric === 'exps' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">활성 체험 현황</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl text-center">
                      <div className="text-sm text-emerald-600 font-bold mb-1">운영 중 (Active)</div>
                      <div className="text-2xl font-black text-slate-900">{stats.expsBreakdown.active}개</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl text-center">
                      <div className="text-sm text-blue-500 font-bold mb-1">기간 내 신규 등록</div>
                      <div className="text-2xl font-black text-slate-900">{stats.expsBreakdown.new}개</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4 opacity-70">
                    <div className="text-xs text-slate-500 font-medium">검수 대기: {stats.expsBreakdown.pending}개</div>
                    <div className="text-xs text-slate-500 font-medium">반려: {stats.expsBreakdown.rejected}개</div>
                  </div>
                </div>
              )}

              {selectedMetric === 'demographics' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">결제 고객 인구통계 상세</h3>
                  <p className="text-xs text-slate-400 -mt-3">체험 예약과 서비스 결제를 합친 플랫폼 전체 결제 고객 기준</p>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">국적 분포 (전체)</h4>
                    <div className="space-y-3">
                      {stats.demographics.allNationalities.map((nat, i) => (
                        <div key={`nat-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-16 text-sm font-bold text-slate-700">{nat.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nat.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{nat.count}명 ({nat.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">연령대 분포</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {stats.demographics.ages.map((age, i) => (
                        <div key={`age-${i}`} className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                          <span className="text-sm font-bold text-slate-700">{age.name}</span>
                          <span className="text-xs font-mono text-slate-500">{age.count}명 ({age.percent.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">성별 분포</h4>
                    <div className="flex gap-4">
                      {stats.demographics.genders.map((gen, i) => (
                        <div key={`gen-${i}`} className="flex-1 bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                          <div className="text-sm font-bold text-slate-700 mb-1">{gen.name}</div>
                          <div className="text-xs font-mono text-slate-500">{gen.count}명 ({gen.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedMetric === 'searchTrends' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">체험 검색어 전체 순위</h3>
                  <p className="text-xs text-slate-400 -mt-3">체험 검색 로그 기준</p>
                  <div className="space-y-2">
                    {stats.allSearchTrends.length > 0 ? stats.allSearchTrends.map((trend, i) => (
                      <div key={`trend-${i}`} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-xs font-black">{i + 1}</div>
                          <div className="text-sm font-bold text-slate-800">{trend.keyword}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-700">{trend.count}회</div>
                          <div className="text-[10px] text-slate-400">검색 비중 {trend.percent.toFixed(1)}%</div>
                        </div>
                      </div>
                    )) : <div className="text-center py-8 text-slate-400 text-sm">검색 데이터가 없습니다.</div>}
                  </div>
                </div>
              )}

              {selectedMetric === 'topExps' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">전체 체험 판매 랭킹</h3>
                  <p className="text-xs text-slate-400 -mt-3">체험 예약 결제 완료 건수 기준</p>
                  <div className="space-y-3">
                    {stats.allExperiences.length > 0 ? stats.allExperiences.map((exp, i) => (
                      <div key={exp.id ?? `experience-${i}`} className="flex gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors">
                        <div className="w-8 flex flex-col items-center justify-center">
                          <span className={`text-lg font-black ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>{i + 1}</span>
                        </div>
                          <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                          {exp.image_url ? (
                            <img src={exp.image_url ?? undefined} alt={exp.title || 'Experience image'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300"><Star size={20} /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="text-sm font-bold text-slate-900 truncate">{exp.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span className="flex items-center gap-0.5 text-amber-500 font-medium"><Star size={12} fill="currentColor" /> {exp.rating}</span>
                            <span>결제 {exp.bookingCount}건</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-center">
                          <div className="text-sm font-black text-slate-800 group-hover:text-amber-600 transition-colors">₩{exp.totalRevenue.toLocaleString()}</div>
                        </div>
                      </div>
                    )) : <div className="text-center py-8 text-slate-400 text-sm">판매된 체험이 없습니다.</div>}
                  </div>
                </div>
              )}

              {selectedMetric === 'hostDemographics' && (
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                  <h3 className="text-xl font-bold">호스트 생태계 전체 통계</h3>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">주요 유입 경로</h4>
                    <div className="space-y-3">
                      {stats.hostEcosystem.allSources.map((src, i) => (
                        <div key={`src-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-24 text-sm font-bold text-slate-700 truncate">{src.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${src.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{src.count}명 ({src.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">호스트 국적 비율</h4>
                    <div className="space-y-3">
                      {stats.hostEcosystem.allNationalities.map((nat, i) => (
                        <div key={`hnat-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-20 text-sm font-bold text-slate-700">{nat.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nat.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{nat.count}명 ({nat.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-bold text-slate-500 border-b pb-2">보유 언어 비율</h4>
                    <div className="space-y-3">
                      {stats.hostEcosystem.allLanguages.map((lang, i) => (
                        <div key={`hlang-${i}`} className="flex items-center gap-3">
                          <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                          <div className="w-20 text-sm font-bold text-slate-700">{lang.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${lang.percent}%` }}></div>
                          </div>
                          <div className="w-16 text-right text-xs font-mono text-slate-500">{lang.count}명 ({lang.percent.toFixed(1)}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedMetric === 'revenue' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">플랫폼 순수익 구조</h3>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-bold text-slate-500">총 거래액 (GMV)</span>
                      <span className="text-lg font-black text-slate-800">₩{stats.gmv.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-8 bg-slate-200 rounded-full flex overflow-hidden">
                      <div className="h-full bg-blue-500 flex items-center px-3" style={{ width: `${stats.gmv ? (stats.netRevenue / stats.gmv) * 100 : 0}%` }}>
                        <span className="text-[10px] text-white font-bold opacity-0 md:opacity-100">플랫폼 수익</span>
                      </div>
                      <div className="h-full bg-slate-400 flex items-center justify-end px-3 flex-1">
                        <span className="text-[10px] text-white font-bold opacity-0 md:opacity-100">호스트 정산</span>
                      </div>
                    </div>
                    <div className="flex justify-between mt-4">
                      <div>
                        <div className="text-xs font-bold text-blue-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 플랫폼 순수익</div>
                        <div className="text-sm font-black text-slate-700 mt-1">₩{stats.netRevenue.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 flex items-center gap-1 justify-end"><span className="w-2 h-2 rounded-full bg-slate-400"></span> 호스트 정산금</div>
                        <div className="text-sm font-black text-slate-700 mt-1">₩{stats.hostPayout.toLocaleString()}</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 text-center">체험 예약과 서비스 결제를 합친 플랫폼 전체 수익 구조입니다.</p>
                  </div>
                </div>
              )}

              {selectedMetric === 'conversion' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">가입 대비 결제건 비율</h3>
                  <div className="space-y-4">
                    <FunnelBar label="상품 노출" value={stats.funnel.views} max={stats.funnel.views} color="bg-slate-200" />
                    <FunnelBar label="상세 클릭" value={stats.funnel.clicks} max={stats.funnel.views} color="bg-slate-300" />
                    <FunnelBar label="결제 시도" value={stats.funnel.paymentInit} max={stats.funnel.views} color="bg-slate-400" />
                    <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal color="bg-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-400 mt-4 text-center">기간 내 신규 가입자 수 대비 결제 완료 건수 비율은 <strong className="text-emerald-500">{stats.conversionRate}%</strong> 입니다. 동일 고객의 중복 결제 건도 포함됩니다.</p>
                </div>
              )}

              {selectedMetric === 'retention' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">기간 내 반복 결제 고객 비율</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                      <div className="text-[10px] text-slate-500 font-bold mb-1">1회 결제</div>
                      <div className="text-xl font-black text-slate-700">{stats.retentionBreakdown.once}명</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-100">
                      <div className="text-[10px] text-blue-500 font-bold mb-1">2회 재구매</div>
                      <div className="text-xl font-black text-blue-700">{stats.retentionBreakdown.twice}명</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                      <div className="text-[10px] text-emerald-600 font-bold mb-1">3회 이상 (단골)</div>
                      <div className="text-xl font-black text-emerald-700">{stats.retentionBreakdown.threeOrMore}명</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">해당 기간 내 체험 예약과 서비스 결제를 합친 전체 결제 고객 중 2회 이상 결제한 고객 비율은 {stats.retentionRate}% 입니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
