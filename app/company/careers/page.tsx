'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { ArrowUpRight } from 'lucide-react';

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
            우리는 여행의 방식을 재정의하고 있습니다.<br/>
            전 세계를 무대로 도전하고 싶은 분들을 기다립니다.
          </p>
        </div>

        <div>
          <div className="flex justify-between items-end border-b border-black pb-4 mb-0">
            <h2 className="text-2xl font-bold">Open Positions</h2>
            <span className="text-sm font-bold">{JOBS.length} Roles</span>
          </div>
          
          <div className="divide-y divide-[#EBEBEB]">
            {JOBS.map((job, i) => (
              <a key={i} href="#" className="group py-10 flex items-center justify-between hover:bg-[#F9F9F9] -mx-4 px-4 transition-colors">
                <div>
                  <h3 className="text-2xl font-bold mb-2 group-hover:underline decoration-2 underline-offset-4">{job.title}</h3>
                  <div className="flex gap-3 text-sm font-medium text-[#717171]">
                    <span>{job.team}</span>
                    <span>·</span>
                    <span>{job.loc}</span>
                  </div>
                </div>
                <ArrowUpRight size={24} className="text-gray-300 group-hover:text-black transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}