'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, LayoutDashboard, MapPin, Trash2, Search,
  CheckCircle2, BarChart3, ChevronRight, Mail, Phone, Calendar, DollarSign
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

    // 3. 체험 (❗수정됨: host 정보 join 제거하여 에러 방지)
    const { data: expData } = await supabase
      .from('experiences')
      .select('*') 
      .order('created_at', { ascending: false });
      
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <StatCard label="총 지원서" value={stats.users} />
           <StatCard label="등록된 체험" value={stats.experiences} />
           <StatCard label="완료된 예약" value={stats.bookings} />
        </div>

        <div className="flex gap-8 h-[80vh]">
          
          {/* 1. 리스트 영역 */}
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
                       {/* 이미지 없을 때 대비 */}
                       {exp.image_url ? (
                         <img src={exp.image_url} className="w-12 h-12 rounded-lg object-cover bg-slate-200"/>
                       ) : (
                         <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-xs">No Img</div>
                       )}
                       <div>
                         <div className="font-bold line-clamp-1">{exp.title}</div>
                         <div className="text-xs text-slate-500">₩{Number(exp.price).toLocaleString()}</div>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. 상세 보기 영역 */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col relative shadow-lg">
            
            {/* A. 지원서 상세 */}
            {activeTab === 'APPS' && selectedApp && (
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="border-b pb-6">
                  <h2 className="text-3xl font-black mb-2">{selectedApp.name}</h2>
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Mail size={14}/> {selectedApp.email}</span>
                    <span className="flex items-center gap-1"><Phone size={14}/> {selectedApp.phone}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                   <InfoBox label="인스타그램" value={selectedApp.instagram} />
                   <InfoBox label="MBTI / 생년월일" value={`${selectedApp.mbti} / ${selectedApp.birthdate}`} />
                   <InfoBox label="한국어 실력" value={`${selectedApp.korean_level} (${selectedApp.korean_cert || '자격증 없음'})`} />
                   <InfoBox label="활동 가능 지역" value={selectedApp.tour_location} />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">자기소개 & 지원동기</label>
                  <p className="bg-slate-50 p-4 rounded-xl text-slate-700 whitespace-pre-wrap">{selectedApp.self_intro}</p>
                  <p className="bg-slate-50 p-4 rounded-xl text-slate-700 whitespace-pre-wrap">{selectedApp.motivation}</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">🗺️ 투어 기획안</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InfoBox label="컨셉/제목" value={selectedApp.tour_concept} />
                        <InfoBox label="희망 가격" value={`₩${selectedApp.tour_price}`} />
                    </div>
                    <InfoBox label="상세 코스" value={selectedApp.tour_course} />
                    <InfoBox label="만나는 장소" value={selectedApp.tour_meeting} />
                  </div>
                </div>

                {selectedApp.status === 'pending' && (
                  <div className="flex gap-4 pt-4">
                    <button onClick={() => handleAppStatus(selectedApp.id, 'rejected')} className="flex-1 py-4 border border-slate-300 rounded-xl font-bold hover:bg-slate-50">거절</button>
                    <button onClick={() => handleAppStatus(selectedApp.id, 'approved')} className="flex-1 py-4 bg-black text-white rounded-xl font-bold hover:bg-slate-800">승인하기</button>
                  </div>
                )}
              </div>
            )}

            {/* B. 체험 상세 */}
            {activeTab === 'EXPS' && selectedExp && (
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  {selectedExp.image_url ? (
                    <img src={selectedExp.image_url} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">이미지 없음</div>
                  )}
                </div>
                
                <div className="border-b pb-6">
                  <h2 className="text-2xl font-black mb-2">{selectedExp.title}</h2>
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={14}/> {selectedExp.location}</span>
                    <span className="flex items-center gap-1 font-bold">₩{Number(selectedExp.price).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold mb-2">체험 설명</h3>
                  <p className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm">{selectedExp.description}</p>
                </div>
                
                <button onClick={() => handleDeleteExp(selectedExp.id)} className="w-full py-4 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 flex items-center justify-center gap-2">
                  <Trash2 size={18}/> 체험 강제 삭제
                </button>
              </div>
            )}

            {!selectedApp && !selectedExp && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Search size={48} className="mb-4 opacity-20"/><p>항목을 선택하세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</p>
      <h2 className="text-3xl font-black">{value}</h2>
    </div>
  )
}

function InfoBox({ label, value }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">{label}</label>
      <div className="bg-white border border-slate-100 p-3 rounded-lg text-slate-900 shadow-sm text-sm whitespace-pre-wrap">
        {value || '-'}
      </div>
    </div>
  )
}