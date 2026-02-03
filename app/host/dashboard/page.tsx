'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Calendar, List, MessageSquare, BarChart3, Plus, Edit, Settings } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function HostDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [experiences, setExperiences] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('experiences'); // experiences | inquiries

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      // 내 체험 가져오기
      const { data: expData } = await supabase
        .from('experiences')
        .select('*, bookings(count)')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });
      if (expData) setExperiences(expData);

      // 내게 온 문의 가져오기
      const { data: inqData } = await supabase
        .from('inquiries')
        .select('*, experiences(title)')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });
      if (inqData) setInquiries(inqData);
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        
        {/* 사이드바 */}
        <aside className="w-64 hidden md:block shrink-0">
           <div className="sticky top-24 space-y-2">
              <button onClick={() => setActiveTab('experiences')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='experiences' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                 <List size={20}/> 내 체험 관리
              </button>
              <button onClick={() => setActiveTab('inquiries')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='inquiries' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                 <MessageSquare size={20}/> 문의함 ({inquiries.length})
              </button>
           </div>
        </aside>

        {/* 메인 */}
        <main className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <h1 className="text-3xl font-black">{activeTab === 'experiences' ? '내 체험 관리' : '도착한 문의'}</h1>
            {activeTab === 'experiences' && (
              <Link href="/host/create">
                <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={18} /> 새 체험 등록
                </button>
              </Link>
            )}
          </div>

          {activeTab === 'experiences' ? (
            <div className="grid gap-6">
              {experiences.map((exp) => (
                <div key={exp.id} className="bg-white border rounded-2xl p-6 flex justify-between items-center shadow-sm">
                  <div className="flex gap-4 items-center">
                    <img src={exp.image_url} className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
                    <div>
                      <h2 className="font-bold text-lg">{exp.title}</h2>
                      <p className="text-sm text-slate-500">₩{exp.price.toLocaleString()} · 예약 {exp.bookings[0].count}건</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/host/experiences/${exp.id}/dates`}>
                      <button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                        <Calendar size={16}/> 일정 관리
                      </button>
                    </Link>
                    <Link href={`/host/experiences/${exp.id}/edit`}>
                      <button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                        <Edit size={16}/> 수정
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {inquiries.length === 0 ? <p className="text-slate-400">아직 문의가 없습니다.</p> : inquiries.map((inq) => (
                <div key={inq.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-bold text-blue-600">[{inq.experiences?.title}] 문의</span>
                    <span className="text-xs text-slate-400">{new Date(inq.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="font-medium text-slate-800 mb-4">"{inq.content}"</p>
                  <button className="text-sm font-bold underline text-slate-500" onClick={()=> alert('답장 기능은 이메일 연동 후 제공됩니다. (현재 준비중)')}>
                    이메일로 답장하기
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}