'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';

export default function InvestorsPage() {
  const reportYears = [2025, 2024, 2023];

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
          <p
            data-testid="company-investors-availability-note"
            className="mb-6 text-sm font-medium text-[#717171]"
          >
            Downloadable annual reports will be published here once each reporting package is finalized.
          </p>
          <div className="border-t border-black">
            {reportYears.map((year) => (
              <div
                key={year}
                data-testid="company-investor-report-row"
                className="flex items-center justify-between py-8 border-b border-[#EBEBEB] -mx-4 px-4"
              >
                <div>
                  <span className="block text-xs font-bold text-[#717171] mb-1">FISCAL YEAR</span>
                  <span className="text-2xl font-bold">{year} Annual Report</span>
                </div>
                <span className="inline-flex items-center rounded-full border border-[#DDDDDD] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#717171]">
                  Available soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
