'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Users, CheckCircle, AlertCircle, 
  Search, Bell, ChevronRight, MessageSquare, Filter
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminDashboardPage() {
  const [items, setItems] = useState<any[]>([]); // Real Data Store
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // 1. 실제 데이터 가져오기
  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from('host_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // 2. 승인 처리
  const handleApprove = async (appId: string) => {
    if (!confirm('이 지원자를 승인하시겠습니까?')) return;
    
    await supabase.from('host_applications').update({ status: 'approved' }).eq('id', appId);
    alert("승인되었습니다!");
    fetchApplications(); // 새로고침
    setSelectedItem(null);
  };

  // 3. 거절 처리
  const handleReject = async (appId: string) => {
    if (!confirm('거절하시겠습니까?')) return;
    
    await supabase.from('host_applications').update({ status: 'rejected' }).eq('id', appId);
    alert("거절되었습니다.");
    fetchApplications();
    setSelectedItem(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      
      {/* Sidebar (디자인 유지) */}
      <aside className="w-20 md:w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10">
        <div className="h-20 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-900 font-black mr-0 md:mr-3">L</div>
          <span className="font-bold text-lg hidden md:block">Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<Users size={20}/>} label="지원서 관리" active badge={items.filter(i => i.status === 'pending').length} />
          <NavItem icon={<CheckCircle size={20}/>} label="승인된 호스트" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 md:ml-64 p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-bold mb-1">파트너 지원 현황</h1>
            <p className="text-slate-500 text-sm">총 {items.length}건의 지원서가 접수되었습니다.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* List */}
          <div className="lg:col-span-2 space-y-4">
             {items.length === 0 ? (
               <div className="text-center py-20 text-slate-400">신청 내역이 없습니다.</div>
             ) : (
               items.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className={`bg-white border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all ${selectedItem?.id === item.id ? 'border-black ring-1 ring-black' : 'border-slate-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  <div className="flex gap-2 mt-2 text-xs text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded">{item.tour_location}</span>
                    <span className="bg-slate-100 px-2 py-1 rounded">Lv.{item.korean_level}</span>
                  </div>
                </div>
               ))
             )}
          </div>

          {/* Detail View (상세 내용 보여주기) */}
          <div className="lg:col-span-1">
            {selectedItem ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sticky top-8 shadow-lg h-[85vh] overflow-y-auto">
                 <h2 className="text-2xl font-bold mb-1">{selectedItem.name}</h2>
                 <p className="text-slate-500 text-sm mb-6">{selectedItem.email} / {selectedItem.phone}</p>

                 <div className="space-y-6 text-sm">
                   <InfoBox label="인스타그램" value={selectedItem.instagram} />
                   <InfoBox label="자기소개 & 동기" value={`${selectedItem.motivation}\n\n${selectedItem.self_intro}`} />
                   <InfoBox label="한국어 실력" value={`${selectedItem.korean_level} (${selectedItem.korean_cert || '자격증 없음'})`} />
                   
                   <div className="border-t pt-4">
                     <h3 className="font-bold text-lg mb-3">🗺️ 투어 기획안</h3>
                     <InfoBox label="장소 및 가격" value={`${selectedItem.tour_1_places}\n(예상가격: ¥${selectedItem.tour_1_price})`} />
                     <InfoBox label="소개글" value={selectedItem.tour_1_intro} />
                   </div>
                 </div>

                 {selectedItem.status === 'pending' && (
                   <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                     <button onClick={() => handleReject(selectedItem.id)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600">거절</button>
                     <button onClick={() => handleApprove(selectedItem.id)} className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-slate-800">승인하기</button>
                   </div>
                 )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <p>왼쪽에서 지원서를 선택하세요.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, badge }: any) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
       <div className="flex items-center gap-3">{icon}<span>{label}</span></div>
       {badge > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{badge}</span>}
    </div>
  )
}

function InfoBox({ label, value }: any) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-400 block mb-1">{label}</label>
      <p className="bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{value || '-'}</p>
    </div>
  )
}