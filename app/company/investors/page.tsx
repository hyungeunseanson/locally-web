'use client';

import React from 'react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';

export default function InvestorsPage() {
  const reportYears = [2025, 2024, 2023];
  const previewMetrics = [
    { label: 'Metrics Pack', value: 'TBD' },
    { label: 'User KPI', value: 'Draft' },
    { label: 'Market Map', value: 'Review' },
  ] as const;

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-6 py-24">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-12">
          Investors
        </h1>

        <section
          data-testid="company-investors-status-banner"
          className="mb-12 rounded-[28px] border border-[#E5E7EB] bg-[#F8FAFC] px-6 py-6 md:px-8 md:py-8"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#475569]">
            Investor preview only
          </p>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-[#111827] md:text-2xl">
            Official reports and verified investor materials publish only after release.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B] md:text-base">
            Until a reporting package is finalized, this page stays read-only. The snapshot below is
            for directional preview only and does not yet represent downloadable investor assets.
          </p>
          <Link
            href="/company/notices"
            data-testid="company-investors-notices-cta"
            className="mt-5 inline-flex items-center rounded-full border border-[#CBD5E1] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F1F5F9]"
          >
            View company notices
          </Link>
        </section>

        {/* Key Metrics */}
        <div className="mb-24">
          <p
            data-testid="company-investors-metrics-note"
            className="mb-6 text-sm font-medium text-[#717171]"
          >
            Preview snapshot only. Placeholder status cards stay here until verified investor-facing
            figures are approved for publication.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-b border-black py-16">
            {previewMetrics.map((metric, i) => (
              <div key={i} className="text-center md:text-left">
                <h3 className="text-6xl md:text-7xl font-black mb-2 tracking-tight">{metric.value}</h3>
                <p className="text-sm font-bold uppercase tracking-widest text-[#717171]">{metric.label}</p>
                <p
                  data-testid="company-investor-metric-status"
                  className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]"
                >
                  Preview only
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Reports */}
        <div>
          <h2 className="text-3xl font-bold mb-10">Financial Reports</h2>
          <p
            data-testid="company-investors-availability-note"
            className="mb-6 text-sm font-medium text-[#717171]"
          >
            Official downloadable annual reports will appear here only after each reporting package is
            approved for publication and linked by the operating owner.
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
                <span
                  data-testid="company-investor-report-status"
                  className="inline-flex items-center rounded-full border border-[#DDDDDD] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#717171]"
                >
                  Publication pending
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
