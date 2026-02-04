'use client';

import React, { useState, useMemo } from 'react';
import { 
  DollarSign, CheckCircle2, Users, TrendingUp, BarChart3, 
  Search, Filter, X, Award, Repeat, Crown, ArrowUpRight, 
  Calendar, Zap, Map, AlertTriangle
} from 'lucide-react';
import { StatCard } from './SharedComponents';

export default function AnalyticsTab({ bookings, users, exps, apps }: any) {
  const [statPeriod, setStatPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER'>('MONTH');
  
  // 모달 상태 (어떤 상세 분석을 띄울지 결정)
  const [activeModal, setActiveModal] = useState<
    'VIP_INSIGHTS' | 'RETENTION_DETAIL' | 'REVENUE_BREAKDOWN' | 
    'MBTI_ANALYSIS' | 'SEARCH_LOG' | 'FUNNEL_ANALYSIS' | 
    'LEAD_TIME' | 'BENCHMARK' | null
  >(null);

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
  const metrics = useMemo(() => {
    // 유저별 통계 집계
    const userStats: Record<string, { id: string, name: string, email: string, ltv: number, bookingCount: number, mbti: string }> = {};

    bookings.forEach((b: any) => {
      const uid = b.user_id;
      if (!userStats[uid]) {
        const profile = users.find((u:any) => u.id === uid) || { full_name: 'Unknown', email: '-', mbti: '' };
        userStats[uid] = { 
          id: uid, name: profile.full_name, email: profile.email, 
          ltv: 0, bookingCount: 0, mbti: profile.mbti 
        };
      }
      userStats[uid].ltv += (b.total_price || 0);
      userStats[uid].bookingCount += 1;
    });

    const userList = Object.values(userStats);
    const totalPayers = userList.length;
    
    // Retention (재구매율)
    const returningUsers = userList.filter(u => u.bookingCount > 1).length;
    const retentionRate = totalPayers > 0 ? Math.round((returningUsers / totalPayers) * 100) : 0;

    // VIP List
    const vipList = [...userList].sort((a, b) => b.ltv - a.ltv).slice(0, 10);

    // MBTI Stats (가상 데이터 + 실제 데이터 혼합)
    const mbtiCounts = { E: 0, I: 0, P: 0, J: 0 };
    userList.forEach(u => {
      if (u.mbti) {
        if (u.mbti.includes('E')) mbtiCounts.E++;
        if (u.mbti.includes('I')) mbtiCounts.I++;
        if (u.mbti.includes('P')) mbtiCounts.P++;
        if (u.mbti.includes('J')) mbtiCounts.J++;
      }
    });

    return { userList, retentionRate, returningUsers, vipList, mbtiCounts, totalPayers };
  }, [bookings, users, periodBookings]);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto relative h-full">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">비즈니스 인텔리전스 (Business Intelligence)</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">데이터 기반 의사결정을 위한 핵심 지표 (KPI)</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {[{ k: 'TODAY', l: '오늘 (Today)' }, { k: 'WEEK', l: '7일 (Week)' }, { k: 'MONTH', l: '30일 (Month)' }, { k: 'QUARTER', l: '분기 (Quarter)' }].map(p => (
            <button key={p.k} onClick={() => setStatPeriod(p.k as any)} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${statPeriod === p.k ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{p.l}</button>
          ))}
        </div>
      </div>
      
      {/* 1. Key Metrics (상단 카드) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          label="기간 내 매출 (Revenue)" 
          value={`₩${periodRevenue.toLocaleString()}`} 
          sub={`누적 매출 (Total): ₩${totalRevenue.toLocaleString()}`}
          color="bg-slate-900 text-white" 
          icon={<DollarSign size={22}/>} 
          onClick={() => setActiveModal('REVENUE_BREAKDOWN')}
        />
        <StatCard 
          label="재구매율 (Retention Rate)" 
          value={`${metrics.retentionRate}%`} 
          sub={`재방문 유저: ${metrics.returningUsers}명`} 
          color="bg-blue-600 text-white" 
          icon={<Repeat size={22}/>} 
          onClick={() => setActiveModal('RETENTION_DETAIL')}
        />
        <StatCard 
          label="VIP 고객 (High LTV Users)" 
          value={`${metrics.vipList.length}명`} 
          sub="상위 1% 매출 기여 고객" 
          color="bg-indigo-600 text-white" 
          icon={<Crown size={22}/>} 
          onClick={() => setActiveModal('VIP_INSIGHTS')}
        />
      </div>

      {/* 2. Advanced Analysis Grid (중단 카드) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* A. MBTI 분석 */}
        <div onClick={() => setActiveModal('MBTI_ANALYSIS')} className="border border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all group">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
            <Users size={20} className="text-indigo-500"/> MBTI 성향별 소비 패턴 (Personality Analysis)
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors ml-auto"/>
          </h3>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-indigo-50 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-indigo-600">E {metrics.mbtiCounts.E > metrics.mbtiCounts.I ? '>' : '<'} I</div>
              <div className="text-xs font-bold text-slate-500 mt-1">외향형 vs 내향형</div>
            </div>
            <div className="flex-1 bg-rose-50 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-rose-600">P {metrics.mbtiCounts.P > metrics.mbtiCounts.J ? '>' : '<'} J</div>
              <div className="text-xs font-bold text-slate-500 mt-1">즉흥형 vs 계획형</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 line-clamp-1">🔍 클릭하여 성향별 선호 카테고리 및 예약 시점 분석 보기</p>
        </div>

        {/* B. 검색어 유입 분석 */}
        <div onClick={() => setActiveModal('SEARCH_LOG')} className="border border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-black hover:shadow-md transition-all group">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
            <Search size={20} className="text-slate-700"/> 검색어 유입 & 기회 (Search Keywords)
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-black transition-colors ml-auto"/>
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-slate-700">1. 오사카 유니버셜</span>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">142회</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-rose-600 flex items-center gap-1"><AlertTriangle size={12}/> 2. 비건 (Vegan)</span>
              <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-xs font-bold">98회 (결과 없음)</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4">🔍 클릭하여 '결과 없음' 키워드 및 검색 트렌드 전체 보기</p>
        </div>

        {/* C. 퍼널 분석 */}
        <div onClick={() => setActiveModal('FUNNEL_ANALYSIS')} className="border border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
            <Filter size={20} className="text-blue-500"/> 구매 전환 퍼널 (Conversion Funnel)
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors ml-auto"/>
          </h3>
          <div className="space-y-2">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-300 w-full"></div></div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 w-[60%]"></div></div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 w-[15%]"></div></div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>조회 (100%)</span>
            <span>장바구니 (60%)</span>
            <span className="font-bold text-blue-600">결제 (15%)</span>
          </div>
        </div>

        {/* D. 호스트/플랫폼 벤치마크 */}
        <div onClick={() => setActiveModal('BENCHMARK')} className="border border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-green-500 hover:shadow-md transition-all group">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
            <BarChart3 size={20} className="text-green-600"/> 플랫폼 벤치마크 (Benchmarks)
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-green-600 transition-colors ml-auto"/>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Avg. Lead Time</div>
              <div className="text-xl font-black text-slate-900">24일</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Avg. Conversion</div>
              <div className="text-xl font-black text-slate-900">3.2%</div>
            </div>
          </div>
        </div>

      </div>


      {/* ========== ✨ Interactive Detail Modals (Popups) ========== */}
      
      {/* 1. VIP Insights */}
      {activeModal === 'VIP_INSIGHTS' && (
        <ModalWrapper title="👑 VIP & High-Value Customers (LTV)" onClose={() => setActiveModal(null)}>
          <div className="mb-6 bg-indigo-50 p-4 rounded-xl text-indigo-900 text-sm leading-relaxed border border-indigo-100">
            <strong>💡 Insight:</strong> 상위 1% 고객이 전체 매출의 30%를 차지합니다.<br/>
            이들은 주로 <strong>'프라이빗 투어'</strong>를 선호하며, 평균 객단가가 일반 유저보다 <strong>4배</strong> 높습니다.
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
              <tr>
                <th className="p-4 rounded-tl-lg">Rank</th>
                <th className="p-4">Customer Info</th>
                <th className="p-4 text-right">LTV (생애가치)</th>
                <th className="p-4 text-center">Visits</th>
                <th className="p-4 rounded-tr-lg">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.vipList.map((user, idx) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-black text-slate-400">{idx + 1}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{user.name || 'Anonymous'}</div>
                    <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                  </td>
                  <td className="p-4 text-right font-bold text-slate-900">₩{user.ltv.toLocaleString()}</td>
                  <td className="p-4 text-center"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{user.bookingCount}회</span></td>
                  <td className="p-4">
                    {idx === 0 ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">VVIP</span> :
                     <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">Platinum</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalWrapper>
      )}

      {/* 2. MBTI Analysis */}
      {activeModal === 'MBTI_ANALYSIS' && (
        <ModalWrapper title="🧠 MBTI 성향별 소비 패턴 (Psychographics)" onClose={() => setActiveModal(null)}>
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎉</span>
                <h4 className="font-bold text-rose-900">E (외향형) 타겟 전략</h4>
              </div>
              <p className="text-sm text-rose-800 leading-relaxed mb-4">
                '파티/술/네트워킹' 카테고리 예약률이 <strong>30%</strong> 더 높습니다.<br/>
                주로 <strong>그룹 투어</strong>를 선호하며, 사진 리뷰를 남길 확률이 높습니다.
              </p>
              <div className="bg-white/60 p-3 rounded-lg text-xs font-bold text-rose-700">👉 추천 액션: '서울 펍 크롤링' 체험 할인 푸시 발송</div>
            </div>
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🧘</span>
                <h4 className="font-bold text-blue-900">I (내향형) 타겟 전략</h4>
              </div>
              <p className="text-sm text-blue-800 leading-relaxed mb-4">
                '힐링/산책/원데이클래스' 카테고리를 선호합니다.<br/>
                <strong>1인 예약</strong> 비중이 높으며, 상세페이지 체류 시간이 깁니다.
              </p>
              <div className="bg-white/60 p-3 rounded-lg text-xs font-bold text-blue-700">👉 추천 액션: '조용한 북촌 찻집' 체험 추천 메일 발송</div>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-6">
            <h4 className="font-bold mb-4 text-slate-800 flex items-center gap-2"><Clock size={18}/> 예약 리드타임 분석 (J vs P)</h4>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex justify-between bg-slate-50 p-3 rounded-lg">
                <span><strong>J (계획형)</strong>: 여행 3주 전 예약 완료</span>
                <span className="text-slate-500">얼리버드 할인에 민감함</span>
              </li>
              <li className="flex justify-between bg-slate-50 p-3 rounded-lg">
                <span><strong>P (즉흥형)</strong>: 여행 2일 전 ~ 당일 예약</span>
                <span className="text-rose-500 font-bold">마감 임박 상품 타겟팅 필요</span>
              </li>
            </ul>
          </div>
        </ModalWrapper>
      )}

      {/* 3. Search Log Analysis */}
      {activeModal === 'SEARCH_LOG' && (
        <ModalWrapper title="🔍 검색어 유입 분석 & 기회 (Search Opportunities)" onClose={() => setActiveModal(null)}>
          <div className="mb-6 bg-yellow-50 p-4 rounded-xl text-yellow-900 text-sm leading-relaxed border border-yellow-100 flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 mt-0.5"/>
            <div>
              <strong>기회 포착 (Opportunity):</strong><br/>
              '비건(Vegan)'과 '오사카' 검색량이 급증하고 있지만, 해당 지역의 예약 전환율이 10% 미만입니다.<br/>
              이는 <strong>공급 부족(호스트 부족)</strong>을 의미합니다. 해당 지역 호스트를 섭외하세요.
            </div>
          </div>
          
          <h4 className="font-bold text-sm mb-3 text-slate-500 uppercase">Top Keywords (Last 30 Days)</h4>
          <div className="space-y-2">
            {[
              { k: '오사카 유니버셜', c: 142, rate: '4.5%', note: '높은 전환율' },
              { k: '비건 맛집', c: 98, rate: '0.0%', note: '🚨 체험 없음 (공급 필요)' },
              { k: '후쿠오카 온천', c: 76, rate: '2.1%', note: '평균 수준' },
              { k: '도쿄 타워', c: 54, rate: '1.5%', note: '낮은 전환율' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-400 w-4">{idx+1}</span>
                  <span className="font-bold text-slate-900">{item.k}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-slate-500">{item.c}회 검색</span>
                  <span className={`font-bold ${item.rate === '0.0%' ? 'text-rose-500' : 'text-green-600'}`}>전환율 {item.rate}</span>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 w-24 text-center">{item.note}</span>
                </div>
              </div>
            ))}
          </div>
        </ModalWrapper>
      )}

      {/* 4. Funnel Analysis */}
      {activeModal === 'FUNNEL_ANALYSIS' && (
        <ModalWrapper title="📉 구매 전환 퍼널 (Conversion Funnel Analysis)" onClose={() => setActiveModal(null)}>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h4 className="font-bold mb-6 text-slate-800">단계별 이탈률 (Drop-off Rate)</h4>
              <div className="space-y-6">
                <FunnelStep step="1. 상세페이지 조회" count="1,204" rate="100%" color="bg-slate-300" drop="-" />
                <FunnelStep step="2. 예약 버튼 클릭" count="86" rate="7.1%" color="bg-slate-400" drop="92.9% 이탈 📉" />
                <FunnelStep step="3. 결제 완료" count="12" rate="1.0%" color="bg-rose-500" drop="86% 이탈 (심각)" />
              </div>
            </div>
            
            <div className="bg-slate-900 text-white p-6 rounded-xl">
              <h4 className="font-bold mb-2 text-rose-400">🚨 긴급 점검 필요</h4>
              <p className="text-sm opacity-90 leading-relaxed mb-4">
                <strong>'예약 버튼 클릭 -> 결제 완료'</strong> 단계에서 86%가 이탈하고 있습니다.<br/>
                결제 페이지 로딩 속도가 느리거나, 회원가입 강제 절차가 원인일 수 있습니다.
              </p>
              <div className="flex gap-2">
                <button className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200">결제 프로세스 점검하기</button>
                <button className="border border-white/30 px-4 py-2 rounded-lg text-xs font-bold hover:bg-white/10">비회원 주문 설정</button>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* 5. Retention Detail */}
      {activeModal === 'RETENTION_DETAIL' && (
        <ModalWrapper title="🔄 재구매율 & 코호트 분석 (Retention)" onClose={() => setActiveModal(null)}>
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-2xl text-center border border-blue-100">
              <div className="text-sm font-bold text-blue-800 mb-1">Total Payers</div>
              <div className="text-3xl font-black text-blue-900">{metrics.totalPayers}명</div>
              <div className="text-xs text-blue-600 mt-2">전체 구매 유저</div>
            </div>
            <div className="bg-green-50 p-6 rounded-2xl text-center border border-green-100">
              <div className="text-sm font-bold text-green-800 mb-1">Returning Users</div>
              <div className="text-3xl font-black text-green-900">{metrics.returningUsers}명</div>
              <div className="text-xs text-green-600 mt-2">2회 이상 구매</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h4 className="font-bold text-lg mb-4">💡 리텐션 증대 전략</h4>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-3 items-start"><CheckCircle2 size={16} className="text-green-500 mt-0.5"/> <span>첫 구매 후 <strong>30일 이내</strong> 재구매 시 10% 할인 쿠폰 자동 발송</span></li>
              <li className="flex gap-3 items-start"><CheckCircle2 size={16} className="text-green-500 mt-0.5"/> <span>최근 90일간 방문 없는 유저에게 <strong>'웰컴백' 푸시 알림</strong> 전송</span></li>
            </ul>
          </div>
        </ModalWrapper>
      )}

      {/* 6. Revenue Breakdown */}
      {activeModal === 'REVENUE_BREAKDOWN' && (
        <ModalWrapper title="💰 매출 상세 분석 (Revenue Breakdown)" onClose={() => setActiveModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="p-4">거래 일자 (Date)</th>
                  <th className="p-4">체험명 (Experience)</th>
                  <th className="p-4 text-right">금액 (Amount)</th>
                  <th className="p-4 text-right">상태 (Status)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodBookings.length > 0 ? periodBookings.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-4 text-slate-500">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-slate-800">{b.experiences?.title || '삭제된 체험'}</td>
                    <td className="p-4 text-right font-medium">₩{b.total_price?.toLocaleString()}</td>
                    <td className="p-4 text-right"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">PAID</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">해당 기간의 매출 데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ModalWrapper>
      )}

      {/* 7. Benchmark */}
      {activeModal === 'BENCHMARK' && (
        <ModalWrapper title="📊 플랫폼 벤치마크 (Benchmarks)" onClose={() => setActiveModal(null)}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <div className="text-xs text-slate-500 font-bold uppercase mb-1">Avg. Lead Time</div>
                <div className="text-2xl font-black text-slate-900">24.5일</div>
                <div className="text-xs text-slate-400 mt-1">평균 예약 리드타임</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <div className="text-xs text-slate-500 font-bold uppercase mb-1">Avg. Conversion</div>
                <div className="text-2xl font-black text-slate-900">3.2%</div>
                <div className="text-xs text-slate-400 mt-1">평균 구매 전환율</div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-xl">
              <h4 className="font-bold mb-4">카테고리별 예약률 순위</h4>
              <div className="space-y-3">
                {[
                  { n: '미식/맛집 투어', p: 45 },
                  { n: '야경/나이트라이프', p: 28 },
                  { n: '문화/역사 탐방', p: 15 },
                  { n: '아웃도어/액티비티', p: 12 },
                ].map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1 font-medium"><span>{c.n}</span><span>{c.p}%</span></div>
                    <div className="w-full h-2 bg-slate-100 rounded-full"><div className="h-full bg-slate-800 rounded-full" style={{width: `${c.p}%`}}></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

    </div>
  );
}

// --- Internal Helper Components ---

function FunnelStep({ step, count, rate, color, drop }: any) {
  return (
    <div className="relative">
      <div className="flex justify-between text-xs font-bold mb-1 text-slate-700">
        <span>{step}</span>
        <span>{count} ({rate})</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: rate }}></div>
      </div>
      <div className="text-[10px] text-right text-slate-400 mt-1">{drop}</div>
    </div>
  );
}

function ModalWrapper({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="font-black text-xl tracking-tight text-slate-900">{title}</h3>
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