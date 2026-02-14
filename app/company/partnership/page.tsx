'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';

export default function PartnershipPage() {
  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans selection:bg-black selection:text-white">
      <SiteHeader />
      
      <main className="max-w-[800px] mx-auto px-6 py-24">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">
          Partner<br/>with Locally.
        </h1>
        <p className="text-xl text-[#717171] font-medium mb-20 max-w-xl">
          로컬리와 함께 여행의 경계를 허물고 새로운 가치를 만들어갈 파트너를 찾습니다.
        </p>

        <form className="space-y-12" onSubmit={(e) => e.preventDefault()}>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500 group-focus-within:text-black">Company Name</label>
              <input type="text" className="w-full py-3 border-b border-gray-300 focus:border-black outline-none text-xl font-medium bg-transparent transition-colors rounded-none placeholder:text-gray-300" placeholder="Enter company name" />
            </div>
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500 group-focus-within:text-black">Contact Email</label>
              <input type="email" className="w-full py-3 border-b border-gray-300 focus:border-black outline-none text-xl font-medium bg-transparent transition-colors rounded-none placeholder:text-gray-300" placeholder="email@company.com" />
            </div>
          </div>
          
          <div className="group">
            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500 group-focus-within:text-black">Proposal Details</label>
            <textarea className="w-full py-3 border-b border-gray-300 focus:border-black outline-none text-xl font-medium bg-transparent transition-colors rounded-none h-40 resize-none placeholder:text-gray-300" placeholder="Tell us about your partnership idea..." />
          </div>

          <div className="pt-8">
            <button className="w-full py-6 bg-black text-white text-lg font-bold hover:bg-[#333] transition-colors flex justify-between px-8 items-center group">
              <span>Send Proposal</span>
              <span className="group-hover:translate-x-2 transition-transform">→</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}