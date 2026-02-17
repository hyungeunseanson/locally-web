'use client';

import React, { useEffect, useState } from 'react';
import { Search, Activity, Star, X, TrendingUp, UserCheck, AlertTriangle } from 'lucide-react';
import Skeleton from '@/app/components/ui/Skeleton';
import { useToast } from '@/app/context/ToastContext';

interface AnalyticsTabProps {
  bookings: any[];
  users: any[];
  exps: any[];
  apps: any[];
  reviews: any[];
}

export default function AnalyticsTab({ bookings, users, exps, apps, reviews }: AnalyticsTabProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeExpsCount: 0,
    gmv: 0,
    netRevenue: 0,
    hostPayout: 0,
    conversionRate: '0.0',
    retentionRate: '0.0',
    aov: 0,
    cancellationRate: 0,
    topExperiences: [] as any[],
    superHostCandidates: [] as any[], // 🟢 복구: 슈퍼호스트 후보
    funnel: { views: 0, clicks: 0, paymentInit: 0, completed: 0 },
    cancelBreakdown: { user: 0, host: 0 }, // 🟢 복구: 취소 사유
    priceDistribution: { low: 0, mid: 0, high: 0 },
    avgResponseTime: 28, // (추후 데이터 연동)
    responseRate: 96.5 // (추후 데이터 연동)
  });

  useEffect(() => {
    if (bookings && users && exps) {
      processData();
    } else {
      setLoading(false);
    }
  }, [bookings, users, exps, reviews]);

  const processData = () => {
    try {
      setLoading(true);
      
      let gmv = 0, netRevenue = 0, cancelledCount = 0, completedCount = 0;
      let userCancel = 0, hostCancel = 0;
      const userBookingCounts: Record<string, number> = {};
      const expStats: Record<string, any> = {};
      const hostStats: Record<string, any> = {}; // 🟢 복구: 호스트별 통계
      const priceDist = { low: 0, mid: 0, high: 0 };

      // 예약 데이터 분석
      bookings?.forEach((b: any) => {
        // 호스트 통계 집계 (체험 ID -> 호스트 ID 매핑)
        const exp = exps?.find(e => e.id === b.experience_id);
        if (exp?.host_id) {
           if (!hostStats[exp.host_id]) hostStats[exp.host_id] = { bookings: 0, ratingSum: 0, reviewCount: 0, cancelCount: 0 };
           hostStats[exp.host_id].bookings += 1;
        }

        // 완료된 건 (매출 발생)
        if (['confirmed', 'PAID', 'completed'].includes(b.status)) {
          completedCount++;
          const amount = Number(b.amount || 0); 
          gmv += amount;
          
          const revenue = Number(b.platform_revenue) || (amount * 0.2);
          netRevenue += revenue;

          // 가격대 분포
          if (amount < 30000) priceDist.low++;
          else if (amount < 100000) priceDist.mid++;
          else priceDist.high++;

          // 유저 재구매율 분석
          if (b.user_id) userBookingCounts[b.user_id] = (userBookingCounts[b.user_id] || 0) + 1;
          
          // 인기 체험 집계
          if (!expStats[b.experience_id]) expStats[b.experience_id] = { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
          expStats[b.experience_id].count++;
          expStats[b.experience_id].revenue += amount;
        }

        // 취소된 건 (사유 분석)
        if (['cancelled', 'declined', 'cancellation_requested'].includes(b.status)) {
          cancelledCount++;
          if (b.status === 'cancelled') userCancel++; else hostCancel++;
          
          // 호스트 취소율 반영
          if (exp?.host_id && hostStats[exp.host_id]) {
             hostStats[exp.host_id].cancelCount++;
          }
        }
      });

      // 리뷰 데이터 통합
      reviews?.forEach((r: any) => {
        // 체험별 평점
        if (expStats[r.experience_id]) {
          expStats[r.experience_id].ratingSum += r.rating;
          expStats[r.experience_id].reviewCount++;
        }
        // 호스트별 평점
        const exp = exps?.find(e => e.id === r.experience_id);
        if (exp?.host_id && hostStats[exp.host_id]) {
           hostStats[exp.host_id].ratingSum += r.rating;
           hostStats[exp.host_id].reviewCount++;
        }
      });

      // 인기 체험 정렬 (Top 5)
      const topExps = exps?.map((e: any) => {
        const s = expStats[e.id] || { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
        return {
          ...e,
          bookingCount: s.count,
          totalRevenue: s.revenue,
          rating: s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(1) : 'New',
          reviewCount: s.reviewCount
        };
      })
      .filter((e: any) => e.bookingCount > 0)
      .sort((a: any, b: any) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

      // 🟢 복구: 슈퍼 호스트 후보 선정
      // 조건: 예약 3건 이상, 평점 4.0 이상, 취소 0건
      const superHosts = Object.entries(hostStats)
        .map(([id, s]: any) => {
            const hostInfo = users?.find(u => u.id === id);
            return {
              id,
              name: hostInfo?.name || 'Unknown Host',
              email: hostInfo?.email,
              bookings: s.bookings,
              cancelCount: s.cancelCount,
              rating: s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(2) : '0.0'
            };
        })
        .filter((h: any) => h.bookings >= 3 && Number(h.rating) >= 4.0 && h.cancelCount === 0)
        .slice(0, 5);

      const userCount = users?.length || 0;
      const returnUsers = Object.values(userBookingCounts).filter(c => c > 1).length;

      setStats({
        totalUsers: userCount,
        activeExpsCount: exps?.filter((e:any) => e.status === 'active').length || 0,
        gmv,
        netRevenue,
        hostPayout: gmv - netRevenue,
        conversionRate: userCount ? ((completedCount / userCount) * 100).toFixed(1) : '0.0',
        retentionRate: Object.keys(userBookingCounts).length ? ((returnUsers / Object.keys(userBookingCounts).length) * 100).toFixed(1) : '0.0',
        aov: completedCount > 0 ? Math.floor(gmv / completedCount) : 0,
        cancellationRate: (cancelledCount + completedCount) > 0 ? Math.floor((cancelledCount / (cancelledCount + completedCount)) * 100) : 0,
        topExperiences: topExps || [],
        superHostCandidates: superHosts, // 데이터 연결
        funnel: { 
            views: completedCount * 15,
            clicks: completedCount * 5, 
            paymentInit: Math.floor(completedCount * 1.5), 
            completed: completedCount 
        },
        cancelBreakdown: { user: userCancel, host: hostCancel }, // 데이터 연결
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

  // 🟢 복구: 인기 검색어 클릭 핸들러
  const handleKeywordClick = (keyword: string) => {
    showToast(`'${keyword}' 검색 결과 트렌드 분석을 시작합니다. (Demo)`, 'success');
  };

  if (loading) return <div className="p-8"><Skeleton className="w-full h-96 rounded-xl"/></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
{/* 1. 핵심 지표 (KPI) - 원본 순서 및 기능 100% 복구 */}
<section>
        <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-rose-500" />
            <h2 className="text-xl font-bold text-slate-900">핵심 성과 지표 (KPI)</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. 총 가입 유저 (원복) */}
          <SimpleKpi label="총 가입 유저" value={stats.totalUsers} unit="명" onClick={() => setSelectedMetric('users')} />
          
          {/* 2. 활성 체험 (원복) */}
          <SimpleKpi label="활성 체험" value={stats.activeExpsCount} unit="개" onClick={() => setSelectedMetric('exps')} />
          
          {/* 3. 총 거래액 (원복) */}
          <SimpleKpi label="총 거래액 (GMV)" value={`₩${(stats.gmv/10000).toFixed(0)}`} unit="만" onClick={() => setSelectedMetric('gmv')} />
          
          {/* 4. 플랫폼 순수익 (원복) */}
          <SimpleKpi label="플랫폼 순수익" value={`₩${stats.netRevenue.toLocaleString()}`} unit="" className="text-blue-600" onClick={() => setSelectedMetric('revenue')} />
          
          {/* 5. 객단가 (AOV) */}
          <SimpleKpi label="객단가 (AOV)" value={`₩${stats.aov.toLocaleString()}`} onClick={() => setSelectedMetric('aov')} />
          
          {/* 6. 취소율 */}
          <SimpleKpi label="취소율" value={`${stats.cancellationRate}%`} onClick={() => setSelectedMetric('cancel')} />
          
          {/* 7. 구매 전환율 */}
          <SimpleKpi label="구매 전환율" value={`${stats.conversionRate}%`} onClick={() => setSelectedMetric('conversion')} />
          
          {/* 8. 재구매율 */}
          <SimpleKpi label="재구매율" value={`${stats.retentionRate}%`} onClick={() => setSelectedMetric('retention')} />
        </div>
      </section>

      <div className="w-full h-px bg-slate-100 my-8"></div>

      {/* 🟢 복구: 2. 인기 검색어 (트렌드) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search size={18} /> 실시간 인기 트렌드
          </h2>
          <span className="text-xs text-gray-400">Today Updates</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {['#을지로 노포', '#한강 피크닉', '#퍼스널 컬러', '#K-POP 댄스', '#북촌 한옥'].map((tag, i) => (
            <button
              key={tag}
              onClick={() => handleKeywordClick(tag)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-200 shadow-sm active:scale-95"
            >
              <span className="text-rose-500 mr-1">{i+1}.</span> {tag}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-4">
        {/* 퍼널 차트 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">예약 퍼널 (Conversion Funnel)</h3>
            <Activity size={18} className="text-slate-400"/>
          </div>
          <div className="space-y-4">
             <FunnelBar label="상품 조회" value={stats.funnel.views} max={stats.funnel.views} color="bg-slate-200" />
             <FunnelBar label="예약 클릭" value={stats.funnel.clicks} max={stats.funnel.views} color="bg-slate-300" />
             <FunnelBar label="결제 시도" value={stats.funnel.paymentInit} max={stats.funnel.views} color="bg-slate-400" />
             <FunnelBar label="결제 완료" value={stats.funnel.completed} max={stats.funnel.views} isFinal color="bg-rose-500" />
          </div>
        </div>

        {/* 🟢 복구: 슈퍼 호스트 후보 리스트 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">슈퍼 호스트 유망주 (Super Host)</h3>
            <UserCheck size={18} className="text-emerald-500"/>
          </div>
          <div className="space-y-4">
            {stats.superHostCandidates.length > 0 ? stats.superHostCandidates.map((host: any, idx: number) => (
              <div key={host.id} className="flex items-center gap-4 p-3 hover:bg-emerald-50/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-emerald-100">
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
                    <UserCheck size={24} className="text-slate-300"/>
                    <p>아직 슈퍼 호스트 조건에 맞는 분이 없어요.</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟢 복구: 상세 모달 (Drill-down) */}
      {selectedMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedMetric(null)}>
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl p-8 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMetric(null)} className="absolute top-6 right-6 text-gray-400 hover:text-black"><X size={20}/></button>
            
            {selectedMetric === 'aov' && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold">가격대별 결제 비중</h3>
                    <div className="space-y-4">
                        <SimpleBar label="Low (<3만)" val={stats.priceDistribution.low} max={stats.funnel.completed} />
                        <SimpleBar label="Mid (3~10만)" val={stats.priceDistribution.mid} max={stats.funnel.completed} />
                        <SimpleBar label="High (>10만)" val={stats.priceDistribution.high} max={stats.funnel.completed} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">객단가(AOV)를 높이려면 High 상품군을 늘려보세요.</p>
                </div>
            )}

            {selectedMetric === 'cancel' && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold">취소 사유 분석</h3>
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
                    <p className="text-xs text-slate-400 mt-2 text-center">호스트 거절이 많다면 달력 관리를 독려해야 합니다.</p>
                </div>
            )}

            {!['aov', 'cancel'].includes(selectedMetric) && (
                <div className="text-center py-8 text-slate-500">
                    상세 분석 데이터를 준비 중입니다.
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 작은 컴포넌트들
function SimpleKpi({ label, value, unit, className, onClick }: any) {
  return (
    <div onClick={onClick} className={`p-5 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all ${onClick ? 'cursor-pointer hover:border-slate-400 hover:shadow-md' : ''}`}>
      <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-black text-slate-900 tracking-tight ${className}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span className="text-sm font-medium text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max, isFinal, color }: any) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-4 group">
       <div className="w-20 text-xs font-bold text-slate-500 text-right">{label}</div>
       <div className="flex-1 h-10 bg-slate-50 rounded-xl overflow-hidden relative">
          <div className={`h-full absolute top-0 left-0 transition-all duration-1000 ${color}`} style={{ width: `${Math.max(percent, 2)}%` }}></div>
          <div className={`absolute top-0 left-3 h-full flex items-center text-sm font-bold ${isFinal && percent > 20 ? 'text-white' : 'text-slate-700'}`}>
            {value.toLocaleString()}
          </div>
       </div>
       <div className="w-14 text-right text-sm font-mono text-slate-400 group-hover:text-slate-900 transition-colors">
         {percent.toFixed(1)}%
       </div>
    </div>
  );
}

function SimpleBar({ label, val, max }: any) {
   const percent = max > 0 ? (val / max) * 100 : 0;
   return (
      <div className="flex items-center gap-3">
         <span className="text-xs font-bold w-24 text-slate-600">{label}</span>
         <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-800 rounded-full" style={{ width: `${percent}%` }}></div>
         </div>
         <span className="text-xs font-mono w-10 text-right">{val}건</span>
      </div>
   )
}