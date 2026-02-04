'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, MapPin, Trash2, Search, CheckCircle2, BarChart3, ChevronRight, XCircle, AlertCircle, MessageSquare
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS'>('APPS');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL'); 
  
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [selectedExp, setSelectedExp] = useState<any>(null);
  
  const [stats, setStats] = useState({ users: 0, experiences: 0, bookings: 0 });
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { count: uCount } = await supabase.from('host_applications').select('*', { count: 'exact', head: true });
    const { count: eCount } = await supabase.from('experiences').select('*', { count: 'exact', head: true });
    const { count: bCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    setStats({ users: uCount || 0, experiences: eCount || 0, bookings: bCount || 0 });

    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);

    const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
    if (expData) setExps(expData);
  };

  // ✅ 호스트 지원서 상태 변경 함수 (중복 제거 및 로직 통합)
  const handleAppStatus = async (id: string, status: string) => {
    let comment = '';
    
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
      if (input === null) return; 
      comment = input;
    } else {
      if (!confirm('승인하시겠습니까?')) return;
      status = 'approved'; 
    }

    const { error } = await supabase
      .from('host_applications')
      .update({ 
        status: status, 
        admin_comment: comment 
      })
      .eq('id', id);

    if (error) {
      alert("오류 발생: " + error.message);
    } else {
      alert("처리가 완료되었습니다.");
      fetchData(); 
      setSelectedApp(null); 
    }
  };

  // ✅ 체험 상태 변경 함수
  const handleExpStatus = async (id: string, status: string) => {
    let comment = '';
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
      if (input === null) return;
      comment = input;
    } else {
      if (!confirm('승인하시겠습니까? (즉시 공개됩니다)')) return;
      status = 'active'; 
    }

    const { error } = await supabase
      .from('experiences')
      .update({ 
        status: status, 
        admin_comment: comment 
      })
      .eq('id', id);

    if (error) {
      alert("오류 발생: " + error.message);
    } else {
      alert("처리가 완료되었습니다.");
      fetchData();
      setSelectedExp(null);
    }
  };

  const handleDeleteExp = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('experiences').delete().eq('id', id);
    fetchData();
    setSelectedExp(null);
  };

  const getFilteredList = (list: any[]) => {
    if (filter === 'ALL') return list;
    if (filter === 'PENDING') return list.filter(item => item.status === 'pending');
    if (filter === 'APPROVED') return list.filter(item => item.status === 'approved' || item.status === 'active');
    if (filter === 'REJECTED') return list.filter(item => item.status === 'rejected' || item.status === 'revision');
    return list;
  };

  const filteredApps = getFilteredList(apps);
  const filteredExps = getFilteredList(exps);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      
      <div className="flex h-[calc(100vh-80px)]">
        <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
          <nav className="space-y-2 flex-1">
            <button onClick={() => {setActiveTab('APPS'); setSelectedExp(null); setFilter('ALL');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'APPS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Users size={18}/> 호스트 지원서
              {apps.filter(a => a.status === 'pending').length > 0 && <span className="ml-auto bg-rose-500 text-[10px] px-2 py-0.5 rounded-full">{apps.filter(a => a.status === 'pending').length}</span>}
            </button>
            <button onClick={() => {setActiveTab('EXPS'); setSelectedApp(null); setFilter('ALL');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'EXPS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
              <MapPin size={18}/> 체험 관리
              {exps.filter(e => e.status === 'pending').length > 0 && <span className="ml-auto bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded-full font-bold">{exps.filter(e => e.status === 'pending').length}</span>}
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <div className="bg-white p-6 rounded-2xl border shadow-sm"><p className="text-slate-500 font-bold text-xs">총 지원서</p><h2 className="text-3xl font-black">{stats.users}</h2></div>
             <div className="bg-white p-6 rounded-2xl border shadow-sm"><p className="text-slate-500 font-bold text-xs">등록된 체험</p><h2 className="text-3xl font-black">{stats.experiences}</h2></div>
             <div className="bg-white p-6 rounded-2xl border shadow-sm"><p className="text-slate-500 font-bold text-xs">완료된 예약</p><h2 className="text-3xl font-black">{stats.bookings}</h2></div>
          </div>

          <div className="flex gap-8 h-[70vh]">
            <div className="w-1/3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
                <span className="font-bold text-lg">{activeTab === 'APPS' ? '지원서 목록' : '체험 목록'}</span>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 gap-1">
                  {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                    <button key={f} onClick={()=>setFilter(f as any)} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${filter===f ? 'bg-black text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                      {f === 'ALL' ? '전체' : f === 'PENDING' ? '대기' : f === 'APPROVED' ? '승인' : '거절/보완'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {activeTab === 'APPS' ? filteredApps.map(app => (
                  <div key={app.id} onClick={() => setSelectedApp(app)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedApp?.id === app.id ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100'}`}>
                    <div className="flex justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${app.status==='pending'?'bg-yellow-100 text-yellow-700':app.status==='approved'?'bg-green-100 text-green-700':app.status==='revision'?'bg-orange-100 text-orange-700':'bg-red-100 text-red-700'}`}>{app.status}</span>
                      <span className="text-xs text-slate-400">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="font-bold">{app.name}</div>
                  </div>
                )) : filteredExps.map(exp => (
                  <div key={exp.id} onClick={() => setSelectedExp(exp)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedExp?.id === exp.id ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100'}`}>
                    <div className="flex gap-3">
                       {exp.photos && exp.photos[0] ? <img src={exp.photos[0]} className="w-12 h-12 rounded-lg object-cover bg-slate-200"/> : <div className="w-12 h-12 bg-slate-200 rounded-lg"/>}
                       <div className="flex-1 min-w-0">
                         <div className="font-bold line-clamp-1 text-sm">{exp.title}</div>
                         <div className="flex justify-between items-center mt-1">
                           <span className="text-xs text-slate-500">₩{Number(exp.price).toLocaleString()}</span>
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${exp.status==='pending'?'bg-yellow-100 text-yellow-700':exp.status==='active'?'bg-green-100 text-green-700':exp.status==='revision'?'bg-orange-100 text-orange-700':'bg-red-100 text-red-700'}`}>{exp.status}</span>
                         </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col relative shadow-lg p-8 overflow-y-auto">
              {activeTab === 'APPS' && selectedApp && (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-black mb-1">{selectedApp.name}</h2>
                      <div className="text-sm text-slate-500">{selectedApp.email} · {selectedApp.phone}</div>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-slate-400 mb-1">지원일: {new Date(selectedApp.created_at).toLocaleDateString()}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${selectedApp.status==='pending'?'bg-yellow-100 text-yellow-700':selectedApp.status==='approved'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{selectedApp.status}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                     <InfoBox label="국적 / 언어" value={`${selectedApp.host_nationality === 'Korea' ? '🇰🇷 한국' : '🇯🇵 일본'} / ${selectedApp.target_language}`} />
                     <InfoBox label="인스타그램" value={selectedApp.instagram} />
                     <InfoBox label="생년월일" value={selectedApp.dob} />
                     <InfoBox label="언어 능력" value={`Level ${selectedApp.language_level} (${selectedApp.language_cert || '자격증 없음'})`} />
                     <InfoBox label="정산 계좌" value={`${selectedApp.bank_name} ${selectedApp.account_number} (${selectedApp.account_holder})`} />
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-xl border">
                    <h3 className="font-bold mb-2 text-sm uppercase text-slate-500">자기소개</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedApp.self_intro}</p>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-xl border">
                    <h3 className="font-bold mb-2 text-sm uppercase text-slate-500">지원 동기</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedApp.motivation}</p>
                  </div>

                  {selectedApp.admin_comment && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <h3 className="font-bold mb-1 text-sm text-red-600">🚨 관리자 코멘트</h3>
                      <p className="text-sm text-red-800">{selectedApp.admin_comment}</p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button onClick={()=>handleAppStatus(selectedApp.id, 'rejected')} className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                      <XCircle size={18}/> 거절
                    </button>
                    <button onClick={()=>handleAppStatus(selectedApp.id, 'revision')} className="flex-1 py-3 border border-orange-200 text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors flex items-center justify-center gap-2">
                      <AlertCircle size={18}/> 보완요청
                    </button>
                    <button onClick={()=>handleAppStatus(selectedApp.id, 'approved')} className="flex-[2] py-3 bg-black text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                      <CheckCircle2 size={18}/> 승인
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'EXPS' && selectedExp && (
                <div className="space-y-6">
                  {selectedExp.photos && selectedExp.photos[0] && (
                    <div className="w-full h-64 rounded-xl overflow-hidden mb-4">
                      <img src={selectedExp.photos[0]} className="w-full h-full object-cover"/>
                    </div>
                  )}
                  
                  <div>
                    <h2 className="text-2xl font-black mb-1">{selectedExp.title}</h2>
                    <div className="flex gap-3 text-sm text-slate-500 font-medium">
                      <span>{selectedExp.category}</span>
                      <span>·</span>
                      <span>{selectedExp.city}</span>
                      <span>·</span>
                      <span>{selectedExp.duration}시간</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                     <InfoBox label="가격" value={`₩${selectedExp.price.toLocaleString()}`} />
                     <InfoBox label="최대 인원" value={`${selectedExp.max_guests}명`} />
                     <InfoBox label="만남 장소" value={selectedExp.meeting_point} />
                     <InfoBox label="방문 장소" value={selectedExp.spots} />
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border">
                    <h3 className="font-bold mb-2 text-sm uppercase text-slate-500">상세 설명</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedExp.description}</p>
                  </div>

                  {selectedExp.admin_comment && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <h3 className="font-bold mb-1 text-sm text-red-600">🚨 관리자 코멘트</h3>
                      <p className="text-sm text-red-800">{selectedExp.admin_comment}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button onClick={()=>handleExpStatus(selectedExp.id, 'rejected')} className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm">
                      <XCircle size={16}/> 거절
                    </button>
                    <button onClick={()=>handleExpStatus(selectedExp.id, 'revision')} className="flex-1 py-3 border border-orange-200 text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 text-sm">
                      <AlertCircle size={16}/> 보완요청
                    </button>
                    <button onClick={()=>handleExpStatus(selectedExp.id, 'active')} className="flex-[1.5] py-3 bg-black text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm">
                      <CheckCircle2 size={16}/> 승인 (공개)
                    </button>
                  </div>
                  
                  <div className="pt-2">
                    <button onClick={()=>handleDeleteExp(selectedExp.id)} className="w-full py-3 text-slate-400 text-xs font-bold hover:text-red-500 transition-colors flex items-center justify-center gap-1">
                      <Trash2 size={14}/> 체험 영구 삭제
                    </button>
                  </div>
                </div>
              )}

              {!selectedApp && !selectedExp && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <Search size={48} className="mb-4 opacity-20"/>
                  <p>목록에서 항목을 선택하세요.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">{label}</label>
      <div className="bg-white border border-slate-100 p-3 rounded-lg text-slate-900 shadow-sm text-sm whitespace-pre-wrap min-h-[46px] flex items-center">
        {value || '-'}
      </div>
    </div>
  )
}