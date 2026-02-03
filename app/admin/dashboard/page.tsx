'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, LayoutDashboard, MapPin, Trash2, Search,
  CheckCircle2, BarChart3, ChevronRight 
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS'>('APPS');
  const [filter, setFilter] = useState<'ALL' | 'PENDING'>('ALL'); 
  
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedExp, setSelectedExp] = useState<any>(null);
  
  const [stats, setStats] = useState({ users: 0, experiences: 0, bookings: 0 });
  const supabase = createClient();

  // 데이터 로딩
  const fetchData = async () => {
    // 1. 통계
    const { count: uCount } = await supabase.from('host_applications').select('*', { count: 'exact', head: true });
    const { count: eCount } = await supabase.from('experiences').select('*', { count: 'exact', head: true });
    const { count: bCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    setStats({ users: uCount || 0, experiences: eCount || 0, bookings: bCount || 0 });

    // 2. 지원서 (최신순)
    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);

    // 3. 체험 (최신순)
    const { data: expData } = await supabase.from('experiences').select('*, host:host_id(email)').order('created_at', { ascending: false });
    if (expData) setExps(expData);
  };

  useEffect(() => { fetchData(); }, []);

  // 승인/거절 로직
  const handleAppStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!confirm(`${status === 'approved' ? '승인' : '거절'} 하시겠습니까?`)) return;
    await supabase.from('host_applications').update({ status }).eq('id', id);
    fetchData(); setSelectedApp(null);
  };

  // 체험 삭제 로직
  const handleDeleteExp = async (id: number) => {
    if (!confirm("이 체험을 삭제하시겠습니까? (복구 불가)")) return;
    await supabase.from('experiences').delete().eq('id', id);
    fetchData(); setSelectedExp(null);
  };

  const filteredApps = filter === 'ALL' ? apps : apps.filter(a => a.status === 'pending');

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* 사이드바 */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col fixed h-full z-10">
        <h1 className="text-xl font-bold mb-8 flex items-center gap-2">
           <LayoutDashboard className="text-rose-500"/> Locally Admin
        </h1>
        <nav className="space-y-2 flex-1">
          <button onClick={() => {setActiveTab('APPS'); setSelectedExp(null);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'APPS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Users size={18}/> 호스트 지원서
            {apps.filter(a => a.status === 'pending').length > 0 && <span className="ml-auto bg-rose-500 text-[10px] px-2 py-0.5 rounded-full">{apps.filter(a => a.status === 'pending').length}</span>}
          </button>
          <button onClick={() => {setActiveTab('EXPS'); setSelectedApp(null);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'EXPS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <MapPin size={18}/> 체험 관리
          </button>
        </nav>
      </aside>

      {/* 메인 */}
      <main className="flex-1 ml-0 md:ml-64 p-8">
        
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-2xl border shadow-sm"><p className="text-slate-500 font-bold text-xs">총 지원서</p><h2 className="text-3xl font-black">{stats.users}</h2></div>
           <div className="bg-white p-6 rounded-2xl border shadow-sm"><p className="text-slate-500 font-bold text-xs">등록된 체험</p><h2 className="text-3xl font-black">{stats.experiences}</h2></div>
           <div className="bg-white p-6 rounded-2xl border shadow-sm"><p className="text-slate-500 font-bold text-xs">완료된 예약</p><h2 className="text-3xl font-black">{stats.bookings}</h2></div>
        </div>

        <div className="flex gap-8 h-[75vh]">
          
          {/* 리스트 영역 */}
          <div className="w-1/3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="font-bold">{activeTab === 'APPS' ? '지원서 목록' : '체험 목록'}</span>
              {activeTab === 'APPS' && (
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                  <button onClick={()=>setFilter('ALL')} className={`text-xs px-2 py-1 rounded ${filter==='ALL'?'bg-black text-white':''}`}>전체</button>
                  <button onClick={()=>setFilter('PENDING')} className={`text-xs px-2 py-1 rounded ${filter==='PENDING'?'bg-black text-white':''}`}>대기중</button>
                </div>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {activeTab === 'APPS' ? (
                filteredApps.map(app => (
                  <div key={app.id} onClick={() => setSelectedApp(app)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedApp?.id === app.id ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100'}`}>
                    <div className="flex justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${app.status==='pending'?'bg-yellow-100 text-yellow-700':app.status==='approved'?'bg-green-100 text-green-700':'bg-red-100'}`}>{app.status}</span>
                      <span className="text-xs text-slate-400">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="font-bold">{app.name}</div>
                    <div className="text-xs text-slate-500 truncate">{app.tour_concept}</div>
                  </div>
                ))
              ) : (
                exps.map(exp => (
                  <div key={exp.id} onClick={() => setSelectedExp(exp)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedExp?.id === exp.id ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100'}`}>
                    <div className="flex gap-3">
                       <img src={exp.image_url} className="w-12 h-12 rounded-lg object-cover bg-slate-200"/>
                       <div>
                         <div className="font-bold line-clamp-1">{exp.title}</div>
                         <div className="text-xs text-slate-500">₩{exp.price.toLocaleString()}</div>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 상세 보기 영역 */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col relative shadow-lg">
            
            {/* A. 지원서 상세 */}
            {activeTab === 'APPS' && selectedApp && (
              <div className="flex-1 overflow-y-auto p-8">
                <h2 className="text-2xl font-black mb-1">{selectedApp.name}</h2>
                <div className="text-sm text-slate-500 mb-6">{selectedApp.email} · {selectedApp.phone}</div>
                <div className="space-y-6 text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-lg mb-4">🗺️ 투어 기획안</h3>
                    <div className="space-y-2">
                      <p><strong>컨셉:</strong> {selectedApp.tour_concept}</p>
                      <p><strong>지역:</strong> {selectedApp.tour_location}</p>
                      <p><strong>가격:</strong> {selectedApp.tour_price}</p>
                      <div className="mt-2 pt-2 border-t border-slate-200"><p className="whitespace-pre-wrap">{selectedApp.tour_course}</p></div>
                    </div>
                  </div>
                  <div><h3 className="font-bold mb-1">자기소개</h3><p className="whitespace-pre-wrap text-slate-600">{selectedApp.self_intro}</p></div>
                </div>
                {selectedApp.status === 'pending' && (
                  <div className="sticky bottom-0 bg-white pt-4 pb-4 mt-8 border-t flex gap-4">
                    <button onClick={() => handleAppStatus(selectedApp.id, 'rejected')} className="flex-1 py-3 border border-slate-300 rounded-xl font-bold hover:bg-slate-50">거절</button>
                    <button onClick={() => handleAppStatus(selectedApp.id, 'approved')} className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-slate-800">승인하기</button>
                  </div>
                )}
              </div>
            )}

            {/* B. 체험 상세 */}
            {activeTab === 'EXPS' && selectedExp && (
              <div className="flex-1 overflow-y-auto p-8">
                <div className="aspect-video bg-slate-100 rounded-xl mb-6 overflow-hidden">
                  <img src={selectedExp.image_url} className="w-full h-full object-cover"/>
                </div>
                <h2 className="text-2xl font-black mb-2">{selectedExp.title}</h2>
                <div className="flex gap-4 text-sm text-slate-500 mb-6 border-b pb-4">
                  <span className="flex items-center gap-1"><MapPin size={14}/> {selectedExp.location}</span>
                  <span className="flex items-center gap-1">₩{selectedExp.price.toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed mb-8">{selectedExp.description}</p>
                <button onClick={() => handleDeleteExp(selectedExp.id)} className="w-full py-4 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 flex items-center justify-center gap-2">
                  <Trash2 size={18}/> 체험 강제 삭제
                </button>
              </div>
            )}

            {!selectedApp && !selectedExp && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Search size={48} className="mb-4 opacity-20"/><p>왼쪽 목록에서 항목을 선택하세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}