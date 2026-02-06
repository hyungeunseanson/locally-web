'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import Sidebar from './components/Sidebar'; // ✅ 분리된 사이드바
import RealtimeTab from './components/RealtimeTab'; // ✅ 분리된 실시간 탭
import ManagementTab from './components/ManagementTab';
import AnalyticsTab from './components/AnalyticsTab';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS' | 'USERS' | 'CHATS' | 'FINANCE' | 'REALTIME'>('APPS');
  const [filter, setFilter] = useState('ALL'); 
  
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]); 

  const supabase = createClient();

  useEffect(() => { 
    fetchData(); 
    const channel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.values(newState).flat(); 
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setOnlineUsers(uniqueUsers);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    // (기존 fetchData 로직 100% 동일)
    console.log("🔄 데이터 불러오는 중..."); 
    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);
    const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
    if (expData) setExps(expData);
    const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); 
    if (userData) setUsers(userData);
    const { data: bookingData } = await supabase.from('bookings').select('*, experiences(title, price)').order('created_at', { ascending: false });
    if (bookingData) setBookings(bookingData);
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (msgData) setMessages(msgData);
  };

  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    // (기존 updateStatus 로직 100% 동일)
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
    // (기존 deleteItem 로직 100% 동일)
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert('삭제 실패: ' + error.message);
    else { alert('삭제되었습니다.'); fetchData(); setSelectedItem(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <div className="flex h-[calc(100vh-80px)]">
        
        {/* 분리된 사이드바 컴포넌트 */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          appsCount={apps.filter(a=>a.status==='pending').length}
          expsCount={exps.filter(e=>e.status==='pending').length}
          onlineUsersCount={onlineUsers.length}
        />

        <main className="flex-1 p-6 overflow-hidden flex gap-6">
          {activeTab === 'REALTIME' ? (
            <RealtimeTab onlineUsers={onlineUsers} /> // ✅ 분리된 실시간 탭
          ) : activeTab === 'FINANCE' ? (
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