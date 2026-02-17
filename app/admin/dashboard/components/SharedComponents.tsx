'use client';

import React from 'react';

// 1. 네비게이션 버튼 (사이드바용)
export function NavButton({ active, onClick, icon, label, count }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
        active 
          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {count !== undefined && count !== 0 && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// 2. 통계 카드 (대시보드 상단용) - Hover 효과 강화
export function StatCard({ label, value, sub, color, icon, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-2xl shadow-lg relative overflow-hidden transition-all duration-300 ${color} ${
        onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-95' : ''
      }`}
    >
      {/* 배경 패턴 (은은하게) */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
      
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <div className="text-xs font-bold opacity-80 mb-1 tracking-wide uppercase">{label}</div>
          <div className="text-3xl font-black tracking-tight">{value}</div>
          {sub && <div className="text-[11px] mt-2 opacity-70 font-medium flex items-center gap-1">{sub}</div>}
        </div>
        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md shadow-inner text-white/90">
          {icon}
        </div>
      </div>
    </div>
  );
}

// 3. 정보 행 (상세 패널용)
export function InfoRow({ label, value, isCopyable, onCopy }: any) {
  return (
    <div className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors -mx-2">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <span 
        className={`text-sm font-medium text-slate-800 ${isCopyable ? 'cursor-pointer hover:text-rose-500 flex items-center gap-1' : ''}`}
        onClick={isCopyable ? onCopy : undefined}
        title={isCopyable ? '클릭하여 복사' : ''}
      >
        {value || '-'}
      </span>
    </div>
  );
}

// 4. 상태 배지 (공통 사용)
export function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  
  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    approved: 'bg-blue-50 text-blue-600 border-blue-100',
    active: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rejected: 'bg-red-50 text-red-600 border-red-100',
    revision: 'bg-orange-50 text-orange-600 border-orange-100',
    confirmed: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    paid: 'bg-green-50 text-green-700 border-green-100',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
  };

  const style = styles[s] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
      {status?.toUpperCase()}
    </span>
  );
}