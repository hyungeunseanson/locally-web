'use client';

import React from 'react';

export function NavButton({ active, onClick, icon, label, count }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors text-sm ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
      {icon} <span>{label}</span>
      {count > 0 && <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

// ✅ 수정됨: onClick 지원 및 인터랙티브 스타일 추가 (hover 효과)
export function StatCard({ label, value, sub, color, icon, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-2xl shadow-lg relative overflow-hidden ${color} ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all active:scale-95' : ''}`}
    >
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <div className="text-xs font-bold opacity-80 mb-1 tracking-wide uppercase">{label}</div>
          <div className="text-3xl font-black tracking-tight">{value}</div>
          {sub && <div className="text-[11px] mt-2 opacity-70 font-medium">{sub}</div>}
        </div>
        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function InfoRow({ label, value }: any) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}