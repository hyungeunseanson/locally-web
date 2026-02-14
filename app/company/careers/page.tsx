'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import { ArrowRight } from 'lucide-react';

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      <div className="bg-black text-white py-24 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-black mb-6">Join the Team</h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
          여행의 미래를 함께 만들어갈 동료를 찾습니다. <br/>
          로컬리와 함께 전 세계를 연결하는 여정에 합류하세요.
        </p>
      </div>

      <div className="flex-1 max-w-4xl mx-auto px-6 py-20 w-full">
        <h2 className="text-2xl font-bold mb-8">진행 중인 채용 공고</h2>
        <div className="space-y-4">
          {['Senior Frontend Engineer', 'Product Designer', 'Global Marketing Manager', 'Customer Success Lead'].map((job, i) => (
            <div key={i} className="flex justify-between items-center p-6 border border-slate-200 rounded-2xl hover:border-black transition-colors cursor-pointer group">
              <div>
                <h3 className="text-lg font-bold mb-1">{job}</h3>
                <span className="text-sm text-slate-500">Seoul, Korea · Full-time</span>
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-black transition-colors"/>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}