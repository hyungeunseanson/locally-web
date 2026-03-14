'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
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
import AnalyticsMetricModal from './analytics/AnalyticsMetricModal';
import { useAnalyticsSummaryData } from '../hooks/useAnalyticsSummaryData';
import type {
  AnalyticsApplicationInput,
  AnalyticsBookingInput,
  AnalyticsEventInput,
  AnalyticsExperienceInput,
  AnalyticsInquiryInput,
  AnalyticsInquiryMessageInput,
  AnalyticsMetricKey,
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
  const [selectedMetric, setSelectedMetric] = useState<AnalyticsMetricKey | null>(null);
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

      <AnalyticsMetricModal
        selectedMetric={selectedMetric}
        stats={stats}
        onClose={() => setSelectedMetric(null)}
      />
    </div>
  );
}
