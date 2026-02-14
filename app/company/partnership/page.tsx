'use client';

import React from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

export default function PartnershipPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <SiteHeader />
      <div className="flex-1 max-w-2xl mx-auto px-6 py-20 w-full">
        <h1 className="text-3xl font-black mb-4">제휴 및 파트너십 문의</h1>
        <p className="text-slate-500 mb-10">
          로컬리와 함께 성장하고 싶은 기업 및 단체의 연락을 기다립니다.<br/>
          제안해주신 내용은 담당자 검토 후 회신 드립니다.
        </p>

        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-sm font-bold mb-2">기업/단체명</label>
            <input type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="예: (주)로컬리"/>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">담당자 이메일</label>
            <input type="email" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="partner@company.com"/>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">문의 내용</label>
            <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-black transition-colors h-40 resize-none" placeholder="제휴 제안 내용을 상세히 적어주세요."/>
          </div>
          <button className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
            제안서 보내기
          </button>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}