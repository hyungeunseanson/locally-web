'use client';

import React, { useState, useMemo } from 'react';
import { 
  DollarSign, CheckCircle2, Users, TrendingUp, BarChart3, 
  Search, Filter, X, Award, Repeat, Crown, ArrowUpRight 
} from 'lucide-react';
import { StatCard } from './SharedComponents';

export default function AnalyticsTab({ bookings, users, exps, apps }: any) {
  const [statPeriod, setStatPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER'>('MONTH');
  
  // 모달 상태 관리 (null이면 닫힘, 문자열이면 해당 모달 열림)
  const [activeModal, setActiveModal] = useState<'VIP_INSIGHTS' | 'RETENTION_DETAIL' | 'REVENUE_BREAKDOWN' | null>(null);

  // --- 1. 기본 필터링 로직 ---
  const getFilteredDataByPeriod = (data: any[], dateField: string) => {
    const now = new Date();
    const periodMap = { 'TODAY': 1, 'WEEK': 7, 'MONTH': 30, 'QUARTER': 90 };
    const days = periodMap[statPeriod];
    const threshold = new Date(now.setDate(now.getDate() - days));
    return data.filter(item => new Date(item[dateField]) >= threshold);
  };

  const totalRevenue = bookings.reduce((acc: number, b: any) => acc + (b.total_price || 0), 0);
  const periodBookings = getFilteredDataByPeriod(bookings, 'created_at');
  const periodRevenue = periodBookings.reduce((acc: number, b: any) => acc + (b.total_price || 0), 0);
  
  // --- 2. 고급 비즈니스 로직 (Memoization) ---
  const businessMetrics = useMemo(() => {
    // 유저별 통계 집계 (LTV, 구매 횟수)
    const userStats: Record<string, { 
      id: string, name: string, email: string, 
      ltv: number, bookingCount: number, lastSeen: string 
    }> = {};

    bookings.forEach((b: any) => {
      const uid = b.user_id;
      if (!userStats[uid]) {
        // 유저 정보 매칭 (bookings user_id -> users 배열 조회)
        const profile = users.find((u:any) => u.id === uid) || { full_name: 'Unknown User', email: '-' };
        userStats[uid] = { 
          id: uid, 
          name: profile.full_name, 
          email: profile.email, 
          ltv: 0, 
          bookingCount: 0, 
          lastSeen: b.created_at 
        };
      }
      userStats[uid].ltv += (b.total_price || 0);
      userStats[uid].bookingCount += 1;
      // 가장 최근 예약일 갱신
      if (new Date(b.created_at) > new Date(userStats[uid].lastSeen)) {
        userStats[uid].lastSeen = b.created_at;
      }
    });

    const userList = Object.values(userStats);
    const totalPayers = userList.length;
    
    // 🅰️ Retention Rate (재구매율)
    // 2회 이상 구매한 유저 수 / 전체 구매 유저 수
    const returningUsers = userList.filter(u => u.bookingCount > 1).length;
    const retentionRate = totalPayers > 0 ? Math.round((returningUsers / totalPayers) * 100) : 0;

    // 🅱️ VIP / Whale (고래) 리스트
    // LTV(생애 가치) 기준으로 정렬
    const vipList = [...userList].sort((a, b) => b.ltv - a.ltv).slice(0, 10);

    // 🅾️ AOV (평균 객단가)
    const aov = periodBookings.length > 0 ? Math.round(periodRevenue / periodBookings.length) : 0;

    return { userList, retentionRate, returningUsers, vipList, aov, totalPayers };
  }, [bookings, users, periodBookings, periodRevenue]);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto relative h-full">
      
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Business Intelligence</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">데이터 기반 의사결정을 위한 핵심 지표 (KPI)</p>
        </div>
        
        {/* Period Filter */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {[{ k: 'TODAY', l: 'Today' }, { k: 'WEEK', l: '7 Days' }, { k: 'MONTH', l: '30 Days' }, { k: 'QUARTER', l: '90 Days' }].map(p => (
            <button 
              key={p.k} 
              onClick={() => setStatPeriod(p.k as any)} 
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${statPeriod === p.k ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>
      
      {/* 1. Key Metrics Cards (Interactive) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard 
          label="Total Revenue" 
          value={`₩${periodRevenue.toLocaleString()}`} 
          sub={`Period Sales (Total: ₩${totalRevenue.toLocaleString()})`}
          color="bg-slate-900 text-white" 
          icon={<DollarSign size={22}/>} 
          onClick={() => setActiveModal('REVENUE_BREAKDOWN')}
        />
        <StatCard 
          label="Retention Rate" 
          value={`${businessMetrics.retentionRate}%`} 
          sub="Returning Customers (>1 bookings)" 
          color="bg-blue-600 text-white" 
          icon={<Repeat size={22}/>} 
          onClick={() => setActiveModal('RETENTION_DETAIL')}
        />
        <StatCard 
          label="VIP Segment (LTV)" 
          value={`${businessMetrics.vipList.length}명`} 
          sub="Top 10 High-Value Users" 
          color="bg-indigo-600 text-white" 
          icon={<Crown size={22}/>} 
          onClick={() => setActiveModal('VIP_INSIGHTS')}
        />
      </div>

      {/* 2. Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Platform Overview */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800">
            <BarChart3 size={20}/> Platform Health
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MetricBox label="Avg. Order Value (AOV)" value={`₩${businessMetrics.aov.toLocaleString()}`} />
            <MetricBox label="Active Listings" value={`${exps.length} EA`} />
            <MetricBox label="Total User Base" value={`${users.length.toLocaleString()} Users`} />
            <MetricBox 
              label="Host Approval Rate" 
              value={`${apps.length > 0 ? Math.round((apps.filter((a:any)=>a.status==='approved').length / apps.length)*100) : 0}%`} 
            />
          </div>
        </div>

        {/* Insight Summary (Static for now, can be dynamic) */}
        <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
            <TrendingUp size={20}/> Weekly Insights
          </h3>
          <ul className="space-y-4">
            <li className="flex gap-3 items-start p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="bg-green-100 text-green-700 p-1.5 rounded-lg shrink-0"><ArrowUpRight size={16}/></div>
              <div>
                <div className="text-xs font-bold text-slate-800 mb-0.5">Revenue Growth</div>
                <div className="text-xs text-slate-500 leading-snug">지난달 대비 매출이 <strong>12% 성장</strong>했습니다. VIP 고객의 재구매가 주요 요인입니다.</div>
              </div>
            </li>
            <li className="flex gap-3 items-start p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="bg-rose-100 text-rose-700 p-1.5 rounded-lg shrink-0"><Users size={16}/></div>
              <div>
                <div className="text-xs font-bold text-slate-800 mb-0.5">Churn Alert</div>
                <div className="text-xs text-slate-500 leading-snug">신규 가입 유저의 <strong>40%</strong>가 첫 예약 없이 이탈하고 있습니다. 온보딩 프로세스를 점검하세요.</div>
              </div>
            </li>
          </ul>
        </div>

      </div>

      {/* ========== ✨ Interactive Detail Modals ========== */}
      
      {/* 1. VIP Insights Modal */}
      {activeModal === 'VIP_INSIGHTS' && (
        <ModalWrapper title="👑 VIP & High-Value Customers (LTV)" onClose={() => setActiveModal(null)}>
          <div className="mb-6 bg-indigo-50 p-4 rounded-xl text-indigo-900 text-sm leading-relaxed">
            <strong>파레토 법칙 (80/20 Rule):</strong> 상위 20%의 고객이 전체 매출의 80%를 차지합니다.<br/>
            아래 리스트는 우리 플랫폼의 핵심 자산인 <strong>'큰손(Whales)'</strong> 유저들입니다. VIP 전용 혜택을 제공하여 Lock-in 하세요.
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
              <tr>
                <th className="p-4 rounded-tl-lg">Rank</th>
                <th className="p-4">Customer Profile</th>
                <th className="p-4 text-right">Lifetime Value (LTV)</th>
                <th className="p-4 text-center">Frequency</th>
                <th className="p-4 rounded-tr-lg">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businessMetrics.vipList.map((user, idx) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-black text-slate-400">{idx + 1}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{user.name || 'Anonymous'}</div>
                    <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                  </td>
                  <td className="p-4 text-right font-bold text-slate-900">₩{user.ltv.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{user.bookingCount} Visits</span>
                  </td>
                  <td className="p-4">
                    {idx === 0 ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">👑 VVIP</span> :
                     idx < 3 ? <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">Platinum</span> :
                     <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded text-xs font-medium">Gold</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalWrapper>
      )}

      {/* 2. Retention Detail Modal */}
      {activeModal === 'RETENTION_DETAIL' && (
        <ModalWrapper title="🔄 Retention & Cohort Analysis" onClose={() => setActiveModal(null)}>
          <div className="flex gap-6 mb-8">
            <div className="flex-1 bg-blue-50 p-6 rounded-2xl text-center">
              <div className="text-sm font-bold text-blue-800 mb-2">Total Payers</div>
              <div className="text-3xl font-black text-blue-900">{businessMetrics.totalPayers}명</div>
            </div>
            <div className="flex-1 bg-green-50 p-6 rounded-2xl text-center">
              <div className="text-sm font-bold text-green-800 mb-2">Returning Users</div>
              <div className="text-3xl font-black text-green-900">{businessMetrics.returningUsers}명</div>
            </div>
            <div className="flex-1 bg-slate-900 p-6 rounded-2xl text-center text-white">
              <div className="text-sm font-bold text-slate-300 mb-2">Retention Rate</div>
              <div className="text-3xl font-black">{businessMetrics.retentionRate}%</div>
            </div>
          </div>
          
          <h4 className="font-bold text-lg mb-4 text-slate-800">Action Plan</h4>
          <ul className="space-y-3">
            <ActionItem 
              icon={<Repeat size={18}/>} 
              title="리텐션 부스팅 캠페인" 
              desc="첫 구매 후 30일 이내 재구매 시 10% 할인 쿠폰을 자동 발송하세요." 
            />
            <ActionItem 
              icon={<Users size={18}/>} 
              title="이탈 유저 타겟팅" 
              desc="최근 90일간 예약이 없는 기존 고객들에게 '웰컴백' 메일을 발송하세요." 
            />
          </ul>
        </ModalWrapper>
      )}

      {/* 3. Revenue Breakdown Modal */}
      {activeModal === 'REVENUE_BREAKDOWN' && (
        <ModalWrapper title="💰 Revenue Breakdown" onClose={() => setActiveModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="p-4">Transaction Date</th>
                  <th className="p-4">Experience</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodBookings.length > 0 ? periodBookings.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-4 text-slate-500">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-slate-800">{b.experiences?.title || 'Unknown Experience'}</td>
                    <td className="p-4 text-right font-medium">₩{b.total_price?.toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">PAID</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">해당 기간의 매출 데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ModalWrapper>
      )}

    </div>
  );
}

// --- Internal Helper Components ---

function MetricBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function ActionItem({ icon, title, desc }: any) {
  return (
    <li className="flex gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
      <div className="bg-slate-100 p-2 rounded-lg h-fit text-slate-600">{icon}</div>
      <div>
        <div className="font-bold text-slate-900 mb-1">{title}</div>
        <div className="text-sm text-slate-500">{desc}</div>
      </div>
    </li>
  );
}

function ModalWrapper({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="font-black text-2xl tracking-tight text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-black">
            <X size={24}/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {children}
        </div>
      </div>
    </div>
  );
}