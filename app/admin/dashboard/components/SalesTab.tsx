'use client';

import React from 'react';
import { DollarSign, TrendingUp, CreditCard, Wallet } from 'lucide-react';

export default function SalesTab({ bookings }: { bookings: any[] }) {
  // 총 매출 계산
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
  // 이번 달 매출
  const currentMonth = new Date().getMonth();
  const monthRevenue = bookings
    .filter(b => new Date(b.created_at).getMonth() === currentMonth)
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 mb-8">
        <DollarSign size={32} className="text-yellow-500"/> 매출 및 정산 관리
      </h2>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard 
          icon={<Wallet size={24} className="text-white"/>} 
          bg="bg-slate-900" 
          label="총 누적 매출" 
          value={`₩${totalRevenue.toLocaleString()}`} 
        />
        <StatCard 
          icon={<TrendingUp size={24} className="text-white"/>} 
          bg="bg-blue-500" 
          label="이번 달 매출" 
          value={`₩${monthRevenue.toLocaleString()}`} 
        />
        <StatCard 
          icon={<CreditCard size={24} className="text-white"/>} 
          bg="bg-green-500" 
          label="정산 예정 금액 (수수료 제외)" 
          value={`₩${(totalRevenue * 0.8).toLocaleString()}`} 
        />
      </div>

      {/* 월별 매출 그래프 (간이 UI) */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-lg mb-6">월별 매출 추이</h3>
        <div className="h-40 flex items-end justify-between gap-2">
          {[40, 60, 30, 80, 50, 90, 100].map((h, i) => (
            <div key={i} className="w-full bg-blue-100 rounded-t-lg relative group hover:bg-blue-200 transition-colors" style={{ height: `${h}%` }}>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                ₩{(h * 100000).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400 font-bold uppercase">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, label, value }: any) {
  return (
    <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${bg}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-2xl font-black text-slate-900">{value}</div>
      </div>
    </div>
  );
}