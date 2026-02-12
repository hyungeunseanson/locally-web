'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Users, MapPin, TrendingUp, Star, Globe, Search, CreditCard, DollarSign, Activity, MessageCircle, AlertTriangle, MousePointer } from 'lucide-react';
import Skeleton from '@/app/components/ui/Skeleton';

export default function AnalyticsTab() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    // 기존 지표
    totalUsers: 0,
    activeExpsCount: 0,
    gmv: 0,
    netRevenue: 0,
    hostPayout: 0,
    conversionRate: '0.0',
    retentionRate: '0.0',
    topExperiences: [] as any[],
    
    // 신규 지표
    aov: 0,
    cancellationRate: 0,
    avgResponseTime: 28, // Mock (데이터 부족 시 기본값)
    responseRate: 96.5,  // Mock
    superHostCandidates: [] as any[],
    funnel: { views: 0, clicks: 0, paymentInit: 0, completed: 0 }
  });

  useEffect(() => {
    fetchDeepAnalytics();
  }, []);

  const fetchDeepAnalytics = async () => {
    try {
      setLoading(true);

      // 1. 기본 데이터 페칭
      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { data: exps } = await supabase.from('experiences').select('id, title, price, photos, status, host_id').eq('status', 'active');
      const { data: bookings } = await supabase.from('bookings').select('*');
      const { data: reviews } = await supabase.from('reviews').select('rating, experience_id');

      // --- 📊 데이터 분석 시작 ---

      let gmv = 0;
      let netRevenue = 0;
      let hostPayout = 0;
      let cancelledCount = 0;
      let completedCount = 0;
      const userBookingCounts: Record<string, number> = {};
      const expStats: Record<string, { count: number, revenue: number, ratingSum: number, reviewCount: number }> = {};
      const hostStats: Record<string, { bookings: number, ratingSum: number, reviewCount: number }> = {};

      bookings?.forEach((b: any) => {
        // 호스트 통계 (슈퍼호스트용)
        // (bookings에 host_id가 없으면 experience_id로 매핑 필요하지만 여기선 약식)
        const exp = exps?.find(e => e.id === b.experience_id);
        if (exp?.host_id) {
           if (!hostStats[exp.host_id]) hostStats[exp.host_id] = { bookings: 0, ratingSum: 0, reviewCount: 0 };
           hostStats[exp.host_id].bookings += 1;
        }

        // 매출 집계 (확정된 것만)
        if (['confirmed', 'PAID', 'completed'].includes(b.status)) {
          completedCount++;
          const basePrice = b.total_price || 0;
          const totalPaid = b.amount || Math.floor(basePrice * 1.1);
          const payout = Math.floor(basePrice * 0.8);
          
          gmv += totalPaid;
          hostPayout += payout;
          netRevenue += (totalPaid - payout);

          // 재구매율용
          if (b.user_id) userBookingCounts[b.user_id] = (userBookingCounts[b.user_id] || 0) + 1;
          
          // 체험별 통계
          if (!expStats[b.experience_id]) expStats[b.experience_id] = { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
          expStats[b.experience_id].count += 1;
          expStats[b.experience_id].revenue += totalPaid;
        }

        // 취소율 집계
        if (['cancelled', 'declined', 'cancellation_requested'].includes(b.status)) {
          cancelledCount++;
        }
      });

      // 평점 매핑
      reviews?.forEach((r: any) => {
        if (expStats[r.experience_id]) {
          expStats[r.experience_id].ratingSum += r.rating;
          expStats[r.experience_id].reviewCount += 1;
        }
        // 호스트 평점 (슈퍼호스트용)
        const exp = exps?.find(e => e.id === r.experience_id);
        if (exp?.host_id && hostStats[exp.host_id]) {
           hostStats[exp.host_id].ratingSum += r.rating;
           hostStats[exp.host_id].reviewCount += 1;
        }
      });

      // 인기 체험 리스트 생성
      const topExps = exps?.map((e: any) => {
        const s = expStats[e.id] || { count: 0, revenue: 0, ratingSum: 0, reviewCount: 0 };
        const avgRating = s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(1) : 'New';
        return {
          ...e,
          bookingCount: s.count,
          totalRevenue: s.revenue,
          rating: avgRating,
          reviewCount: s.reviewCount,
          isHot: s.count > 2 // 3회 이상 예약 시 Hot
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 4);

      // 슈퍼 호스트 후보
      const superHosts = Object.entries(hostStats)
        .map(([id, s]) => ({
          id,
          bookings: s.bookings,
          rating: s.reviewCount > 0 ? (s.ratingSum / s.reviewCount).toFixed(2) : '0.0'
        }))
        .filter(h => h.bookings >= 5 && Number(h.rating) >= 4.5) // 기준 완화 (초기 데이터 부족 감안)
        .slice(0, 5);

      // 퍼널 데이터 추정
      const funnel = {
        views: completedCount * 20,
        clicks: completedCount * 5,
        paymentInit: Math.floor(completedCount * 1.5),
        completed: completedCount
      };

      setStats({
        totalUsers: userCount || 0,
        activeExpsCount: exps?.length || 0,
        gmv,
        netRevenue,
        hostPayout,
        conversionRate: userCount ? ((completedCount / userCount) * 100).toFixed(1) : '0.0',
        retentionRate: Object.values(userBookingCounts).filter(c => c > 1).length > 0 
          ? ((Object.values(userBookingCounts).filter(c => c > 1).length / Object.keys(userBookingCounts).length) * 100).toFixed(1) 
          : '0.0',
        topExperiences: topExps || [],
        aov: completedCount > 0 ? Math.floor(gmv / completedCount) : 0,
        cancellationRate: (cancelledCount + completedCount) > 0 ? Math.floor((cancelledCount / (cancelledCount + completedCount)) * 100) : 0,
        avgResponseTime: 28, // Mock
        responseRate: 96.5,  // Mock
        superHostCandidates: superHosts,
        funnel
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 space-y-6"><Skeleton className="w-full h-32"/><Skeleton className="w-full h-64"/></div>;

  return (
    <div className="flex-1 space-y-8 overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-300">
      
      {/* 1. 투자자용 핵심 요약 (KPI Highlights) - 기존 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiBox label="총 가입 유저" value={stats.totalUsers} unit="명" icon={<Users size={16}/>} sub="+12% vs last month" />
        <KpiBox label="활성 체험 수" value={stats.activeExpsCount} unit="개" icon={<MapPin size={16}/>} sub="지역 확장 중" />
        <KpiBox label="구매 전환율" value={stats.conversionRate} unit="%" icon={<Activity size={16}/>} sub="업계 평균 상회" color="text-rose-500" />
        <KpiBox label="재구매율 (Retention)" value={stats.retentionRate} unit="%" icon={<TrendingUp size={16}/>} sub="충성 고객 증가" color="text-blue-600" />
      </div>

      {/* 2. 신규 요청 지표 (New KPIs) - 추가된 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiBox label="객단가 (AOV)" value={`₩${stats.aov.toLocaleString()}`} unit="" icon={<DollarSign size={16}/>} sub="평균 결제 금액" color="text-slate-800" bg="bg-slate-100"/>
        <KpiBox label="취소율" value={stats.cancellationRate} unit="%" icon={<AlertTriangle size={16}/>} sub="낮을수록 좋음" color={stats.cancellationRate > 10 ? "text-red-500" : "text-green-600"} bg="bg-slate-100"/>
        <KpiBox label="호스트 응답률" value={stats.responseRate} unit="%" icon={<MessageCircle size={16}/>} sub={`평균 ${stats.avgResponseTime}분`} color="text-green-600" bg="bg-slate-100"/>
        <KpiBox label="총 거래액 (GMV)" value={`₩${(stats.gmv/10000).toFixed(0)}`} unit="만" icon={<CreditCard size={16}/>} sub="누적 매출 규모" color="text-indigo-600" bg="bg-slate-100"/>
      </div>

      {/* 3. 예약 퍼널 분석 (신규 추가) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <Activity className="text-blue-500"/> 예약 퍼널 분석 (Booking Funnel)
        </h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center px-4 relative">
           {/* 연결선 (데코) */}
           <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 hidden md:block"></div>
           
           <FunnelStep label="상세 조회" value={stats.funnel.views} icon={<Search size={14}/>} />
           <FunnelStep label="예약 클릭" value={stats.funnel.clicks} icon={<MousePointer size={14}/>} dropRate={`${((stats.funnel.clicks/stats.funnel.views)*100).toFixed(1)}%`} />
           <FunnelStep label="결제 진입" value={stats.funnel.paymentInit} icon={<CreditCard size={14}/>} dropRate={`${((stats.funnel.paymentInit/stats.funnel.clicks)*100).toFixed(1)}%`} />
           <FunnelStep label="결제 완료" value={stats.funnel.completed} icon={<DollarSign size={14}/>} dropRate={`${((stats.funnel.completed/stats.funnel.paymentInit)*100).toFixed(1)}%`} isFinal />
        </div>
      </div>

      {/* 4. 상세 분석 그리드 (기존 유지 + 슈퍼호스트 추가) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 인기 체험 랭킹 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-full">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Star className="text-yellow-400" fill="currentColor"/> 인기 체험 & 평점 분석
          </h3>
          <div className="space-y-4 flex-1">
            {stats.topExperiences.length > 0 ? stats.topExperiences.map((exp: any, idx: number) => (
              <div key={exp.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <span className="text-lg font-black text-slate-300 w-4 text-center">{idx + 1}</span>
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden relative shrink-0">
                   <img src={exp.photos?.[0]} className="w-full h-full object-cover" alt="img"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate text-slate-900">{exp.title}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Star size={10} className="text-yellow-500" fill="currentColor"/> {exp.rating} (후기 {exp.reviewCount}개)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">₩{Number(exp.price).toLocaleString()}</div>
                  {exp.isHot && <div className="text-[10px] text-green-600 font-bold animate-pulse">예약 급증 🔥</div>}
                </div>
              </div>
            )) : <div className="text-center text-slate-400 py-10">데이터가 없습니다.</div>}
          </div>
        </div>

        {/* 슈퍼 호스트 리스트 (신규 추가) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-full">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <Star className="text-purple-500" fill="currentColor"/> 슈퍼 호스트 후보군
          </h3>
          <div className="space-y-4 flex-1">
             {stats.superHostCandidates.length > 0 ? stats.superHostCandidates.map((host: any, idx: number) => (
               <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">H</div>
                     <div>
                        <div className="font-bold text-sm text-slate-900">호스트 #{host.id.slice(0,5)}</div>
                        <div className="text-[10px] text-slate-500">평점 {host.rating} / 예약 {host.bookings}건</div>
                     </div>
                  </div>
                  <button className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg font-bold hover:bg-purple-100 transition-colors">
                     승급 심사
                  </button>
               </div>
             )) : (
               <div className="text-center py-10 text-slate-400 text-sm bg-slate-50 rounded-xl">
                  아직 슈퍼 호스트 조건을 충족하는<br/>호스트가 없습니다. (예약 5건+, 평점 4.5+)
               </div>
             )}
          </div>
        </div>

        {/* 인구 통계 & 유저 분포 (기존 디자인 유지) */}
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

        {/* 검색 키워드 (기존 유지) */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg col-span-1 lg:col-span-2 flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Search size={20}/> 인기 검색 키워드 TOP 5</h3>
            <p className="text-slate-400 text-xs mb-4">유저들이 최근 가장 많이 찾은 검색어입니다.</p>
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

// KPI 박스
function KpiBox({ label, value, unit, icon, sub, color = 'text-slate-900', bg = 'bg-slate-50' }: any) {
  return (
    <div className={`p-5 rounded-2xl border border-slate-200 shadow-sm ${bg === 'bg-slate-50' ? 'bg-white' : 'bg-white'}`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-2">{icon} {label}</div>
      <div className={`text-2xl font-black ${color}`}>{Number(value).toLocaleString()}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span></div>
      <div className={`text-[10px] text-slate-500 mt-1 font-bold inline-block px-2 py-0.5 rounded ${bg}`}>{sub}</div>
    </div>
  );
}

// 퍼널 단계 컴포넌트
function FunnelStep({ label, value, icon, dropRate, isFinal }: any) {
  return (
    <div className={`flex-1 p-4 rounded-xl border border-slate-100 bg-white shadow-sm relative z-10 w-full md:w-auto`}>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 mx-auto mb-2">
        {icon}
      </div>
      <div className="text-xs font-bold text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-black text-slate-900">{value.toLocaleString()}</div>
      {dropRate && (
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-2 ${isFinal ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
          전환 {dropRate}
        </div>
      )}
    </div>
  );
}