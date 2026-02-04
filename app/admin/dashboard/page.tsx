'use client';

import React, { useState, useEffect } from 'react';
import { Users, MapPin, CheckCircle2, MessageSquare, DollarSign } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { NavButton } from './components/SharedComponents';
import ManagementTab from './components/ManagementTab';
import AnalyticsTab from './components/AnalyticsTab';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS' | 'USERS' | 'CHATS' | 'FINANCE'>('APPS');
  const [filter, setFilter] = useState('ALL'); 
  
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  // ✅ 수정된 fetchData 함수 (디버깅 로그 포함)
  const fetchData = async () => {
    console.log("🔄 데이터 불러오는 중..."); // 디버깅 시작 알림

    // 1. 호스트 지원서
    const { data: appData, error: appError } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appError) console.error("❌ 지원서 로딩 실패:", appError);
    if (appData) setApps(appData);

    // 2. 체험
    const { data: expData, error: expError } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
    if (expError) console.error("❌ 체험 로딩 실패:", expError);
    if (expData) setExps(expData);

    // 3. 유저 (Profiles) - 여기가 핵심입니다!
    const { data: userData, error: userError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); 
    
    if (userError) {
      console.error("❌ 유저 데이터 로딩 실패 (RLS 정책 확인 필요):", userError);
    } else {
      console.log(`✅ 유저 데이터 로딩 성공: ${userData?.length}명 가져옴`);
    }
    
    if (userData) setUsers(userData);

    // 4. 예약/매출
    const { data: bookingData } = await supabase.from('bookings').select('*, experiences(title, price)').order('created_at', { ascending: false });
    if (bookingData) setBookings(bookingData);

    // 5. 메시지
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (msgData) setMessages(msgData);
  };

  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = '';
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
      if (input === null) return;
      comment = input;
    } else {
      if (!confirm('승인하시겠습니까?')) return;
      status = table === 'host_applications' ? 'approved' : 'active';
    }
    await supabase.from(table).update({ status, admin_comment: comment }).eq('id', id);
    if (table === 'host_applications' && (status === 'rejected' || status === 'revision')) {
      const { data: hostApp } = await supabase.from('host_applications').select('user_id').eq('id', id).single();
      if (hostApp) {
        await supabase.from('experiences').update({ status: status, admin_comment: `호스트 자격 ${status}` }).eq('host_id', hostApp.user_id);
      }
    }
    alert('처리되었습니다.');
    fetchData();
    setSelectedItem(null);
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert('삭제 실패: ' + error.message);
    else { alert('삭제되었습니다.'); fetchData(); setSelectedItem(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <div className="flex h-[calc(100vh-80px)]">
        <aside className="w-64 bg-slate-900 text-white flex flex-col p-4 shadow-xl z-10">
          <div className="mb-6 px-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Management</h2>
            <nav className="space-y-1">
              <NavButton active={activeTab==='APPS'} onClick={()=>setActiveTab('APPS')} icon={<Users size={18}/>} label="호스트 지원서" count={apps.filter(a=>a.status==='pending').length} />
              <NavButton active={activeTab==='EXPS'} onClick={()=>setActiveTab('EXPS')} icon={<MapPin size={18}/>} label="체험 관리" count={exps.filter(e=>e.status==='pending').length} />
              <NavButton active={activeTab==='USERS'} onClick={()=>setActiveTab('USERS')} icon={<CheckCircle2 size={18}/>} label="고객(유저) 관리" />
            </nav>
          </div>
          <div className="mb-6 px-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Monitoring</h2>
            <nav className="space-y-1">
              <NavButton active={activeTab==='CHATS'} onClick={()=>setActiveTab('CHATS')} icon={<MessageSquare size={18}/>} label="메시지 모니터링" />
              <NavButton active={activeTab==='FINANCE'} onClick={()=>setActiveTab('FINANCE')} icon={<DollarSign size={18}/>} label="매출 및 통계" />
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden flex gap-6">
          {activeTab === 'FINANCE' ? (
            <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} />
          ) : (
            <ManagementTab 
              activeTab={activeTab} filter={filter} setFilter={setFilter}
              apps={apps} exps={exps} users={users} messages={messages}
              selectedItem={selectedItem} setSelectedItem={setSelectedItem}
              updateStatus={updateStatus} deleteItem={deleteItem}
            />
          )}
        </main>
      </div>
    </div>
  );
}