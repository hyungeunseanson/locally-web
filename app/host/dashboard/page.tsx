'use client';

import React, { useState } from 'react';
import { List, MessageSquare, DollarSign, Star, Plus } from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import MyExperiences from './MyExperiences';
import InquiryChat from './InquiryChat';
import Earnings from './Earnings';
import HostReviews from './HostReviews';

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState('experiences');

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        
        {/* 사이드바 */}
        <aside className="w-64 hidden md:block shrink-0">
           <div className="sticky top-24 space-y-2">
              <button onClick={() => setActiveTab('experiences')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='experiences' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><List size={20}/> 내 체험 관리</button>
              <button onClick={() => setActiveTab('inquiries')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='inquiries' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><MessageSquare size={20}/> 문의함</button>
              <button onClick={() => setActiveTab('earnings')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='earnings' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><DollarSign size={20}/> 수익 및 정산</button>
              <button onClick={() => setActiveTab('reviews')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='reviews' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><Star size={20}/> 받은 후기</button>
           </div>
        </aside>

        <main className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <h1 className="text-3xl font-black">
              {activeTab === 'experiences' && '내 체험 관리'}
              {activeTab === 'inquiries' && '문의 메시지'}
              {activeTab === 'earnings' && '수익 및 정산'}
              {activeTab === 'reviews' && '게스트 후기'}
            </h1>
            {activeTab === 'experiences' && (
              <Link href="/host/create"><button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"><Plus size={18} /> 새 체험 등록</button></Link>
            )}
          </div>

          {activeTab === 'experiences' && <MyExperiences />}
          {activeTab === 'inquiries' && <InquiryChat />}
          {activeTab === 'earnings' && <Earnings />}
          {activeTab === 'reviews' && <HostReviews />}
        </main>
      </div>
    </div>
  );
}