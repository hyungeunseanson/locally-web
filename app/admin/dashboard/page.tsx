'use client';

// ✅ [수정 완료] useState, useEffect가 확실하게 선언되었습니다.
import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, Search, LayoutDashboard, 
  BarChart3, MessageSquare 
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminDashboardPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [stats, setStats] = useState({ users: 0, experiences: 0, bookings: 0 });
  
  const supabase = createClient();

  // 데이터 불러오기
  const fetchData = async () => {
    // 1. 지원서 목록
    const { data: appData } = await supabase
      .from('host_applications')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (appData) setApps(appData);

    // 2. 통계 데이터 (개수 세기)
    const { count: users } = await supabase.from('host_applications').select('*', { count: 'exact', head: true });
    const { count: exps } = await supabase.from('experiences').select('*', { count: 'exact', head: true });
    const { count: books } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    
    setStats({ 
      users: users || 0, 
      experiences: exps || 0, 
      bookings: books || 0 
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 승인 처리
  const handleApprove = async (id: string) => {
    if (!confirm('이 지원자를 호스트로 승인하시겠습니까?')) return;
    
    const { error } = await supabase
      .from('host_applications')
      .update({ status: 'approved' })
      .eq('id', id);

    if (!error) {
      alert('승인 처리되었습니다.');
      fetchData(); // 목록 새로고침
      setSelected(null);
    } else {
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  // 거절 처리
  const handleReject = async (id: string) => {
    if (!confirm('거절하시겠습니까?')) return;
    
    const { error } = await supabase
      .from('host_applications')
      .update({ status: 'rejected' })
      .eq('id', id);
      
    if (!error) {
      alert('거절 처리되었습니다.');
      fetchData();
      setSelected(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 사이드바 */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:block fixed h-full z-10">
        <h1 className="text-xl font-bold mb-8 flex items-center gap-2">
           <LayoutDashboard/> Locally Admin
        </h1>
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-slate-800 text-white px-4 py-3 rounded-xl cursor-pointer font-bold">
            <Users size={18}/> 지원서 관리
          </div>
          <div className="flex items-center gap-3 text-slate-400 px-4 py-3 rounded-xl hover:text-white cursor-pointer">
            <BarChart3 size={18}/> 매출 통계 (준비중)
          </div>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 ml-0 md:ml-64 p-8">
        
        {/* 상단 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-sm text-slate-500 font-bold mb-1">총 호스트 신청</p>
             <h2 className="text-3xl font-black">{stats.users}건</h2>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-sm text-slate-500 font-bold mb-1">등록된 체험</p>
             <h2 className="text-3xl font-black">{stats.experiences}개</h2>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-sm text-slate-500 font-bold mb-1">누적 예약</p>
             <h2 className="text-3xl font-black">{stats.bookings}건</h2>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 h-[70vh]">
          {/* 리스트 영역 */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold flex justify-between items-center">
              <span>지원서 목록</span>
              <span className="text-xs bg-black text-white px-2 py-1 rounded-full">{apps.length}</span>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {apps.length === 0 ? (
                <p className="text-center text-slate-400 py-10">데이터가 없습니다.</p>
              ) : (
                apps.map(app => (
                  <div 
                    key={app.id} 
                    onClick={() => setSelected(app)} 
                    className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selected?.id === app.id ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex justify-between mb-2">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
                        app.status === 'approved' ? 'bg-green-100 text-green-700' : 
                        app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {app.status}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-bold text-slate-900">{app.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 truncate">{app.tour_concept || '제목 없음'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 상세 보기 영역 */}
          <div className="flex-[1.5] bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-lg">
            {selected ? (
              <div className="flex-1 overflow-y-auto p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-black mb-1">{selected.name}</h2>
                    <p className="text-sm text-slate-500">{selected.email} · {selected.phone}</p>
                  </div>
                  <a href={`https://instagram.com/${selected.instagram?.replace('@','')}`} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-bold hover:underline">
                    @{selected.instagram?.replace('@','')}
                  </a>
                </div>

                <div className="space-y-6 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                     <InfoBox label="생년월일" value={selected.birthdate} />
                     <InfoBox label="MBTI" value={selected.mbti} />
                  </div>
                  
                  <InfoBox label="자기소개 & 동기" value={`${selected.motivation || ''}\n\n${selected.self_intro || ''}`} />
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">🗺️ 투어 기획안</h3>
                    <div className="space-y-4">
                      <InfoBox label="컨셉/제목" value={selected.tour_concept} />
                      <InfoBox label="개최 지역" value={selected.tour_location} />
                      <InfoBox label="상세 코스" value={selected.tour_course} />
                      <InfoBox label="희망 가격" value={`₩${selected.tour_price}`} />
                    </div>
                  </div>
                </div>

                {selected.status === 'pending' && (
                  <div className="flex gap-3 mt-10 pt-6 border-t border-slate-100 sticky bottom-0 bg-white">
                    <button onClick={() => handleReject(selected.id)} className="flex-1 py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                      거절하기
                    </button>
                    <button onClick={() => handleApprove(selected.id)} className="flex-1 py-4 bg-black text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg">
                      승인하기
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <Search size={48} className="mb-4 opacity-20"/>
                <p>왼쪽 목록에서 지원서를 선택해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoBox({ label, value }: any) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="bg-white border border-slate-100 p-3 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
        {value || '-'}
      </div>
    </div>
  )
}