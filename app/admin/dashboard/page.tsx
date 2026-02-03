'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, LayoutDashboard, MapPin, Trash2, Eye 
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS'>('APPS');
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, experiences: 0, bookings: 0 });
  
  const supabase = createClient();

  const fetchData = async () => {
    // 통계
    const { count: uCount } = await supabase.from('host_applications').select('*', { count: 'exact', head: true });
    const { count: eCount } = await supabase.from('experiences').select('*', { count: 'exact', head: true });
    const { count: bCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    setStats({ users: uCount || 0, experiences: eCount || 0, bookings: bCount || 0 });

    // 지원서 목록
    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);

    // 체험 목록
    const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
    if (expData) setExps(expData);
  };

  useEffect(() => { fetchData(); }, []);

  // 지원서 승인/거절 로직 (기존 유지)
  const handleApprove = async (id: string, userId: string) => {
    if (!confirm('승인하시겠습니까?')) return;
    await supabase.from('host_applications').update({ status: 'approved' }).eq('id', id);
    alert('승인 완료'); fetchData();
  };

  // 체험 삭제 로직
  const handleDeleteExp = async (id: number) => {
    if (!confirm('이 체험을 강제로 삭제하시겠습니까?')) return;
    await supabase.from('experiences').delete().eq('id', id);
    alert('삭제 완료'); fetchData();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 사이드바 */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:block fixed h-full z-10">
        <h1 className="text-xl font-bold mb-8 flex items-center gap-2"><LayoutDashboard/> Admin</h1>
        <div className="space-y-2">
          <button onClick={() => setActiveTab('APPS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'APPS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Users size={18}/> 호스트 지원서
          </button>
          <button onClick={() => setActiveTab('EXPS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'EXPS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <MapPin size={18}/> 등록된 체험 관리
          </button>
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 ml-0 md:ml-64 p-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-6 mb-8">
           <StatCard label="총 지원서" value={stats.users} />
           <StatCard label="등록된 체험" value={stats.experiences} />
           <StatCard label="총 예약" value={stats.bookings} />
        </div>

        {/* 탭 컨텐츠 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold bg-slate-50">
            {activeTab === 'APPS' ? '호스트 지원서 목록' : '등록된 체험 목록'}
          </div>
          
          <div className="divide-y divide-slate-100">
            {activeTab === 'APPS' ? (
              apps.map(app => (
                <div key={app.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <div className="font-bold">{app.name} <span className="text-xs font-normal text-slate-500">({app.email})</span></div>
                    <div className="text-xs text-slate-400 mt-1">{app.tour_concept}</div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${app.status==='approved'?'bg-green-100 text-green-700':app.status==='pending'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{app.status}</span>
                    {app.status === 'pending' && <button onClick={() => handleApprove(app.id, app.user_id)} className="px-3 py-1 bg-black text-white text-xs rounded font-bold">승인</button>}
                  </div>
                </div>
              ))
            ) : (
              exps.map(exp => (
                <div key={exp.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                  <div className="flex gap-4 items-center">
                    <img src={exp.image_url} className="w-12 h-12 rounded-lg object-cover bg-slate-200" />
                    <div>
                      <div className="font-bold">{exp.title}</div>
                      <div className="text-xs text-slate-500">₩{exp.price.toLocaleString()} · {exp.location}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteExp(exp.id)} className="p-2 border rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16}/></button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-sm text-slate-500 font-bold mb-1">{label}</p>
      <h2 className="text-3xl font-black">{value}</h2>
    </div>
  )
}