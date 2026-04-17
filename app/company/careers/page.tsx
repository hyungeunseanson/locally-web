'use client';

import React from 'react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';

const JOBS = [
  { title: 'Senior Product Designer', team: 'Design', loc: 'Seoul' },
  { title: 'Frontend Engineer (Next.js)', team: 'Engineering', loc: 'Seoul' },
  { title: 'Global Operations Manager', team: 'Operations', loc: 'Tokyo' },
  { title: 'Customer Success Lead', team: 'CX', loc: 'Remote' },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[1040px] mx-auto px-6 py-24">
        <div className="mb-32">
          <span className="block text-sm font-bold uppercase tracking-widest mb-4">Careers at Locally</span>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
            Build the<br/>future of travel.
          </h1>
          <p className="text-xl text-[#717171] font-medium max-w-2xl leading-relaxed">
            로컬 경험과 여행 운영을 더 단단하게 연결할 팀을 준비하고 있습니다.<br/>
            공식 채용 공고는 오픈되는 역할만 순차적으로 공개합니다.
          </p>
        </div>

        <section
          data-testid="company-careers-status-banner"
          className="mb-12 rounded-[28px] border border-[#E5E7EB] bg-[#F8FAFC] px-6 py-6 md:px-8 md:py-8"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#475569]">
            Hiring preview only
          </p>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-[#111827] md:text-2xl">
            Application links are published only when a role officially opens.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B] md:text-base">
            The roles below are planned hiring directions, not active job postings. Until a team
            opens a search, this page stays read-only without direct apply links.
          </p>
          <Link
            href="/about"
            data-testid="company-careers-about-cta"
            className="mt-5 inline-flex items-center rounded-full border border-[#CBD5E1] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F1F5F9]"
          >
            Learn about Locally
          </Link>
        </section>

        <div>
          <div className="flex justify-between items-end border-b border-black pb-4 mb-0">
            <h2 className="text-2xl font-bold">Upcoming Roles</h2>
            <span className="text-sm font-bold">{JOBS.length} Planned Roles</span>
          </div>
          
          <div className="divide-y divide-[#EBEBEB]">
            {JOBS.map((job, i) => (
              <article
                key={i}
                data-testid="company-career-role"
                className="py-10 flex items-center justify-between -mx-4 px-4"
              >
                <div>
                  <h3 className="text-2xl font-bold mb-2">{job.title}</h3>
                  <div className="flex gap-3 text-sm font-medium text-[#717171]">
                    <span>{job.team}</span>
                    <span>·</span>
                    <span>{job.loc}</span>
                  </div>
                  <p
                    data-testid="company-career-role-status"
                    className="mt-3 text-xs font-medium tracking-wide text-[#717171] md:text-sm"
                  >
                    Application link pending role launch
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-[#DDDDDD] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#717171]">
                  Hiring opens soon
                </span>
              </article>
            ))}
          </div>

          <p
            data-testid="company-careers-availability-note"
            className="mt-8 text-sm font-medium text-[#717171]"
          >
            채용 공고와 지원 링크는 역할별 검토와 운영 담당 확정이 끝난 뒤 이 페이지에 순차적으로 공개됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
