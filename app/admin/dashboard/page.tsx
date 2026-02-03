'use client';

import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Search } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminDashboardPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const supabase = createClient();

  // 목록 불러오기
  const fetchApps = async () => {
    const { data } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (data) setApps(data);
  };
  useEffect(() => { fetchApps(); }, []);

  // 승인 처리
  const handleApprove = async (id: string) => {
    if (!confirm('승인하시겠습니까?')) return;
    await supabase.from('host_applications').update({ status: 'approved' }).eq('id', id);
    alert('승인 완료');
    fetchApps();
    setSelected(null);
  };

  // 거절 처리
  const handleReject = async (id: string) => {
    if (!confirm('거절하시겠습니까?')) return;
    await supabase.from('host_applications').update({ status: 'rejected' }).eq('id', id);
    alert('거절 완료');
    fetchApps();
    setSelected(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white p-6">
        <h1 className="text-xl font-bold mb-8">Locally Admin</h1>
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-white font-bold"><Users/> 지원서 관리</div>
        </div>
      </aside>
      <main className="flex-1 p-8 flex gap-8">
        <div className="flex-1 space-y-4">
          <h2 className="text-2xl font-bold mb-4">지원서 목록 ({apps.length})</h2>
          {apps.map(app => (
            <div key={app.id} onClick={() => setSelected(app)} className="bg-white p-4 rounded-xl border cursor-pointer hover:shadow-md">
              <div className="flex justify-between mb-2">
                <span className={`px-2 py-1 text-xs font-bold rounded ${app.status==='approved'?'bg-green-100 text-green-700':app.status==='pending'?'bg-yellow-100 text-yellow-700':'bg-red-100'}`}>{app.status}</span>
                <span className="text-xs text-slate-400">{app.created_at.slice(0,10)}</span>
              </div>
              <h3 className="font-bold">{app.name}</h3>
              <p className="text-sm text-slate-500">{app.tour_concept}</p>
            </div>
          ))}
        </div>
        
        {/* 상세 보기 */}
        <div className="flex-1 bg-white p-8 rounded-2xl border shadow-lg h-[80vh] overflow-y-auto">
          {selected ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">{selected.name}</h2>
              <div className="space-y-2 text-sm">
                <p><strong>연락처:</strong> {selected.phone}</p>
                <p><strong>인스타:</strong> {selected.instagram}</p>
                <p><strong>자기소개:</strong> {selected.self_intro}</p>
                <p><strong>투어기획:</strong> {selected.tour_concept}</p>
                <p className="bg-slate-50 p-4 rounded-xl">{selected.tour_course}</p>
              </div>
              {selected.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                  <button onClick={() => handleReject(selected.id)} className="flex-1 py-3 border rounded-xl font-bold">거절</button>
                  <button onClick={() => handleApprove(selected.id)} className="flex-1 py-3 bg-black text-white rounded-xl font-bold">승인</button>
                </div>
              )}
            </div>
          ) : <p className="text-slate-400 text-center mt-20">지원서를 선택하세요</p>}
        </div>
      </main>
    </div>
  );
}