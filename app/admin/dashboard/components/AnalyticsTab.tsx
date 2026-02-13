'use client';

import React, { useEffect, useState } from 'react';
import { Search, Activity, Star, X } from 'lucide-react';
import Skeleton from '@/app/components/ui/Skeleton';
import { useToast } from '@/app/context/ToastContext';

// 🟢 [핵심] 부모로부터 받을 데이터 타입 정의
interface AnalyticsTabProps {
  bookings: any[];
  users: any[];
  exps: any[];
  apps: any[];
  reviews: any[];
}

// 🟢 [핵심] Props를 받도록 함수 시그니처 변경
export default function AnalyticsTab({ bookings, users, exps, apps, reviews }: AnalyticsTabProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const [stats, setStats] = useState({
    // KPI
    totalUsers: 0,
    activeExpsCount: 0,
    gmv: 0,
    netRevenue: 0,
    hostPayout: 0, 
    conversionRate: '0.0',
    retentionRate: '0.0',
    aov: 0,
    cancellationRate: 0,
    
    // Data
    topExperiences: [] as any[],
    superHostCandidates: [] as any[],
    funnel: { views: 0, clicks: 0, paymentInit: 0, completed: 0 },
    cancelBreakdown: { user: 0, host: 0 },
    priceDistribution: { low: 0, mid: 0, high: 0 },
    
    // Mock
    avgResponseTime: 28,
    responseRate: 96.5
  });

  // 🟢 [핵심] 데이터가 들어오면 가공 시작 (fetch 아님!)
  useEffect(() => {
    if (bookings && users && exps && reviews) {
      processData();
    }
  }, [bookings, users, exps, reviews]);

  const processData = () => {
    try {
      setLoading(true);
      
      // --- 데이터 가공 로직 ---
      let gmv = 0, netRevenue = 0, cancelledCount = 0, completedCount = 0;
      let userCancel = 0, hostCancel = 0;
      const userBookingCounts: Record<string, number> = {};
      const expStats: Record<string, any> = {};
      const hostStats: Record<string, any> = {};
      const priceDist = { low: 0, mid: 0, high: 0 };

      // 1. Bookings 분석
      bookings.forEach((b: any) => {
        // 호스트 통계
        const exp = exps.find(e => e.id === b.experience_id);
        if (exp?.host_id) {
           if (!hostStats[exp.host_id]) hostStats[exp.host_id] = { bookings: 0, ratingSum: 0, reviewCount: 0 };
           hostStats[exp.host_id].bookings += 1;
        }

        // 매출 및 상태
        if (['confirmed', 'PAID', 'completed'].includes(b.status)) {
          completedCount++;
          const totalPaid = b.amount || 0; 
          gmv += totalPaid;
          netRevenue += (totalPaid - Math.floor((b.total_price || 0) * 0.8));

          // 가격 분포
          if (totalPaid < 30000) priceDist.low++;
          else if (totalPaid < 100000) priceDist.mid++;
          else priceDist.high++;

          // 재구매율
          if (b.user_id) userBookingCounts[b.user_id] = (userBookingCounts[b.user_id] || 0) + 1;
          
          // 인기 체험
          if (!expStats[b.experience_id]) expStats[b.experience_id] = { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
          expStats[b.experience_id].count++;
          expStats[b.experience_id].revenue += totalPaid;
        }

        // 취소
        if (['cancelled', 'declined', 'cancellation_requested'].includes(b.status)) {
          cancelledCount++;
          if (b.status === 'cancelled') userCancel++; else hostCancel++;
        }
      });

      // 2. Reviews 분석
      reviews.forEach((r: any) => {
        if (expStats[r.experience_id]) {
          expStats[r.experience_id].ratingSum += r.rating;
          expStats[r.experience_id].reviewCount++;
        }
        const exp = exps.find(e => e.id === r.experience_id);
        if (exp?.host_id && hostStats[exp.host_id]) {
           hostStats[exp.host_id].ratingSum += r.rating;
           hostStats[exp.host_id].reviewCount++;
        }
      });

      // 3. Top Experiences
      const topExps = exps.map((e: any) => {
        const s = expStats[e.id] || { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
        return {
          ...e,
          bookingCount: s.count,
          totalRevenue: s.revenue,
          rating: s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(1) : 'New',
          reviewCount: s.reviewCount
        };
      }).sort((a, b) => b.bookingCount - a.bookingCount).slice(0, 4);

      // 4. Super Host Candidates
      const superHosts = Object.entries(hostStats)
        .map(([id, s]: any) => ({
          id,
          bookings: s.bookings,
          rating: s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(2) : '0.0'
        }))
        .filter((h: any) => h.bookings >= 3 && Number(h.rating) >= 4.0)
        .slice(0, 5);

      const userCount = users.length;

      setStats({
        totalUsers: userCount,
        activeExpsCount: exps.length,
        gmv,
        netRevenue,
        hostPayout: 0, 
        conversionRate: userCount ? ((completedCount / userCount) * 100).toFixed(1) : '0.0',
        retentionRate: Object.values(userBookingCounts).filter(c => c > 1).length > 0 
          ? ((Object.values(userBookingCounts).filter(c => c > 1).length / Object.keys(userBookingCounts).length) * 100).toFixed(1) : '0.0',
        aov: completedCount > 0 ? Math.floor(gmv / completedCount) : 0,
        cancellationRate: (cancelledCount + completedCount) > 0 ? Math.floor((cancelledCount / (cancelledCount + completedCount)) * 100) : 0,
        topExperiences: topExps,
        superHostCandidates: superHosts,
        funnel: { views: completedCount * 20, clicks: completedCount * 5, paymentInit: Math.floor(completedCount * 1.5), completed: completedCount },
        cancelBreakdown: { user: userCancel, host: hostCancel },
        priceDistribution: priceDist,
        avgResponseTime: 28,
        responseRate: 96.5
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordClick = (keyword: string) => {
    showToast(`'${keyword}' 검색 결과로 필터링합니다.`, 'success');
  };

  if (loading) return <div className="p-8"><Skeleton className="w-full h-96"/></div>;

  return (
    <div className="flex-1 p-8 space-y-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      
      {/* 1. 심플 KPI 그리드 */}
      <section>
        <h2 className="text-xl font-bold text-black mb-6 tracking-tight">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <SimpleKpi label="총 가입 유저" value={stats.totalUsers} unit="명" onClick={() => setSelectedMetric('users')} />
          <SimpleKpi label="활성 체험" value={stats.activeExpsCount} unit="개" onClick={() => setSelectedMetric('exps')} />
          <SimpleKpi label="총 거래액 (GMV)" value={`₩${(stats.gmv/10000).toFixed(0)}`} unit="만" onClick={() => setSelectedMetric('gmv')} />
          <SimpleKpi label="플랫폼 순수익" value={`₩${stats.netRevenue.toLocaleString()}`} unit="" onClick={() => setSelectedMetric('revenue')} />
          
          <SimpleKpi label="객단가 (AOV)" value={`₩${stats.aov.toLocaleString()}`} onClick={() => setSelectedMetric('aov')} />
          <SimpleKpi label="취소율" value={`${stats.cancellationRate}%`} onClick={() => setSelectedMetric('cancel')} />
          <SimpleKpi label="구매 전환율" value={`${stats.conversionRate}%`} onClick={() => setSelectedMetric('conversion')} />
          <SimpleKpi label="재구매율" value={`${stats.retentionRate}%`} onClick={() => setSelectedMetric('retention')} />
        </div>
      </section>

      <div className="border-t border-gray-100"></div>

      {/* 2. 인기 검색어 */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-black flex items-center gap-2">
            <Search size={18} /> 인기 검색어 Top 5
          </h2>
          <span className="text-xs text-gray-400">Today Updates</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {['#을지로 노포', '#한강 피크닉', '#퍼스널 컬러', '#K-POP 댄스', '#북촌 한옥'].map((tag, i) => (
            <button
              key={tag}
              onClick={() => handleKeywordClick(tag)}
              className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-black hover:text-white hover:border-black transition-all duration-200 shadow-sm active:scale-95"
            >
              {i+1}. {tag}
            </button>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-100"></div>

      {/* 3. 분석 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* 예약 퍼널 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-black">예약 퍼널 (Funnel)</h3>
            <Activity size={18} className="text-gray-400"/>
          </div>
          <div className="space-y-2">
             <FunnelBar label="조회" value={stats.funnel.views} max={stats.funnel.views} />
             <FunnelBar label="클릭" value={stats.funnel.clicks} max={stats.funnel.views} />
             <FunnelBar label="결제 진입" value={stats.funnel.paymentInit} max={stats.funnel.views} />
             <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal />
          </div>
        </div>

        {/* 인기 체험 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-black">인기 체험 Top 4</h3>
            <Star size={18} className="text-gray-400"/>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.topExperiences.length > 0 ? stats.topExperiences.map((exp: any, idx: number) => (
              <div key={exp.id} className="flex items-center gap-4 py-4 group cursor-pointer hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors">
                <span className="text-sm font-bold text-gray-300 w-4">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-black truncate">{exp.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">₩{Number(exp.price).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-black">{exp.bookingCount}건</div>
                  <div className="text-xs text-gray-400">⭐ {exp.rating}</div>
                </div>
              </div>
            )) : <div className="text-sm text-gray-400 py-4">데이터 없음</div>}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100"></div>

      {/* 4. 유저 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
         {/* 슈퍼 호스트 */}
         <div>
            <h3 className="text-lg font-bold text-black mb-6 flex items-center gap-2">슈퍼 호스트 후보</h3>
            <div className="space-y-3">
               {stats.superHostCandidates.length > 0 ? stats.superHostCandidates.map((h, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs font-bold">H</div>
                        <div>
                           <div className="text-sm font-bold text-black">호스트 #{h.id.slice(0,5)}</div>
                           <div className="text-xs text-gray-500">{h.bookings}건 예약</div>
                        </div>
                     </div>
                     <span className="text-xs font-bold text-black">⭐ {h.rating}</span>
                  </div>
               )) : <div className="text-sm text-gray-400">조건 충족 호스트 없음</div>}
            </div>
         </div>

         {/* 인구 통계 */}
         <div>
            <h3 className="text-lg font-bold text-black mb-6">유저 분포 (KR / Global)</h3>
            <div className="mb-8">
               <div className="flex justify-between text-sm font-medium mb-2">
                  <span>내국인</span> <span>65%</span>
               </div>
               <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-black w-[65%]"></div>
               </div>
            </div>
            <div>
               <div className="flex justify-between text-sm font-medium mb-2">
                  <span>외국인 (Global)</span> <span>35%</span>
               </div>
               <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-400 w-[35%]"></div>
               </div>
            </div>
         </div>
      </div>

      {/* 상세 모달 */}
      {selectedMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedMetric(null)}>
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl p-8 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMetric(null)} className="absolute top-6 right-6 text-gray-400 hover:text-black"><X size={20}/></button>
            <h3 className="text-xl font-bold mb-6">상세 분석</h3>
            <div className="min-h-[150px] flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-xl">
               {selectedMetric === 'aov' ? (
                  <div className="w-full p-6 space-y-4">
                     <p className="font-bold text-black mb-2">가격대별 결제 비중</p>
                     <SimpleBar label="Low (<3만)" val={stats.priceDistribution.low} max={10} />
                     <SimpleBar label="Mid (3~10만)" val={stats.priceDistribution.mid} max={10} />
                     <SimpleBar label="High (>10만)" val={stats.priceDistribution.high} max={10} />
                  </div>
               ) : (
                  "데이터 상세 로드 중..."
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// UI Components
function SimpleKpi({ label, value, unit, onClick }: any) {
  return (
    <div onClick={onClick} className="p-6 bg-white border border-gray-200 rounded-xl hover:border-black transition-colors cursor-pointer group">
      <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide group-hover:text-black transition-colors">{label}</div>
      <div className="text-2xl font-bold text-black tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max, isFinal }: any) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-4">
       <div className="w-20 text-xs font-bold text-gray-500">{label}</div>
       <div className="flex-1 h-8 bg-gray-50 rounded-lg overflow-hidden relative">
          <div className={`h-full absolute top-0 left-0 ${isFinal ? 'bg-black' : 'bg-gray-300'}`} style={{ width: `${Math.max(percent, 2)}%` }}></div>
          <div className={`absolute top-0 left-2 h-full flex items-center text-xs font-bold ${isFinal && percent > 20 ? 'text-white' : 'text-black'}`}>{value.toLocaleString()}</div>
       </div>
       <div className="w-12 text-right text-xs text-gray-400">{percent.toFixed(0)}%</div>
    </div>
  );
}

function SimpleBar({ label, val, max }: any) {
   return (
      <div className="flex items-center gap-3">
         <span className="text-xs w-20">{label}</span>
         <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black" style={{ width: `${Math.min((val/max)*100, 100)}%` }}></div>
         </div>
      </div>
   )
}