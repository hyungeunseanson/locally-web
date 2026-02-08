'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SearchFilterProps {
  label: string;
}

export default function SearchFilter({ label }: SearchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all
          ${isOpen ? 'border-black bg-slate-50' : 'border-slate-200 bg-white hover:border-black'}`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 필터 드롭다운 (예시: 가격 범위) */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[300px] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] p-6 border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-200">
          <h5 className="font-bold mb-4 text-sm">{label} 설정</h5>
          
          {/* 가격 슬라이더 Placeholder */}
          <div className="space-y-4">
            <div className="h-1 bg-slate-200 rounded-full relative">
              <div className="absolute left-0 top-0 h-full w-1/2 bg-black rounded-full"></div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 shadow-md rounded-full cursor-pointer"></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <div className="border border-slate-200 rounded-lg px-3 py-2 w-24">
                <span className="block text-[10px]">최소 가격</span>
                <span className="font-bold text-black">₩10,000</span>
              </div>
              <div className="border border-slate-200 rounded-lg px-3 py-2 w-24">
                <span className="block text-[10px]">최대 가격</span>
                <span className="font-bold text-black">₩250,000+</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
            <button className="text-xs font-bold text-slate-500 underline" onClick={() => setIsOpen(false)}>지우기</button>
            <button className="bg-black text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-800" onClick={() => setIsOpen(false)}>저장하기</button>
          </div>
        </div>
      )}
    </div>
  );
}