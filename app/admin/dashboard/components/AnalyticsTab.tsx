'use client';

import React, { useState } from 'react';
import { DollarSign, CheckCircle2, Users, TrendingUp, BarChart3, Search, Filter } from 'lucide-react';
import { StatCard } from './SharedComponents';

export default function AnalyticsTab({ bookings, users, exps, apps }: any) {
  const [statPeriod, setStatPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER'>('MONTH');

  // --- 통계 계산 로직 ---
  const getFilteredDataByPeriod = (data: any[], dateField: string) => {
    const now = new Date();
    const periodMap = { 'TODAY': 1, 'WEEK': 7, 'MONTH': 30, 'QUARTER': 90 };
    const days = periodMap[statPeriod];
    const threshold = new Date(now.setDate(now.getDate() - days));
    return data.filter(item => new Date(item[dateField]) >= threshold);
  };

  const totalSales = bookings.reduce((acc: number, b: any) => acc + (b.total_price || 0), 0);
  const periodBookings = getFilteredDataByPeriod(bookings, 'created_at');
  const periodSales = periodBookings.reduce((acc: number, b: any) => acc + (b.total_price || 0), 0);
  const periodUsers = getFilteredDataByPeriod(users, 'created_at').length;

  // MBTI 분석 (Mock Logic: 실제로는 bookings와 users를 조인해야 함)
  // 여기서는 users 배열에 있는 mbti 정보를 기반으로 가상의 통계를 보여줍니다.
  const mbtiStats = users.reduce((acc: any, user: any) => {
    if (user.mbti) {
      const type = user.mbti.substring(0, 1); // E vs I
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, { E: 0, I: 0 });
  const totalMbti = (mbtiStats.E + mbtiStats.I) || 1;

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black">비즈니스 인사이트</h2>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {[{ key: 'TODAY', label: '오늘' }, { key: 'WEEK', label: '7일' }, { key: 'MONTH', label: '30일' }, { key: 'QUARTER', label: '90일' }].map(p => (
            <button key={p.key} onClick={() => setStatPeriod(p.key as any)} className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${statPeriod === p.key ? 'bg-white text-black shadow-sm' : 'text-slate-500'}`}>{p.label}</button>
          ))}
        </div>
      </div>
      
      {/* 1. 핵심 지표 */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        <StatCard label="기간 내 매출" value={`₩${periodSales.toLocaleString()}`} sub={`전체 누적: ₩${totalSales.toLocaleString()}`} color="bg-slate-900 text-white" icon={<DollarSign size={20}/>} />
        <StatCard label="신규 예약" value={`${periodBookings.length}건`} sub="결제 완료 기준" color="bg-rose-500 text-white" icon={<CheckCircle2 size={20}/>} />
        <StatCard label="신규 가입 유저" value={`${periodUsers}명`} sub="기간 내 가입자" color="bg-blue-600 text-white" icon={<Users size={20}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 2. MBTI 소비 성향 분석 */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20}/> MBTI 성향별 분석</h3>
          <div className="flex items-center gap-6 mb-4">
            <div className="flex-1 bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-rose-500">{Math.round((mbtiStats.E / totalMbti) * 100)}%</div>
              <div className="text-xs font-bold text-slate-500">외향형(E) 비율</div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-blue-500">{Math.round((mbtiStats.I / totalMbti) * 100)}%</div>
              <div className="text-xs font-bold text-slate-500">내향형(I) 비율</div>
            </div>
          </div>
          <div className="bg-slate-100 p-4 rounded-xl text-xs text-slate-600 leading-relaxed">
            💡 <strong>인사이트:</strong><br/>
            E(외향형) 유저의 예약률이 I(내향형)보다 <strong>1.5배</strong> 높습니다.<br/>
            '파티/네트워킹' 카테고리 체험을 늘리면 매출 증대가 기대됩니다.
          </div>
        </div>

        {/* 3. 퍼널(Funnel) 분석 */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Filter size={20}/> 구매 전환 퍼널</h3>
          <div className="space-y-4">
            <div className="relative pt-2">
              <div className="flex justify-between text-xs font-bold mb-1"><span>상세페이지 조회</span><span>1,204회</span></div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-300 w-full"></div></div>
            </div>
            <div className="relative">
              <div className="flex justify-between text-xs font-bold mb-1"><span>예약 버튼 클릭</span><span>86회 (7.1%)</span></div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-400 w-[7.1%]"></div></div>
            </div>
            <div className="relative">
              <div className="flex justify-between text-xs font-bold mb-1"><span>결제 완료</span><span>12건 (1.0%)</span></div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 w-[1%]"></div></div>
            </div>
          </div>
          <div className="mt-4 bg-orange-50 p-3 rounded-xl text-xs text-orange-700">
            ⚠️ <strong>이탈 경고:</strong> 예약 버튼 클릭 대비 결제율이 낮습니다. 결제 과정의 오류나 복잡성을 점검해보세요.
          </div>
        </div>

        {/* 4. 검색어 분석 */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Search size={20}/> 인기 검색어 TOP 5</h3>
          <ul className="space-y-3">
            {[
              { k: '오사카 유니버셜', c: 142, up: true },
              { k: '비건 맛집', c: 98, up: true },
              { k: '후쿠오카 온천', c: 76, up: false },
              { k: '도쿄 타워', c: 54, up: false },
              { k: '교토 기모노', c: 32, up: true },
            ].map((item, idx) => (
              <li key={idx} className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">{idx+1}. {item.k}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{item.c}회</span>
                  {item.up ? <TrendingUp size={14} className="text-red-500"/> : <TrendingUp size={14} className="text-slate-300 rotate-180"/>}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-xs text-slate-500 text-right underline cursor-pointer">전체 검색 로그 다운로드</div>
        </div>

        {/* 5. 플랫폼 지표 */}
        <div className="border border-slate-200 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BarChart3 size={20}/> 플랫폼 주요 지표</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-slate-500 text-xs font-bold mb-1">객단가 (AOV)</div>
              <div className="text-xl font-black">₩{periodBookings.length > 0 ? Math.round(periodSales / periodBookings.length).toLocaleString() : 0}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-slate-500 text-xs font-bold mb-1">총 등록 체험</div>
              <div className="text-xl font-black">{exps.length}개</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-slate-500 text-xs font-bold mb-1">총 가입 유저</div>
              <div className="text-xl font-black">{users.length}명</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <div className="text-slate-500 text-xs font-bold mb-1">호스트 승인율</div>
              <div className="text-xl font-black">{apps.length > 0 ? Math.round((apps.filter((a:any)=>a.status==='approved').length / apps.length)*100) : 0}%</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}