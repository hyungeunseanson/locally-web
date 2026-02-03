'use client';

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, MapPin, Search } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS'>('APPS');
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      // 1. 지원서
      const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
      if (appData) setApps(appData);

      // 2. 체험
      const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
      if (expData) setExps(expData);
    };
    fetchData();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm('승인하시겠습니까?')) return;
    await supabase.from('host_applications').update({ status: 'approved' }).eq('id', id);
    window.location.reload();
  };

  const handleDeleteExp = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('experiences').delete().eq('id', id);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 사이드바 */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:block">
        <h1 className="font-bold text-xl mb-8">Locally Admin</h1>
        <div className="space-y-2">
          <button onClick={() => setActiveTab('APPS')} className={`w-full text-left px-4 py-3 rounded font-bold ${activeTab==='APPS' ? 'bg-slate-800' : 'text-slate-400'}`}>지원서 관리</button>
          <button onClick={() => setActiveTab('EXPS')} className={`w-full text-left px-4 py-3 rounded font-bold ${activeTab==='EXPS' ? 'bg-slate-800' : 'text-slate-400'}`}>체험 관리</button>
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-6">{activeTab === 'APPS' ? '호스트 지원서' : '등록된 체험'}</h2>
        
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {activeTab === 'APPS' ? (
            apps.map(app => (
              <div key={app.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50">
                <div>
                  <div className="font-bold">{app.name} <span className="text-xs text-slate-500">({app.status})</span></div>
                  <div className="text-sm text-slate-500">{app.email}</div>
                </div>
                {app.status === 'pending' && <button onClick={() => handleApprove(app.id)} className="bg-black text-white px-3 py-1 rounded text-xs font-bold">승인</button>}
              </div>
            ))
          ) : (
            exps.map(exp => (
              <div key={exp.id} className="p-4 border-b flex justify-between items-center hover:bg-slate-50">
                <div className="flex gap-4 items-center">
                  {exp.image_url && <img src={exp.image_url} className="w-10 h-10 rounded bg-slate-200 object-cover"/>}
                  <div>
                    <div className="font-bold">{exp.title}</div>
                    <div className="text-sm text-slate-500">₩{exp.price.toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={() => handleDeleteExp(exp.id)} className="text-red-500 text-xs font-bold border border-red-200 px-3 py-1 rounded hover:bg-red-50">삭제</button>
              </div>
            ))
          )}
          {activeTab === 'APPS' && apps.length === 0 && <div className="p-8 text-center text-slate-400">데이터 없음</div>}
          {activeTab === 'EXPS' && exps.length === 0 && <div className="p-8 text-center text-slate-400">데이터 없음</div>}
        </div>
      </main>
    </div>
  );
}