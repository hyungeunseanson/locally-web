'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import Sidebar from './components/Sidebar';
import UsersTab from './components/UsersTab'; // ✅ 통합 유저 탭
import BookingsTab from './components/BookingsTab'; // ✅ 통합 예약 탭
import SalesTab from './components/SalesTab'; // ✅ 별도 생성 필요 (이전 답변 참고)
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS' | 'USERS' | 'BOOKINGS' | 'CHATS' | 'SALES' | 'ANALYTICS'>('APPS');
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
    
    // 1. 유저 접속 구독
    const presenceChannel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat(); 
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setOnlineUsers(uniqueUsers);
      })
      .subscribe();

    // 2. 실시간 예약 구독 (예약 발생 시 즉시 반영)
    const bookingChannel = supabase.channel('realtime_bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
        setBookings(prev => [payload.new, ...prev]);
        // 필요시 알림 토스트 띄우기 기능 추가 가능
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(presenceChannel); 
      supabase.removeChannel(bookingChannel);
    };
  }, []);

  const fetchData = async () => {
    // (기존 fetchData 로직 유지)
    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);
    const { data: expData } = await supabase.from('experiences').select('*, bookings(count)').order('created_at', { ascending: false });
    if (expData) setExps(expData);
    const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); 
    if (userData) setUsers(userData);
    const { data: bookingData } = await supabase.from('bookings').select('*, experiences(title, price)').order('created_at', { ascending: false });
    if (bookingData) setBookings(bookingData);
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (msgData) setMessages(msgData);
  };

  const updateStatus = async (table: any, id: any, status: any) => { /* 기존 로직 유지 */ };
  const deleteItem = async (table: any, id: any) => { /* 기존 로직 유지 */ };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <div className="flex h-[calc(100vh-80px)]">
        
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          appsCount={apps.filter(a=>a.status==='pending').length}
          expsCount={exps.filter(e=>e.status==='pending').length}
          onlineUsersCount={onlineUsers.length}
        />

        <main className="flex-1 p-6 overflow-hidden flex gap-6">
          {activeTab === 'USERS' ? (
            <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />
          ) : activeTab === 'BOOKINGS' ? (
            <BookingsTab bookings={bookings} />
          ) : activeTab === 'SALES' ? (
            <SalesTab bookings={bookings} /> // SalesTab.tsx 필요 (이전 답변 참고)
          ) : activeTab === 'ANALYTICS' ? (
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