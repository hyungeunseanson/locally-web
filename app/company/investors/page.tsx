'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ArrowDown } from 'lucide-react';

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-6 py-24">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-24">
          Investors
        </h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-b border-black py-16 mb-24">
          {[
            { label: 'YoY Growth', value: '240%' },
            { label: 'Active Users', value: '1.2M+' },
            { label: 'Global Cities', value: '45' },
          ].map((metric, i) => (
            <div key={i} className="text-center md:text-left">
              <h3 className="text-6xl md:text-7xl font-black mb-2 tracking-tight">{metric.value}</h3>
              <p className="text-sm font-bold uppercase tracking-widest text-[#717171]">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Financial Reports */}
        <div>
          <h2 className="text-3xl font-bold mb-10">Financial Reports</h2>
          <div className="border-t border-black">
            {[2025, 2024, 2023].map((year) => (
              <div key={year} className="flex items-center justify-between py-8 border-b border-[#EBEBEB] group hover:bg-[#F9F9F9] -mx-4 px-4 transition-colors cursor-pointer">
                <div>
                  <span className="block text-xs font-bold text-[#717171] mb-1">FISCAL YEAR</span>
                  <span className="text-2xl font-bold group-hover:underline decoration-2 underline-offset-4">{year} Annual Report</span>
                </div>
                <div className="w-12 h-12 rounded-full border border-[#DDDDDD] flex items-center justify-center group-hover:bg-black group-hover:border-black transition-all">
                   <ArrowDown size={20} className="group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}