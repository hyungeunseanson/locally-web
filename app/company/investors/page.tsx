'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      <div className="flex-1 max-w-4xl mx-auto px-6 py-20 w-full">
        <h1 className="text-3xl font-black mb-4">Investor Relations</h1>
        <p className="text-slate-500 mb-12">로컬리의 재무 정보와 공시 자료를 확인하실 수 있습니다.</p>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="p-8 bg-slate-50 rounded-3xl">
            <h3 className="text-4xl font-black mb-2">200%</h3>
            <p className="text-slate-500 font-medium">YoY Growth Rate</p>
          </div>
          <div className="p-8 bg-slate-50 rounded-3xl">
            <h3 className="text-4xl font-black mb-2">150K+</h3>
            <p className="text-slate-500 font-medium">Active Monthly Users</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-6">IR 자료실</h2>
        <div className="space-y-4">
          {[2025, 2024, 2023].map((year) => (
            <div key={year} className="flex items-center justify-between p-5 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
              <span className="font-bold">FY {year} Earnings Release</span>
              <button className="text-sm font-bold text-blue-600 hover:underline">Download PDF</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}