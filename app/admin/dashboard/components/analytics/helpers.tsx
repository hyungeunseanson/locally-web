'use client';

export function SimpleKpi({ label, value, unit, className, sub, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`p-4 md:p-5 bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm transition-all flex flex-col justify-between h-28 md:h-32 ${onClick ? 'cursor-pointer hover:border-slate-400 hover:shadow-md' : ''}`}
    >
      <div className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between gap-1">
        <span className="truncate">{label}</span>
        {sub && (
          <span className="text-[8px] md:text-[10px] text-slate-300 normal-case bg-slate-50 px-1 md:px-1.5 py-0.5 rounded whitespace-nowrap">
            {sub}
          </span>
        )}
      </div>
      <div className={`text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-auto truncate ${className}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span className="text-xs md:text-sm font-medium text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

export function FunnelBar({ label, value, max, isFinal, color }: any) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 md:gap-4 group">
      <div className="w-16 md:w-20 text-[10px] md:text-xs font-bold text-slate-500 text-right">{label}</div>
      <div className="flex-1 h-8 md:h-10 bg-slate-50 rounded-lg md:rounded-xl overflow-hidden relative">
        <div
          className={`h-full absolute top-0 left-0 transition-all duration-1000 ${color}`}
          style={{ width: `${Math.max(percent, 2)}%` }}
        ></div>
        <div
          className={`absolute top-0 left-2 md:left-3 h-full flex items-center text-xs md:text-sm font-bold ${isFinal && percent > 20 ? 'text-white' : 'text-slate-700'}`}
        >
          {value.toLocaleString()}
        </div>
      </div>
      <div className="w-10 md:w-14 text-right text-xs md:text-sm font-mono text-slate-400 group-hover:text-slate-900 transition-colors">
        {percent.toFixed(1)}%
      </div>
    </div>
  );
}

export function SimpleBar({ label, val, max }: any) {
  const percent = max > 0 ? (val / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold w-24 text-slate-600">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${percent}%` }}></div>
      </div>
      <span className="text-xs font-mono w-10 text-right">{val}건</span>
    </div>
  );
}
